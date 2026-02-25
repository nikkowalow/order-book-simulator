#pragma once

#include <atomic>
#include <deque>
#include <mutex>
#include <thread>
#include <vector>

#include "book/order_book.hpp"
#include "engine/matching_engine.hpp"

// TradingBots runs several autonomous trader personalities in parallel threads.
// All bots use user_id=0 so they bypass balance preflight checks.
//
//  - Momentum     : follows short-term price trends with aggressive limits
//  - MeanReversion: fades deviations from a slow EMA with passive limits
//  - Noise        : random limit orders at random prices/sizes, adds churn
//  - Sniper       : tightens wide spreads by quoting inside the best bid/ask

class TradingBots {
public:
    TradingBots(OrderBook& book, MatchingEngine& engine, std::mutex& mtx);
    ~TradingBots();

    void start();
    void stop();

private:
    void run_momentum();
    void run_mean_reversion();
    void run_noise();
    void run_sniper();

    OrderBook&      book_;
    MatchingEngine& engine_;
    std::mutex&     mtx_;

    std::atomic<bool> running_{false};

    std::thread momentum_thread_;
    std::thread mean_reversion_thread_;
    std::thread noise_thread_;
    std::thread sniper_thread_;
};
