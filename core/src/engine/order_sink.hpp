#pragma once

#include <chrono>
#include "types/types.hpp"


struct OrderEvent {
    long long seq;
    long long batch_id;
    long long order_id;
    long long user_id = 0;
    OrderStatus status;
    Side side;
    int price;
    long long qty;
    long long remaining_qty;
    std::chrono::nanoseconds timestamp;
};

struct OrderSink {
    virtual ~OrderSink() = default;
    virtual void on_order_event(const OrderEvent& event) = 0;
};
