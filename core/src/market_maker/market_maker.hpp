#pragma once

#include <atomic>
#include <mutex>
#include <thread>

#include "book/order_book.hpp"
#include "engine/matching_engine.hpp"

class MarketMaker {
public:
  MarketMaker(OrderBook &book, MatchingEngine &engine, std::mutex &mtx);
  ~MarketMaker();

  void start();
  void stop();
  bool toggle(); // returns new running state
  bool is_running() const;

private:
  void run_maker();
  void run_taker();

  OrderBook &book_;
  MatchingEngine &engine_;
  std::mutex &mtx_;

  std::atomic<bool> running_{false};

  std::thread maker_thread_;
  std::thread taker_thread_;

  // maker state
  long long bid_id_{0};
  long long ask_id_{0};
  int bid_px_{0};
  int ask_px_{0};

  // params (tune freely)
  int anchor_px_{100};        // fallback mid when book is empty
  int spread_{2};
  int maker_qty_{50};
  int taker_qty_{20};

  int maker_interval_ms_{350};
  int taker_interval_ms_{350};

  int target_depth_{2000};
  int min_depth_{1000};
};
