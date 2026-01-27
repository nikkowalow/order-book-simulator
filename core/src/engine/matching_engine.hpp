#pragma once

#include <vector>
#include "../types/types.hpp"
#include "../book/order_book.hpp"
#include <atomic>

class MatchingEngine
{
public:
    explicit MatchingEngine(OrderBook &book);

    long long next_order_id();

    std::vector<Trade> process_limit_order(const Order &incoming);

private:
    OrderBook &book_;
    std::atomic<long long> next_id_{1000};
        
    void match_buy(Order &taker, std::vector<Trade> &trades);
    void match_sell(Order &taker, std::vector<Trade> &trades);
};
