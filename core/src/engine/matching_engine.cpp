#include "matching_engine.hpp"

MatchingEngine::MatchingEngine(OrderBook &book)
    : book_(book) {}

std::vector<Trade> MatchingEngine::process_limit_order(const Order &incoming)
{
    if (incoming.qty <= 0)
        return {};

    Order taker = incoming;
    std::vector<Trade> trades;

    if (taker.side == Side::Buy)
    {
        match_buy(taker, trades);
        if (taker.qty > 0)
        {
            book_.add_resting_order(taker);
        }
    }
    else
    {
        match_sell(taker, trades);
        if (taker.qty > 0)
        {
            book_.add_resting_order(taker);
        }
    }

    return trades;
}

void MatchingEngine::match_buy(Order &taker, std::vector<Trade> &trades)
{
    // Buy matches against asks at prices <= taker.price
    while (taker.qty > 0)
    {
        auto best_ask = book_.best_ask();
        if (!best_ask.has_value())
            break;

        int ask_price = *best_ask;
        if (ask_price > taker.price)
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
    // Sell matches against bids at prices >= taker.price
    while (taker.qty > 0)
    {
        auto best_bid = book_.best_bid();
        if (!best_bid.has_value())
            break;

        int bid_price = *best_bid;
        if (bid_price < taker.price)
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
