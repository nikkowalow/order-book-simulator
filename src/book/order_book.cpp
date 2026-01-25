#include "order_book.hpp"

void OrderBook::add_resting_order(const Order &o)
{
    if (o.qty <= 0)
        return;

    // Reject duplicate IDs (simple rule for now)
    if (index_.find(o.id) != index_.end())
    {
        return;
    }

    if (o.side == Side::Buy)
    {
        auto &level = bids_[o.price];
        level.push_back(o);
        auto it = std::prev(level.end());

        index_[o.id] = Locator{
            .side = Side::Buy,
            .price = o.price,
            .it = it};
    }
    else
    {
        auto &level = asks_[o.price];
        level.push_back(o);
        auto it = std::prev(level.end());

        index_[o.id] = Locator{
            .side = Side::Sell,
            .price = o.price,
            .it = it};
    }
}

bool OrderBook::cancel_order(long long order_id)
{
    auto it = index_.find(order_id);
    if (it == index_.end())
        return false;

    Locator loc = it->second;

    if (loc.side == Side::Buy)
    {
        auto lvl = bids_.find(loc.price);
        if (lvl != bids_.end())
        {
            lvl->second.erase(loc.it);
            if (lvl->second.empty())
            {
                bids_.erase(lvl);
            }
        }
    }
    else
    {
        auto lvl = asks_.find(loc.price);
        if (lvl != asks_.end())
        {
            lvl->second.erase(loc.it);
            if (lvl->second.empty())
            {
                asks_.erase(lvl);
            }
        }
    }

    index_.erase(it);
    return true;
}

std::optional<int> OrderBook::best_bid() const
{
    if (bids_.empty())
        return std::nullopt;
    return bids_.begin()->first;
}

std::optional<int> OrderBook::best_ask() const
{
    if (asks_.empty())
        return std::nullopt;
    return asks_.begin()->first;
}

std::list<Order> *OrderBook::best_bid_queue()
{
    if (bids_.empty())
        return nullptr;
    return &bids_.begin()->second;
}

std::list<Order> *OrderBook::best_ask_queue()
{
    if (asks_.empty())
        return nullptr;
    return &asks_.begin()->second;
}

void OrderBook::cleanup_best_bid_level_if_empty()
{
    if (bids_.empty())
        return;
    if (bids_.begin()->second.empty())
    {
        bids_.erase(bids_.begin());
    }
}

void OrderBook::cleanup_best_ask_level_if_empty()
{
    if (asks_.empty())
        return;
    if (asks_.begin()->second.empty())
    {
        asks_.erase(asks_.begin());
    }
}

void OrderBook::print_book(std::ostream &os) const
{
    os << "\n========== ORDER BOOK ==========\n";

    os << "ASKS (Sell)  [low -> high]\n";
    if (asks_.empty())
    {
        os << "  (empty)\n";
    }
    else
    {
        for (const auto &[price, q] : asks_)
        {
            long long level_qty = 0;
            for (const auto &o : q)
                level_qty += o.qty;

            os << "  " << price << " | total=" << level_qty << " | ";
            for (const auto &o : q)
            {
                os << "(id=" << o.id << ",qty=" << o.qty << ") ";
            }
            os << "\n";
        }
    }

    os << "-------------------------------\n";

    os << "BIDS (Buy)   [high -> low]\n";
    if (bids_.empty())
    {
        os << "  (empty)\n";
    }
    else
    {
        for (const auto &[price, q] : bids_)
        {
            long long level_qty = 0;
            for (const auto &o : q)
                level_qty += o.qty;

            os << "  " << price << " | total=" << level_qty << " | ";
            for (const auto &o : q)
            {
                os << "(id=" << o.id << ",qty=" << o.qty << ") ";
            }
            os << "\n";
        }
    }

    os << "================================\n";
}
