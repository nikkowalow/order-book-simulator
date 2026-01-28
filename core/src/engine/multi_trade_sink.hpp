#pragma once
#include <vector>
#include "engine/trade_sink.hpp"
#include <iostream>

class MultiTradeSink : public TradeSink {
    std::vector<TradeSink*> sinks_;

public:
    void add_sink(TradeSink* s) {
        sinks_.push_back(s);
    }

    void on_trade(const Trade& t) override {
        for (auto* s : sinks_) {
            std::cout << "MultiTradeSink: Forwarding trade " << t.trade_id << " to sink\n";
            s->on_trade(t);
        }
    }
};
