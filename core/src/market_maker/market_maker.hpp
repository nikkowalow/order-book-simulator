#pragma once

#include <atomic>
#include <thread>
#include <mutex>
#include <optional>

#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>

class MarketMaker {
public:
    MarketMaker(OrderBook &book, MatchingEngine &engine, std::mutex &mtx);
    ~MarketMaker();

    void start();
    void stop();

private:
    void run();

    OrderBook &book_;
    MatchingEngine &engine_;
    std::mutex &mtx_;

    std::atomic<bool> running_{false};
    std::thread thread_;

    long long bid_id_{0};
    long long ask_id_{0};

    int bid_px_{0};
    int ask_px_{0};

    int spread_{2};        // total spread in ticks
    int qty_{50};          // quote size
    int interval_ms_{200}; // update interval
};
