#pragma once

#include <vector>
#include "../types/types.hpp"
#include "../book/order_book.hpp"
#include <atomic>
#include "trade_sink.hpp"

class MatchingEngine
{
public:
    explicit MatchingEngine(OrderBook &book, TradeSink* = nullptr);

    long long next_order_id();

    OrderResult process_order(const Order &incoming);

private:
    OrderBook &book_;
    TradeSink &sink_;
    std::atomic<long long> next_id_{1000};
        
    void match_buy(Order &taker, std::vector<Trade> &trades);
    void match_sell(Order &taker, std::vector<Trade> &trades);
};
