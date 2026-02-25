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
    long long user_id = 0;
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
    long long maker_user_id = 0;
    long long taker_user_id = 0;
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
    std::string reason; 
};