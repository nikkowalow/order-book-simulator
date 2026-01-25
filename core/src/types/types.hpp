#pragma once

enum class Side
{
    Buy,
    Sell
};

struct Order
{
    long long id;
    Side side;
    int price;
    long long qty;
};

struct Trade
{
    long long maker_id;
    long long taker_id;
    int price;
    long long qty;
};