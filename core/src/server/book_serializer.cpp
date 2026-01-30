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
