#pragma once

#include <atomic>
#include <chrono>
#include <fstream>
#include <mutex>
#include <unordered_map>
#include <vector>

#include "types/types.hpp"

struct Position {
    long long cash = 1000;
    long long shares = 10;
    long long net_qty = 0;
    long long total_buy_qty = 0;
    long long total_sell_qty = 0;
    long long total_buy_value = 0;
    long long total_sell_value = 0;
};

class UserManager {
public:
    explicit UserManager(const std::string& journal_path);

    long long next_user_id();

    long long reconnect_user(long long uid);

    void register_order(long long order_id, long long user_id);
    long long get_user_for_order(long long order_id) const;

    void on_fill(long long maker_order_id, long long taker_order_id,
                 int price, long long qty, Side taker_side);

    Position get_position(long long user_id) const;
    std::vector<long long> get_all_users() const;

private:
    std::atomic<long long> next_id_{1};

    mutable std::mutex mtx_;
    std::unordered_map<long long, long long> order_to_user_;
    std::unordered_map<long long, Position> positions_;
    std::vector<long long> users_;

    std::ofstream journal_;
    std::mutex journal_mtx_;
};
