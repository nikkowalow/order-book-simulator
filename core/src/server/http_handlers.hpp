#pragma once

#include <string>
#include <vector>

#include <types/types.hpp> // Order, Side, Trade

// Minimal request DTOs (server-layer)
struct OrderRequest {
    Side side;
    int price;
    long long qty;
};

struct CancelRequest {
    long long id;
};

// Parse JSON bodies (very small/naive parsing, same logic you had)
bool parse_order_json(const std::string& body, OrderRequest& out);
bool parse_cancel_json(const std::string& body, CancelRequest& out);

// Build JSON responses
std::string json_error(const std::string& msg);
std::string json_ok(bool ok);
std::string json_order_result(long long id, const std::vector<Trade>& trades);
