#pragma once

#include <chrono>

enum class OrderEventType {
    New,
    Fill,
    PartialFill,
    Cancelled,
    Rejected
};

struct OrderEvent {
    long long seq;
    long long batch_id;  // Groups related events from same order processing
    long long order_id;
    OrderEventType type;
    int price;
    long long qty;
    long long remaining_qty;
    std::chrono::nanoseconds timestamp;
};

struct OrderSink {
    virtual ~OrderSink() = default;
    virtual void on_order_event(const OrderEvent& event) = 0;
};
