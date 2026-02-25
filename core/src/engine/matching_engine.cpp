#include "engine/matching_engine.hpp"
#include "user/user_manager.hpp"
#include <iostream>
#include "../../utils/scoped_timer.hpp"

static std::atomic<long long> global_seq{1};
static std::atomic<long long> global_trade_id{1};

MatchingEngine::MatchingEngine(OrderBook& book, TradeSink* trade_sink, OrderSink* order_sink, UserManager* user_manager)
    : book_(book), trade_sink_(trade_sink), order_sink_(order_sink), user_manager_(user_manager)
{
}

static void emit_trades(std::vector<Trade>& trades, TradeSink* sink)
{
    if (!sink) return;

    for (auto& t : trades) {
        t.seq = global_seq.fetch_add(1, std::memory_order_relaxed);
        t.trade_id = global_trade_id.fetch_add(1, std::memory_order_relaxed);
        t.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        );

        sink->on_trade(t);
    }
}

PreflightResult MatchingEngine::preflight_check(const Order& order)
{
    if (order.qty <= 0) {
        return PreflightResult::rejected("quantity must be positive");
    }

    if (order.type == OrderType::Limit && order.price <= 0) {
        return PreflightResult::rejected("limit order price must be positive");
    }

    if (order.type == OrderType::Market) {
        if (order.side == Side::Buy) {
            if (!book_.best_ask().has_value()) {
                return PreflightResult::cancelled("no asks available for market buy");
            }
        } else {
            if (!book_.best_bid().has_value()) {
                return PreflightResult::cancelled("no bids available for market sell");
            }
        }
    }

    if (user_manager_ && order.user_id > 0) {
        Position pos = user_manager_->get_position(order.user_id);

        if (order.side == Side::Buy) {
            int cost_price = (order.type == OrderType::Limit)
                ? order.price
                : *book_.best_ask();
            long long required = static_cast<long long>(cost_price) * order.qty;
            long long available = pos.balance - pos.reserved_balance;
            if (available < required) {
                return PreflightResult::rejected("insufficient cash");
            }
        } else {
            long long available = pos.shares - pos.reserved_shares;
            if (available < order.qty) {
                return PreflightResult::rejected("insufficient shares");
            }
        }
    }

    return PreflightResult::ok();
}

void MatchingEngine::emit_order_event(long long batch_id, long long order_id, long long user_id, OrderStatus status, Side side, int price, long long qty, long long remaining)
{
    if (!order_sink_) return;

    OrderEvent event;
    event.seq = event_seq_.fetch_add(1, std::memory_order_relaxed);
    event.batch_id = batch_id;
    event.order_id = order_id;
    event.user_id = user_id;
    event.status = status;
    event.side = side;
    event.price = price;
    event.qty = qty;
    event.remaining_qty = remaining;
    event.timestamp = std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    );

    order_sink_->on_order_event(event);
}

OrderResult MatchingEngine::process_order(const Order &incoming)
{

    ScopedTimer timer("process_order");

    if (user_manager_) {
        user_manager_->register_order(incoming.id, incoming.user_id);
    }

    // Get a batch_id for all events from this order processing
    long long batch_id = batch_seq_.fetch_add(1, std::memory_order_relaxed);

    OrderResult result;
    result.id = incoming.id;
    result.original_qty = incoming.qty;

    // Preflight validation
    PreflightResult preflight = preflight_check(incoming);
    if (!preflight.is_ok()) {
        result.reason = preflight.reason;
        if (preflight.status == PreflightStatus::Rejected) {
            result.status = OrderStatus::Rejected;
            result.filled_qty = 0;
            result.remaining_qty = 0;
            emit_order_event(batch_id, incoming.id, incoming.user_id, OrderStatus::Rejected, incoming.side, incoming.price, 0, 0);
        } else {
            // Cancelled (e.g., market order with no liquidity)
            result.status = OrderStatus::Canceled;
            result.filled_qty = 0;
            result.remaining_qty = 0;
            emit_order_event(batch_id, incoming.id, incoming.user_id, OrderStatus::Canceled, incoming.side, incoming.price, 0, 0);
        }
        return result;
    }

    emit_order_event(batch_id, incoming.id, incoming.user_id, OrderStatus::New, incoming.side, incoming.price, incoming.qty, incoming.qty);

    Order taker = incoming;
    std::vector<Trade> trades;

    if (taker.side == Side::Buy)
    {
        match_buy(taker, trades, batch_id);
    }
    else
    {
        match_sell(taker, trades, batch_id);
    }

    if (!trades.empty())
    {
        book_.notify_change();
    }

    if (taker.type == OrderType::Limit && taker.qty > 0)
    {
        book_.add_resting_order(taker);
        if (user_manager_) {
            user_manager_->on_order_resting(taker.id, taker.side, taker.price, taker.qty);
        }
    }

    emit_trades(trades, trade_sink_);

    // Compute filled quantity and status
    long long filled = incoming.qty - taker.qty;
    result.filled_qty = filled;
    result.remaining_qty = taker.qty;
    result.trades = std::move(trades);

    if (filled == 0) {
        result.status = OrderStatus::New;
    } else if (taker.qty == 0) {
        result.status = OrderStatus::Filled;
        emit_order_event(batch_id, incoming.id, incoming.user_id, OrderStatus::Filled, taker.side, incoming.price, filled, 0);
    } else {
        result.status = OrderStatus::PartiallyFilled;
        emit_order_event(batch_id, incoming.id, incoming.user_id, OrderStatus::PartiallyFilled, taker.side, incoming.price, filled, taker.qty);
    }

    return result;
}

