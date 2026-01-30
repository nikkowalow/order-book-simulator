#pragma once

#include <vector>
#include "../types/types.hpp"
#include "../book/order_book.hpp"
#include <atomic>
#include "trade_sink.hpp"
#include "order_sink.hpp"

class MatchingEngine
{
public:
    explicit MatchingEngine(OrderBook &book, TradeSink* trade_sink = nullptr, OrderSink* order_sink = nullptr);

    long long next_order_id();

    OrderResult process_order(const Order &incoming);

private:
    OrderBook &book_;
    TradeSink* trade_sink_;
    OrderSink* order_sink_;
    std::atomic<long long> next_id_{1000};
    std::atomic<long long> event_seq_{1};
    std::atomic<long long> batch_seq_{1};

    void match_buy(Order &taker, std::vector<Trade> &trades, long long batch_id);
    void match_sell(Order &taker, std::vector<Trade> &trades, long long batch_id);
    void emit_order_event(long long batch_id, long long order_id, OrderEventType type, int price, long long qty, long long remaining);
};
