#pragma once

#include <functional>
#include <list>
#include <map>
#include <memory_resource>
#include <optional>
#include <ostream>
#include <unordered_map>

#include "types/types.hpp"

class OrderBook {
public:
  // All list and map nodes come from a single unsynchronized pool resource
  // owned by this book — no per-node malloc, no heap fragmentation.
  using OrderList = std::pmr::list<Order>;

  OrderBook()
      : bids_(&pool_), asks_(&pool_), index_(&pool_) {
    index_.reserve(1 << 17); // pre-reserve 131072 slots — no rehash up to ~115k orders
  }

  void add_resting_order(const Order &o);

  bool cancel_order(long long order_id);
  std::optional<Order> find_order(long long order_id) const;

  std::optional<int> best_bid() const;
  std::optional<int> best_ask() const;

  OrderList *best_bid_queue();
  OrderList *best_ask_queue();

  void cleanup_best_bid_level_if_empty();
  void cleanup_best_ask_level_if_empty();

  const auto &bids() const { return bids_; }
  const auto &asks() const { return asks_; }

  long long bid_depth() const;
  long long ask_depth() const;

  using ChangeCallback = std::function<void()>;
  void set_on_change(ChangeCallback cb) { on_change_ = std::move(cb); }
  void notify_change() {
    if (on_change_)
      on_change_();
  }

private:
  // Pool must be declared before any member that uses it.
  std::pmr::unsynchronized_pool_resource pool_;

  ChangeCallback on_change_;

  struct Locator {
    Side side;
    int price;
    OrderList::iterator it;
  };

  // bids: high -> low
  std::pmr::map<int, OrderList, std::greater<int>> bids_;

  // asks: low -> high
  std::pmr::map<int, OrderList> asks_;

  // order_id -> where it lives — pre-reserved to avoid rehash spikes
  std::pmr::unordered_map<long long, Locator> index_;
};
