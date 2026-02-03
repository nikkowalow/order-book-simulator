#include "market_maker/market_maker.hpp"

#include <chrono>
#include <iostream>
#include <random>

MarketMaker::MarketMaker(OrderBook &book, MatchingEngine &engine,
                         std::mutex &mtx)
    : book_(book), engine_(engine), mtx_(mtx) {}

MarketMaker::~MarketMaker() { stop(); }

void MarketMaker::start() {
  running_.store(true);

  maker_thread_ = std::thread(&MarketMaker::run_maker, this);
  taker_thread_ = std::thread(&MarketMaker::run_taker, this);

  std::cout << "MarketMaker started (maker + taker)\n";
}

void MarketMaker::stop() {
  running_.store(false);

  if (maker_thread_.joinable())
    maker_thread_.join();
  if (taker_thread_.joinable())
    taker_thread_.join();

  std::cout << "MarketMaker stopped\n";
}

bool MarketMaker::toggle() {
  if (running_.load()) {
    stop();
    return false;
  } else {
    start();
    return true;
  }
}

bool MarketMaker::is_running() const { return running_.load(); }

void MarketMaker::run_maker() {
  using namespace std::chrono_literals;

  while (running_.load()) {
    {
      std::lock_guard<std::mutex> lk(mtx_);

      auto bb = book_.best_bid();
      auto ba = book_.best_ask();

      int mid = 100;
      if (bb && ba)
        mid = (*bb + *ba) / 2;
      else if (bb)
        mid = *bb;
      else if (ba)
        mid = *ba;

      int bid_px = mid - spread_ / 2;
      int ask_px = mid + spread_ / 2;

      if (ba && bid_px >= *ba)
        bid_px = *ba - 1;
      if (bb && ask_px <= *bb)
        ask_px = *bb + 1;

      int bid_depth = book_.bid_depth();
      int ask_depth = book_.ask_depth();

      if (bid_depth < target_depth_) {
        int add = std::min(maker_qty_, target_depth_ - bid_depth);

        engine_.process_order(Order{.id = engine_.next_order_id(),
                                    .side = Side::Buy,
                                    .price = bid_px,
                                    .qty = add,
                                    .type = OrderType::Limit});
      }

      if (ask_depth < target_depth_) {
        int add = std::min(maker_qty_, target_depth_ - ask_depth);

        engine_.process_order(Order{.id = engine_.next_order_id(),
                                    .side = Side::Sell,
                                    .price = ask_px,
                                    .qty = add,
                                    .type = OrderType::Limit});
      }

      if (bid_depth > max_depth_ || ask_depth > max_depth_) {
      }
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(maker_interval_ms_));
  }
}

void MarketMaker::run_taker() {
  using namespace std::chrono_literals;

  std::mt19937 rng{std::random_device{}()};
  std::uniform_int_distribution<int> side_dist(0, 1);

  while (running_.load()) {
    {
      std::lock_guard<std::mutex> lk(mtx_);

      int bid_depth = book_.bid_depth();
      int ask_depth = book_.ask_depth();

      if (bid_depth < min_depth_ || ask_depth < min_depth_) {
        goto sleep;
      }

      bool buy = side_dist(rng) == 0;

      engine_.process_order(Order{.id = engine_.next_order_id(),
                                  .side = buy ? Side::Buy : Side::Sell,
                                  .price = 0,
                                  .qty = taker_qty_,
                                  .type = OrderType::Market});
    }

  sleep:
    std::this_thread::sleep_for(std::chrono::milliseconds(taker_interval_ms_));
  }
}
