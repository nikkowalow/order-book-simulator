#include "market_maker/market_maker.hpp"

#include <algorithm>
#include <chrono>
#include <iostream>

MarketMaker::MarketMaker(OrderBook &book, MatchingEngine &engine,
                         std::mutex &mtx)
    : book_(book), engine_(engine), mtx_(mtx) {}

MarketMaker::~MarketMaker() { stop(); }

void MarketMaker::start() {
  running_.store(true);
  maker_thread_ = std::thread(&MarketMaker::run_maker, this);
  taker_thread_ = std::thread(&MarketMaker::run_taker, this);
  std::cout << "MarketMaker started\n";
}

void MarketMaker::stop() {
  running_.store(false);
  if (maker_thread_.joinable()) maker_thread_.join();
  if (taker_thread_.joinable()) taker_thread_.join();
  std::cout << "MarketMaker stopped\n";
}

bool MarketMaker::toggle() {
  if (running_.load()) { stop(); return false; }
  else                 { start(); return true;  }
}

bool MarketMaker::is_running() const { return running_.load(); }

void MarketMaker::run_maker() {
  while (running_.load()) {
    {
      std::lock_guard<std::mutex> lk(mtx_);

      auto bb = book_.best_bid();
      auto ba = book_.best_ask();

      int mid = anchor_px_;
      if (bb && ba)      mid = (*bb + *ba) / 2;
      else if (bb)       mid = *bb;
      else if (ba)       mid = *ba;

      int bid_px = mid - spread_ / 2;
      int ask_px = mid + spread_ / 2;
      if (ask_px <= bid_px) ask_px = bid_px + 1;

      long long bid_depth = book_.bid_depth();
      long long ask_depth = book_.ask_depth();

      // Top up whichever side is lower, then match the other side to it
      // so both sides always receive the same addition each tick.
      long long min_depth = std::min(bid_depth, ask_depth);
      long long to_add = std::min((long long)maker_qty_,
                                  (long long)target_depth_ - min_depth);

      if (to_add > 0) {
        engine_.process_order(Order{.id    = engine_.next_order_id(),
                                    .side  = Side::Buy,
                                    .price = bid_px,
                                    .qty   = to_add,
                                    .type  = OrderType::Limit});

        engine_.process_order(Order{.id    = engine_.next_order_id(),
                                    .side  = Side::Sell,
                                    .price = ask_px,
                                    .qty   = to_add,
                                    .type  = OrderType::Limit});
      }
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(maker_interval_ms_));
  }
}

void MarketMaker::run_taker() {
  while (running_.load()) {
    {
      std::lock_guard<std::mutex> lk(mtx_);

      long long bid_depth = book_.bid_depth();
      long long ask_depth = book_.ask_depth();

      // Only trade when both sides have enough liquidity
      if (bid_depth >= min_depth_ && ask_depth >= min_depth_) {
        // Always trade against the heavier side to restore balance
        bool sell_into_bids = (bid_depth >= ask_depth);

        engine_.process_order(Order{.id    = engine_.next_order_id(),
                                    .side  = sell_into_bids ? Side::Sell : Side::Buy,
                                    .price = 0,
                                    .qty   = taker_qty_,
                                    .type  = OrderType::Market});
      }
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(taker_interval_ms_));
  }
}
