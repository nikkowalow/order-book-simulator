#pragma once
#include "types/types.hpp"

struct TradeSink {
    virtual ~TradeSink() = default;
    virtual void on_trade(const Trade& trade) = 0;
};
