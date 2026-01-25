#pragma once

#include <vector>
#include "../types/types.hpp"
#include "../book/order_book.hpp"

class MatchingEngine
{
public:
    explicit MatchingEngine(OrderBook &book);

    std::vector<Trade> process_limit_order(const Order &incoming);

private:
    OrderBook &book_;

    void match_buy(Order &taker, std::vector<Trade> &trades);
    void match_sell(Order &taker, std::vector<Trade> &trades);
};
