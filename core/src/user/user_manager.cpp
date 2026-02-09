#include "user/user_manager.hpp"

UserManager::UserManager(const std::string& journal_path)
    : journal_(journal_path, std::ios::app)
{
}

long long UserManager::next_user_id()
{
    long long id = next_id_.fetch_add(1, std::memory_order_relaxed);

    {
        std::lock_guard<std::mutex> lk(mtx_);
        positions_[id] = Position{};
        users_.push_back(id);
    }

    {
        std::lock_guard<std::mutex> lk(journal_mtx_);
        auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()
        );
        journal_
            << "{\"user_id\":" << id
            << ",\"ts\":" << now.count()
            << "}\n";
        journal_.flush();
    }

    return id;
}

void UserManager::register_order(long long order_id, long long user_id)
{
    std::lock_guard<std::mutex> lk(mtx_);
    order_to_user_[order_id] = user_id;
}

long long UserManager::get_user_for_order(long long order_id) const
{
    std::lock_guard<std::mutex> lk(mtx_);
    auto it = order_to_user_.find(order_id);
    if (it != order_to_user_.end())
        return it->second;
    return 0;
}

void UserManager::on_fill(long long maker_order_id, long long taker_order_id,
                           int price, long long qty, Side taker_side)
{
    std::lock_guard<std::mutex> lk(mtx_);

    long long maker_user = 0;
    long long taker_user = 0;

    auto mit = order_to_user_.find(maker_order_id);
    if (mit != order_to_user_.end()) maker_user = mit->second;

    auto tit = order_to_user_.find(taker_order_id);
    if (tit != order_to_user_.end()) taker_user = tit->second;

    long long value = static_cast<long long>(price) * qty;

    // Taker is buying → maker is selling
    if (taker_side == Side::Buy) {
        // Taker bought
        positions_[taker_user].net_qty += qty;
        positions_[taker_user].total_buy_qty += qty;
        positions_[taker_user].total_buy_value += value;

        // Maker sold
        positions_[maker_user].net_qty -= qty;
        positions_[maker_user].total_sell_qty += qty;
        positions_[maker_user].total_sell_value += value;
    } else {
        // Taker sold
        positions_[taker_user].net_qty -= qty;
        positions_[taker_user].total_sell_qty += qty;
        positions_[taker_user].total_sell_value += value;

        // Maker bought
        positions_[maker_user].net_qty += qty;
        positions_[maker_user].total_buy_qty += qty;
        positions_[maker_user].total_buy_value += value;
    }
}

Position UserManager::get_position(long long user_id) const
{
    std::lock_guard<std::mutex> lk(mtx_);
    auto it = positions_.find(user_id);
    if (it != positions_.end())
        return it->second;
    return Position{};
}

std::vector<long long> UserManager::get_all_users() const
{
    std::lock_guard<std::mutex> lk(mtx_);
    return users_;
}
