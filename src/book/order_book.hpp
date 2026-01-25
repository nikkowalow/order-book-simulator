#pragma once

#include <map>
#include <deque>
#include <optional>
#include <functional>
#include <ostream>

#include "../types/types.hpp"

class OrderBook
{
public:
    // Resting order insertion
    void add_resting_order(const Order &o);

    // Best prices
    std::optional<int> best_bid() const;
    std::optional<int> best_ask() const;

    // Access top-of-book queues (used by MatchingEngine)
    std::deque<Order> *best_bid_queue();
    std::deque<Order> *best_ask_queue();

    // Remove empty top levels after matching
    void cleanup_best_bid_level_if_empty();
    void cleanup_best_ask_level_if_empty();

    // Debug printing
    void print_book(std::ostream &os) const;

private:
    std::map<int, std::deque<Order>, std::greater<int>> bids_;
    std::map<int, std::deque<Order>> asks_;
};