void MatchingEngine::match_buy(Order &taker, std::vector<Trade> &trades, long long batch_id)
{
    while (taker.qty > 0)
    {
        auto best_ask = book_.best_ask();
        if (!best_ask.has_value())
            break;

        int ask_price = *best_ask;
        if (taker.type == OrderType::Limit && ask_price > taker.price)
            break;

        auto *q = book_.best_ask_queue();
        if (!q || q->empty())
            break;

        while (taker.qty > 0 && !q->empty())
        {
            Order &maker = q->front();

            long long fill_qty = (taker.qty < maker.qty) ? taker.qty : maker.qty;

            long long maker_user = user_manager_ ? user_manager_->get_user_for_order(maker.id) : maker.user_id;
            long long taker_user = taker.user_id;

            trades.push_back(Trade{
                .maker_id = maker.id,
                .taker_id = taker.id,
                .maker_user_id = maker_user,
                .taker_user_id = taker_user,
                .price = ask_price,
                .qty = fill_qty});

            if (user_manager_) {
                user_manager_->on_fill(maker.id, taker.id, ask_price, fill_qty, Side::Buy);
            }

            taker.qty -= fill_qty;
            maker.qty -= fill_qty;

            // Emit fill event for maker
            if (maker.qty == 0)
            {
                emit_order_event(batch_id, maker.id, maker.user_id, OrderStatus::Filled, maker.side, ask_price, fill_qty, 0);
                q->pop_front();
            }
            else
            {
                emit_order_event(batch_id, maker.id, maker.user_id, OrderStatus::PartiallyFilled, maker.side, ask_price, fill_qty, maker.qty);
            }
        }

        book_.cleanup_best_ask_level_if_empty();
    }
}

void MatchingEngine::match_sell(Order &taker, std::vector<Trade> &trades, long long batch_id)
{
    while (taker.qty > 0)
    {
        auto best_bid = book_.best_bid();
        if (!best_bid.has_value())
            break;

        int bid_price = *best_bid;
        if (taker.type == OrderType::Limit && bid_price < taker.price)
            break;

        auto *q = book_.best_bid_queue();
        if (!q || q->empty())
            break;

        while (taker.qty > 0 && !q->empty())
        {
            Order &maker = q->front();

            long long fill_qty = (taker.qty < maker.qty) ? taker.qty : maker.qty;

            long long maker_user = user_manager_ ? user_manager_->get_user_for_order(maker.id) : maker.user_id;
            long long taker_user = taker.user_id;

            trades.push_back(Trade{
                .maker_id = maker.id,
                .taker_id = taker.id,
                .maker_user_id = maker_user,
                .taker_user_id = taker_user,
                .price = bid_price,
                .qty = fill_qty});

            if (user_manager_) {
                user_manager_->on_fill(maker.id, taker.id, bid_price, fill_qty, Side::Sell);
            }

            taker.qty -= fill_qty;
            maker.qty -= fill_qty;

            // Emit fill event for maker
            if (maker.qty == 0)
            {
                emit_order_event(batch_id, maker.id, maker.user_id, OrderStatus::Filled, maker.side, bid_price, fill_qty, 0);
                q->pop_front();
            }
            else
            {
                emit_order_event(batch_id, maker.id, maker.user_id, OrderStatus::PartiallyFilled, maker.side, bid_price, fill_qty, maker.qty);
            }
        }

        book_.cleanup_best_bid_level_if_empty();
    }
}

long long MatchingEngine::next_order_id() {
    return next_id_.fetch_add(1, std::memory_order_relaxed);
}

bool MatchingEngine::cancel_order(long long order_id) {
    auto order = book_.find_order(order_id);

    bool ok = book_.cancel_order(order_id);
    if (ok) {
        long long batch_id = batch_seq_.fetch_add(1, std::memory_order_relaxed);
        long long user_id = user_manager_ ? user_manager_->get_user_for_order(order_id) : 0;
        emit_order_event(batch_id, order_id, user_id, OrderStatus::Canceled, Side::Buy, 0, 0, 0);
        if (user_manager_ && order.has_value()) {
            user_manager_->on_cancel(order_id, order->side, order->price, order->qty);
        }
        book_.notify_change();
    }
    return ok;
}
