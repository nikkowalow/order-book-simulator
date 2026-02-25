#include "market_maker/trading_bots.hpp"

#include <algorithm>
#include <chrono>
#include <deque>
#include <iostream>
#include <random>

using namespace std::chrono_literals;

TradingBots::TradingBots(OrderBook& book, MatchingEngine& engine, std::mutex& mtx)
    : book_(book), engine_(engine), mtx_(mtx) {}

TradingBots::~TradingBots() { stop(); }

void TradingBots::start() {
    running_.store(true);
    momentum_thread_      = std::thread(&TradingBots::run_momentum,      this);
    mean_reversion_thread_= std::thread(&TradingBots::run_mean_reversion, this);
    noise_thread_         = std::thread(&TradingBots::run_noise,          this);
    sniper_thread_        = std::thread(&TradingBots::run_sniper,         this);
    std::cout << "TradingBots started (momentum, mean-reversion, noise, sniper)\n";
}

void TradingBots::stop() {
    running_.store(false);
    if (momentum_thread_.joinable())       momentum_thread_.join();
    if (mean_reversion_thread_.joinable()) mean_reversion_thread_.join();
    if (noise_thread_.joinable())          noise_thread_.join();
    if (sniper_thread_.joinable())         sniper_thread_.join();
    std::cout << "TradingBots stopped\n";
}

// ---------------------------------------------------------------------------
// Momentum bot
// Tracks the last 8 mid-price samples.  When the trailing slope exceeds a
// threshold it sends an aggressive limit order in the trend direction.
// ---------------------------------------------------------------------------
void TradingBots::run_momentum() {
    static constexpr int WINDOW    = 8;
    static constexpr int THRESHOLD = 2;   // ticks of movement to trigger
    static constexpr int QTY       = 10;

    std::deque<int> prices;

    while (running_.load()) {
        do {
            std::lock_guard<std::mutex> lk(mtx_);
            auto bb = book_.best_bid();
            auto ba = book_.best_ask();
            if (!bb || !ba) break;

            int mid = (*bb + *ba) / 2;
            prices.push_back(mid);
            if ((int)prices.size() > WINDOW) prices.pop_front();
            if ((int)prices.size() < WINDOW) break;

            int momentum = prices.back() - prices.front();

            if (momentum >= THRESHOLD) {
                // Uptrend — buy aggressively at the ask
                engine_.process_order(Order{.id    = engine_.next_order_id(),
                                            .side  = Side::Buy,
                                            .price = *ba,
                                            .qty   = QTY,
                                            .type  = OrderType::Limit});
            } else if (momentum <= -THRESHOLD) {
                // Downtrend — sell aggressively at the bid
                engine_.process_order(Order{.id    = engine_.next_order_id(),
                                            .side  = Side::Sell,
                                            .price = *bb,
                                            .qty   = QTY,
                                            .type  = OrderType::Limit});
            }
        } while (false);

        std::this_thread::sleep_for(200ms);
    }
}

// ---------------------------------------------------------------------------
// Mean-reversion bot
// Maintains an EMA of the mid price.  When the current mid deviates more than
// THRESHOLD ticks from the EMA it fades the move with a passive limit order.
// ---------------------------------------------------------------------------
void TradingBots::run_mean_reversion() {
    static constexpr double ALPHA     = 0.08;  // EMA smoothing
    static constexpr double THRESHOLD = 2.5;   // ticks from EMA to trigger
    static constexpr int    QTY       = 15;

    double ema        = 0.0;
    bool   initialised = false;

    while (running_.load()) {
        do {
            std::lock_guard<std::mutex> lk(mtx_);
            auto bb = book_.best_bid();
            auto ba = book_.best_ask();
            if (!bb || !ba) break;

            double mid = (*bb + *ba) / 2.0;

            if (!initialised) {
                ema = mid;
                initialised = true;
                break;
            }

            ema = ALPHA * mid + (1.0 - ALPHA) * ema;
            double deviation = mid - ema;

            if (deviation >= THRESHOLD) {
                // Price stretched above EMA — sell, expect reversion down
                int sell_px = std::max((int)ema + 1, *bb + 1);
                engine_.process_order(Order{.id    = engine_.next_order_id(),
                                            .side  = Side::Sell,
                                            .price = sell_px,
                                            .qty   = QTY,
                                            .type  = OrderType::Limit});
            } else if (deviation <= -THRESHOLD) {
                // Price stretched below EMA — buy, expect reversion up
                int buy_px = std::min((int)ema, *ba - 1);
                if (buy_px < 1) buy_px = 1;
                engine_.process_order(Order{.id    = engine_.next_order_id(),
                                            .side  = Side::Buy,
                                            .price = buy_px,
                                            .qty   = QTY,
                                            .type  = OrderType::Limit});
            }
        } while (false);

        std::this_thread::sleep_for(400ms);
    }
}

// ---------------------------------------------------------------------------
// Noise trader
// Places random small limit orders on either side of the book at random
// offsets from the mid price.  Simulates unsophisticated retail order flow.
// ---------------------------------------------------------------------------
void TradingBots::run_noise() {
    std::mt19937 rng{std::random_device{}()};
    std::uniform_int_distribution<int> side_dist(0, 1);
    std::uniform_int_distribution<int> offset_dist(-5, 5);
    std::uniform_int_distribution<int> qty_dist(1, 8);
    std::uniform_int_distribution<int> sleep_dist(60, 280);

    while (running_.load()) {
        do {
            std::lock_guard<std::mutex> lk(mtx_);
            auto bb = book_.best_bid();
            auto ba = book_.best_ask();
            if (!bb || !ba) break;

            int mid   = (*bb + *ba) / 2;
            bool buy  = side_dist(rng) == 0;
            int price = std::max(1, mid + offset_dist(rng));
            int qty   = qty_dist(rng);

            engine_.process_order(Order{.id    = engine_.next_order_id(),
                                        .side  = buy ? Side::Buy : Side::Sell,
                                        .price = price,
                                        .qty   = qty,
                                        .type  = OrderType::Limit});
        } while (false);

        std::this_thread::sleep_for(std::chrono::milliseconds(sleep_dist(rng)));
    }
}

// ---------------------------------------------------------------------------
// Sniper bot
// When the spread is wide (>= 3 ticks) it quotes inside the best bid/ask,
// improving prices on both sides and earning the spread on subsequent fills.
// ---------------------------------------------------------------------------
void TradingBots::run_sniper() {
    static constexpr int MIN_SPREAD = 3;
    static constexpr int QTY        = 20;

    while (running_.load()) {
        do {
            std::lock_guard<std::mutex> lk(mtx_);
            auto bb = book_.best_bid();
            auto ba = book_.best_ask();
            if (!bb || !ba) break;

            int spread = *ba - *bb;
            if (spread < MIN_SPREAD) break;

            // Step inside the spread on both sides
            int inside_bid = *bb + 1;
            int inside_ask = *ba - 1;
            if (inside_bid >= inside_ask) break;

            engine_.process_order(Order{.id    = engine_.next_order_id(),
                                        .side  = Side::Buy,
                                        .price = inside_bid,
                                        .qty   = QTY,
                                        .type  = OrderType::Limit});

            engine_.process_order(Order{.id    = engine_.next_order_id(),
                                        .side  = Side::Sell,
                                        .price = inside_ask,
                                        .qty   = QTY,
                                        .type  = OrderType::Limit});
        } while (false);

        std::this_thread::sleep_for(150ms);
    }
}
