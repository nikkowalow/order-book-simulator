#pragma once

#include <vector>
#include <string>
#include "../types/types.hpp"
#include "../book/order_book.hpp"
#include <atomic>
#include "trade_sink.hpp"
#include "order_sink.hpp"

enum class PreflightStatus {
    Ok,
    Rejected,
    Cancelled
};

struct PreflightResult {
    PreflightStatus status;
    std::string reason;

    static PreflightResult ok() { return {PreflightStatus::Ok, ""}; }
    static PreflightResult rejected(const std::string& reason) { return {PreflightStatus::Rejected, reason}; }
    static PreflightResult cancelled(const std::string& reason) { return {PreflightStatus::Cancelled, reason}; }

    bool is_ok() const { return status == PreflightStatus::Ok; }
};

class MatchingEngine
{
public:
    explicit MatchingEngine(OrderBook &book, TradeSink* trade_sink = nullptr, OrderSink* order_sink = nullptr);

    long long next_order_id();

    OrderResult process_order(const Order &incoming);

    bool cancel_order(long long order_id);

private:
    OrderBook &book_;
    TradeSink* trade_sink_;
    OrderSink* order_sink_;
    std::atomic<long long> next_id_{1000};
    std::atomic<long long> event_seq_{1};
    std::atomic<long long> batch_seq_{1};

    PreflightResult preflight_check(const Order &order);
    void match_buy(Order &taker, std::vector<Trade> &trades, long long batch_id);
    void match_sell(Order &taker, std::vector<Trade> &trades, long long batch_id);
    void emit_order_event(long long batch_id, long long order_id, OrderStatus status, Side side, int price, long long qty, long long remaining);
};
