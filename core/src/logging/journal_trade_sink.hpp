#pragma once

#include <fstream>
#include <mutex>
#include "engine/trade_sink.hpp"

class JournalTradeSink : public TradeSink {
public:
    explicit JournalTradeSink(const std::string& path);

    void on_trade(const Trade& t) override;

private:
    std::ofstream out_;
    std::mutex mtx_;
};
