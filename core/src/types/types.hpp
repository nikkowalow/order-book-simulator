#pragma once

#include <chrono>
#include <vector>

enum class Side
{
    Buy,
    Sell
};


enum class OrderType {Limit, Market};

enum class TimeInForce {GTC, IOC, FOK};

struct Order
{
    long long id;
    Side side;
    int price;
    long long qty;
    OrderType type;
};

struct Trade
{
    long long trade_id;
    long long maker_id;
    long long taker_id;
    int price;
    long long qty;
    long long seq;
    std::chrono::nanoseconds timestamp;
};

enum class OrderStatus {
    New,
    PartiallyFilled,
    Filled,
    Canceled,
    Rejected
};

struct OrderResult {
    long long id;
    OrderStatus status;
    long long original_qty;
    long long filled_qty;
    long long remaining_qty;
    std::vector<Trade> trades;
};