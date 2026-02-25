#include "order_book.hpp"
#include <iostream>
#include <sstream>
#include <string>

struct InPlaceRenderer {
  size_t last_lines = 0;

  static size_t count_lines(const std::string &s) {
    size_t n = 0;
    for (char c : s)
      if (c == '\n')
        ++n;
    if (!s.empty() && s.back() != '\n')
      ++n;
    return n;
  }

  // Move cursor up N lines (like repeated \033[F)
  static void cursor_up_lines(size_t n) {
    if (n == 0)
      return;
    std::cout << "\033[" << n << "F";
  }

  // Clear N lines starting at current cursor line, then return to start line
  static void clear_lines(size_t n) {
    for (size_t i = 0; i < n; ++i) {
      std::cout << "\033[2K"; // clear entire line
      if (i + 1 < n)
        std::cout << "\n"; // go down to clear next line
    }
    // go back up to where we started
    if (n > 1)
      std::cout << "\033[" << (n - 1) << "F";
  }

  // Render text in-place
  void draw(const std::string &frame) {
    // go to start of previous frame
    cursor_up_lines(last_lines);

    // clear old frame area
    clear_lines(last_lines);

    // print new frame
    std::cout << frame << std::flush;

    last_lines = count_lines(frame);
  }
};

void OrderBook::add_resting_order(const Order &o) {
  if (o.qty <= 0)
    return;

  // Reject duplicate IDs (simple rule for now)
  if (index_.find(o.id) != index_.end()) {
    return;
  }

  if (o.side == Side::Buy) {
    auto &level = bids_[o.price];
    level.push_back(o);
    auto it = std::prev(level.end());

    index_[o.id] = Locator{.side = Side::Buy, .price = o.price, .it = it};
  } else {
    auto &level = asks_[o.price];
    level.push_back(o);
    auto it = std::prev(level.end());

    index_[o.id] = Locator{.side = Side::Sell, .price = o.price, .it = it};
  }

  notify_change();
}

bool OrderBook::cancel_order(long long order_id) {
  auto it = index_.find(order_id);
  if (it == index_.end())
    return false;

  Locator loc = it->second;

  if (loc.side == Side::Buy) {
    auto lvl = bids_.find(loc.price);
    if (lvl != bids_.end()) {
      lvl->second.erase(loc.it);
      if (lvl->second.empty()) {
        bids_.erase(lvl);
      }
    }
  } else {
    auto lvl = asks_.find(loc.price);
    if (lvl != asks_.end()) {
      lvl->second.erase(loc.it);
      if (lvl->second.empty()) {
        asks_.erase(lvl);
      }
    }
  }

  index_.erase(it);
  notify_change();
  return true;
}

std::optional<Order> OrderBook::find_order(long long order_id) const {
  auto it = index_.find(order_id);
  if (it == index_.end()) return std::nullopt;
  return *(it->second.it);
}

std::optional<int> OrderBook::best_bid() const {
  if (bids_.empty())
    return std::nullopt;
  return bids_.begin()->first;
}

std::optional<int> OrderBook::best_ask() const {
  if (asks_.empty())
    return std::nullopt;
  return asks_.begin()->first;
}

std::list<Order> *OrderBook::best_bid_queue() {
  if (bids_.empty())
    return nullptr;
  return &bids_.begin()->second;
}

std::list<Order> *OrderBook::best_ask_queue() {
  if (asks_.empty())
    return nullptr;
  return &asks_.begin()->second;
}

void OrderBook::cleanup_best_bid_level_if_empty() {
  if (bids_.empty())
    return;
  if (bids_.begin()->second.empty()) {
    bids_.erase(bids_.begin());
  }
}

void OrderBook::cleanup_best_ask_level_if_empty() {
  if (asks_.empty())
    return;
  if (asks_.begin()->second.empty()) {
    asks_.erase(asks_.begin());
  }
}

long long OrderBook::bid_depth() const {
  long long total = 0;

  for (const auto &[price, orders] : bids_) {
    for (const auto &o : orders)
      total += o.qty;
  }

  return total;
}

long long OrderBook::ask_depth() const {
  long long total = 0;

  for (const auto &[price, orders] : asks_) {
    for (const auto &o : orders)
      total += o.qty;
  }

  return total;
}