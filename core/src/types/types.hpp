#pragma once

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
    OrderType type;
    int price;
    long long qty;
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