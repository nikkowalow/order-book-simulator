#pragma once

#include <string>
#include <vector>
#include <mutex>

#include <types/types.hpp>
#include "httplib.hpp"

class OrderBook;
class MatchingEngine;
class MarketMaker;
class UserManager;

struct OrderRequest {
    Side side;
    OrderType type;
    int price;
    long long qty;
};

struct CancelRequest {
    long long id;
};

bool parse_order_json(const std::string& body, OrderRequest& out);
bool parse_cancel_json(const std::string& body, CancelRequest& out);

std::string json_error(const std::string& msg);
std::string json_ok(bool ok);
std::string json_order_result(const OrderResult& result);

void register_http_routes(httplib::Server& http, OrderBook& book,
                          MatchingEngine& engine, std::mutex& book_mtx,
                          MarketMaker* market_maker = nullptr,
                          UserManager* user_manager = nullptr);
