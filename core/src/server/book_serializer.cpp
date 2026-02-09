#include "book_serializer.hpp"
#include <sstream>

std::string serialize_book_json(const OrderBook& book, int depth)
{
    std::ostringstream oss;
    oss << "{\"bids\":[";
    bool first = true;
    int i = 0;

    for (const auto& [price, q] : book.bids()) {
        if (i++ >= depth) break;
        long long qty = 0;
        for (const auto& o : q) qty += o.qty;

        if (!first) oss << ",";
        oss << "{\"price\":" << price << ",\"qty\":" << qty << ",\"orders\":[";
        bool first_order = true;
        for (const auto& o : q) {
            if (!first_order) oss << ",";
            oss << o.qty;
            first_order = false;
        }
        oss << "]}";
        first = false;
    }

    oss << "],\"asks\":[";
    first = true;
    i = 0;

    for (const auto& [price, q] : book.asks()) {
        if (i++ >= depth) break;
        long long qty = 0;
        for (const auto& o : q) qty += o.qty;

        if (!first) oss << ",";
        oss << "{\"price\":" << price << ",\"qty\":" << qty << ",\"orders\":[";
        bool first_order = true;
        for (const auto& o : q) {
            if (!first_order) oss << ",";
            oss << o.qty;
            first_order = false;
        }
        oss << "]}";
        first = false;
    }

    oss << "]}";
    return oss.str();
}

std::string serialize_orders_json(const OrderBook& book)
{
    std::ostringstream oss;
    oss << "[";
    bool first = true;

    // Bids
    for (const auto& [price, q] : book.bids()) {
        for (const auto& o : q) {
            if (!first) oss << ",";
            oss << "{\"id\":" << o.id
                << ",\"user_id\":" << o.user_id
                << ",\"side\":\"bid\""
                << ",\"price\":" << price
                << ",\"qty\":" << o.qty << "}";
            first = false;
        }
    }

    // Asks
    for (const auto& [price, q] : book.asks()) {
        for (const auto& o : q) {
            if (!first) oss << ",";
            oss << "{\"id\":" << o.id
                << ",\"user_id\":" << o.user_id
                << ",\"side\":\"ask\""
                << ",\"price\":" << price
                << ",\"qty\":" << o.qty << "}";
            first = false;
        }
    }

    oss << "]";
    return oss.str();
}
