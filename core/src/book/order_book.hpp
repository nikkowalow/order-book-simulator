#pragma once

#include <map>
#include <list>
#include <unordered_map>
#include <optional>
#include <functional>
#include <ostream>

#include "types/types.hpp"

class OrderBook
{
public:
    void add_resting_order(const Order &o);

    bool cancel_order(long long order_id);

    std::optional<int> best_bid() const;
    std::optional<int> best_ask() const;

    std::list<Order> *best_bid_queue();
    std::list<Order> *best_ask_queue();

    void cleanup_best_bid_level_if_empty();
    void cleanup_best_ask_level_if_empty();

    void print_book(std::ostream &os) const;

private:
    using OrderList = std::list<Order>;

    struct Locator
    {
        Side side;
        int price;
        OrderList::iterator it;
    };

    // bids: high -> low
    std::map<int, OrderList, std::greater<int>> bids_;

    // asks: low -> high
    std::map<int, OrderList> asks_;

    // order_id -> where it lives
    std::unordered_map<long long, Locator> index_;
};
