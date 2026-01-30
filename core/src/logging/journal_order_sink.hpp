#pragma once

#include <fstream>
#include <mutex>
#include "engine/order_sink.hpp"

class JournalOrderSink : public OrderSink {
public:
    explicit JournalOrderSink(const std::string& path);

    void on_order_event(const OrderEvent& e) override;

private:
    std::ofstream out_;
    std::mutex mtx_;
};
