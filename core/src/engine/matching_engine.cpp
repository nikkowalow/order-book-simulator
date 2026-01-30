#include "engine/matching_engine.hpp"
#include <iostream>
#include "../../utils/scoped_timer.hpp"

static std::atomic<long long> global_seq{1};
static std::atomic<long long> global_trade_id{1};

MatchingEngine::MatchingEngine(OrderBook& book, TradeSink* sink)
    : book_(book), sink_(*sink)
{
}

static void emit_trades(std::vector<Trade>& trades, TradeSink* sink)
{
    if (!sink) return;

    for (auto& t : trades) {
        t.seq = global_seq.fetch_add(1, std::memory_order_relaxed);
        t.trade_id = global_trade_id.fetch_add(1, std::memory_order_relaxed);
        t.timestamp = std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now().time_since_epoch()
        );

        sink->on_trade(t);
    }
}

OrderResult MatchingEngine::process_order(const Order &incoming)
{

    ScopedTimer timer("process_order");

    OrderResult result;
    result.id = incoming.id;
    result.original_qty = incoming.qty;

    if (incoming.qty <= 0) {
        result.status = OrderStatus::Rejected;
        result.filled_qty = 0;
        result.remaining_qty = 0;
        return result;
    }

    Order taker = incoming;
    std::vector<Trade> trades;

    if (taker.side == Side::Buy)
    {
        match_buy(taker, trades);
    }
    else
    {
        match_sell(taker, trades);
    }

    if (!trades.empty())
    {
        book_.notify_change();
    }

    if (taker.type == OrderType::Limit && taker.qty > 0)
    {
        book_.add_resting_order(taker);
    }

    emit_trades(trades, &sink_);

    // Compute filled quantity and status
    long long filled = incoming.qty - taker.qty;
    result.filled_qty = filled;
    result.remaining_qty = taker.qty;
    result.trades = std::move(trades);

    if (filled == 0) {
        result.status = OrderStatus::New;
    } else if (taker.qty == 0) {
        result.status = OrderStatus::Filled;
    } else {
        result.status = OrderStatus::PartiallyFilled;
    }

    std::cout << "Order " << incoming.id << " processed: "
              << "original_qty=" << incoming.qty
              << ", filled_qty=" << result.filled_qty
              << ", remaining_qty=" << result.remaining_qty
              << ", status=" << static_cast<int>(result.status)
              << ", trades=" << result.trades.size() << "\n";
    return result;
}

void MatchingEngine::match_buy(Order &taker, std::vector<Trade> &trades)
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

            trades.push_back(Trade{
                .maker_id = maker.id,
                .taker_id = taker.id,
                .price = ask_price,
                .qty = fill_qty});
            
            // std::cout << "Trade executed: maker_id=" << maker.id << " taker_id=" << taker.id 
            //           << " price=" << ask_price << " qty=" << fill_qty << "\n";

            taker.qty -= fill_qty;
            maker.qty -= fill_qty;

            if (maker.qty == 0)
            {
                q->pop_front();
            }
        }

        book_.cleanup_best_ask_level_if_empty();
    }
}

void MatchingEngine::match_sell(Order &taker, std::vector<Trade> &trades)
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

            trades.push_back(Trade{
                .maker_id = maker.id,
                .taker_id = taker.id,
                .price = bid_price,
                .qty = fill_qty});

            taker.qty -= fill_qty;
            maker.qty -= fill_qty;

            if (maker.qty == 0)
            {
                q->pop_front();
            }
        }

        book_.cleanup_best_bid_level_if_empty();
    }
}

long long MatchingEngine::next_order_id() {
    return next_id_.fetch_add(1, std::memory_order_relaxed);
}
