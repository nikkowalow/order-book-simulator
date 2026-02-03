#include "http_handlers.hpp"
#include "book_serializer.hpp"

#include <atomic>
#include <cctype>
#include <sstream>

#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>
#include <market_maker/market_maker.hpp>
#include <fstream>
#include <deque>

// -------- helpers --------
static std::string read_last_trades_jsonl(
    const std::string& path,
    size_t limit
) {
    std::ifstream file(path);
    std::string line;

    std::deque<std::string> buffer;

    while (std::getline(file, line)) {
        if (line.empty()) continue;

        buffer.push_back(line);
        if (buffer.size() > limit) {
            buffer.pop_front();
        }
    }

    // build JSON array (newest first)
    std::ostringstream oss;
    oss << "[";

    bool first = true;
    for (auto it = buffer.rbegin(); it != buffer.rend(); ++it) {
        if (!first) oss << ",";
        oss << *it;   // already JSON
        first = false;
    }

    oss << "]";
    return oss.str();
}


static bool extract_string_field(const std::string& body, const char* key, std::string& out) {
    std::string k = "\"";
    k += key;
    k += "\"";

    auto pos = body.find(k);
    if (pos == std::string::npos) return false;

    auto colon = body.find(':', pos);
    if (colon == std::string::npos) return false;

    auto q1 = body.find('"', colon);
    if (q1 == std::string::npos) return false;

    auto q2 = body.find('"', q1 + 1);
    if (q2 == std::string::npos) return false;

    out = body.substr(q1 + 1, q2 - q1 - 1);
    return true;
}

static bool extract_int_field(const std::string& body, const char* key, long long& out) {
    std::string k = "\"";
    k += key;
    k += "\"";

    auto pos = body.find(k);
    if (pos == std::string::npos) return false;

    auto colon = body.find(':', pos);
    if (colon == std::string::npos) return false;

    // parse a non-negative integer
    std::string num;
    for (size_t i = colon + 1; i < body.size(); ++i) {
        unsigned char c = static_cast<unsigned char>(body[i]);
        if (std::isdigit(static_cast<unsigned char>(c))) {
            num += static_cast<char>(c);
        } else if (!num.empty()) {
            break;
        }
    }
    if (num.empty()) return false;

    out = std::stoll(num);
    return true;
}

// -------- public API --------

bool parse_order_json(const std::string& body, OrderRequest& out) {
    std::string side_str;
    long long price_ll = 0;
    long long qty_ll = 0;
    std::string type_str = "LIMIT";

    if (!extract_string_field(body, "side", side_str)) return false;
    if (!extract_int_field(body, "qty", qty_ll)) return false;
    extract_string_field(body, "type", type_str); // optional, defaults to LIMIT

    if (side_str != "BUY" && side_str != "SELL") return false;
    if (qty_ll <= 0) return false;

    if (type_str == "MARKET") {
        out.type = OrderType::Market;
        out.price = 0; 
    } else if (type_str == "LIMIT") {
        out.type = OrderType::Limit;
        if (!extract_int_field(body, "price", price_ll)) return false;
        if (price_ll <= 0) return false;
        out.price = static_cast<int>(price_ll);
    } else {
        return false;
    }

    out.side = (side_str == "BUY") ? Side::Buy : Side::Sell;
    out.qty = qty_ll;
    return true;
}

bool parse_cancel_json(const std::string& body, CancelRequest& out) {
    long long id = 0;
    if (!extract_int_field(body, "id", id)) return false;
    if (id <= 0) return false;
    out.id = id;
    return true;
}

std::string json_error(const std::string& msg) {
    std::ostringstream oss;
    oss << "{\"error\":\"";
    for (char c : msg) {
        if (c == '"' || c == '\\') oss << '\\';
        oss << c;
    }
    oss << "\"}";
    return oss.str();
}

std::string json_ok(bool ok) {
    return ok ? "{\"ok\":true}" : "{\"ok\":false}";
}

static const char* status_to_string(OrderStatus status) {
    switch (status) {
        case OrderStatus::New: return "NEW";
        case OrderStatus::PartiallyFilled: return "PARTIALLY_FILLED";
        case OrderStatus::Filled: return "FILLED";
        case OrderStatus::Canceled: return "CANCELED";
        case OrderStatus::Rejected: return "REJECTED";
    }
    return "UNKNOWN";
}

std::string json_order_result(const OrderResult& result) {
    std::ostringstream oss;
    oss << "{\"id\":" << result.id
        << ",\"status\":\"" << status_to_string(result.status) << "\""
        << ",\"originalQty\":" << result.original_qty
        << ",\"filledQty\":" << result.filled_qty
        << ",\"remainingQty\":" << result.remaining_qty
        << ",\"trades\":[";
    bool first = true;
    for (const auto& t : result.trades) {
        if (!first) oss << ",";
        oss << "{\"price\":" << t.price << ",\"qty\":" << t.qty
            << ",\"maker\":" << t.maker_id << ",\"taker\":" << t.taker_id << "}";
        first = false;
    }
    oss << "]}";
    return oss.str();
}

// -------- route registration --------

static std::atomic<long long> next_order_id{1000};

void register_http_routes(httplib::Server& http, OrderBook& book,
                          MatchingEngine& engine, std::mutex& book_mtx,
                          MarketMaker* market_maker)
{
    // CORS preflight
    http.Options(".*", [](const httplib::Request &, httplib::Response &res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
    });

    http.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("ok", "text/plain");
    }); 

    // POST /order
    http.Post("/order", [&](const httplib::Request &req, httplib::Response &res) {

        res.set_header("Access-Control-Allow-Origin", "*");

        OrderRequest r;
        if (!parse_order_json(req.body, r)) {
            res.status = 400;
            res.set_content(json_error("Invalid order"), "application/json");
            return;
        }

        long long id = engine.next_order_id();
        Order o{.id = id, .side = r.side, .price = r.price, .qty = r.qty, .type = r.type};

        OrderResult result;
        {
            std::lock_guard<std::mutex> lk(book_mtx);
            result = engine.process_order(o);
        }

        res.set_content(json_order_result(result), "application/json");
    });

    // POST /cancel
    http.Post("/cancel", [&](const httplib::Request &req, httplib::Response &res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        CancelRequest r;
        if (!parse_cancel_json(req.body, r)) {
            res.status = 400;
            res.set_content(json_error("Invalid id"), "application/json");
            return;
        }

        bool ok = false;
        {
            std::lock_guard<std::mutex> lk(book_mtx);
            ok = engine.cancel_order(r.id);
        }

        res.set_content(json_ok(ok), "application/json");
    });

    // GET /book
    http.Get("/book", [&](const httplib::Request &, httplib::Response &res) {
        std::lock_guard<std::mutex> lk(book_mtx);
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_content(serialize_book_json(book), "application/json");
    });
    
    http.Get("/trades", [&](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        size_t limit = 100;
        if (req.has_param("limit")) {
            limit = std::stoul(req.get_param_value("limit"));
            if (limit == 0) limit = 100;
            if (limit > 1000) limit = 1000; 
        }

        std::string body = read_last_trades_jsonl("trades.jsonl", limit);
        res.set_content(body, "application/json");
    });

    http.Get("/activity", [&](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        size_t limit = 100;
        if (req.has_param("limit")) {
            limit = std::stoul(req.get_param_value("limit"));
            if (limit == 0) limit = 100;
            if (limit > 1000) limit = 1000;
        }

        std::string body = read_last_trades_jsonl("orders.jsonl", limit);
        res.set_content(body, "application/json");
    });

    http.Get("/orders", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lk(book_mtx);
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_content(serialize_orders_json(book), "application/json");
    });

    // Market maker endpoints
    if (market_maker) {
        http.Post("/market_maker/toggle", [market_maker](const httplib::Request&, httplib::Response& res) {
            res.set_header("Access-Control-Allow-Origin", "*");
            bool running = market_maker->toggle();
            std::ostringstream oss;
            oss << "{\"running\":" << (running ? "true" : "false") << "}";
            res.set_content(oss.str(), "application/json");
        });

        http.Get("/market_maker/status", [market_maker](const httplib::Request&, httplib::Response& res) {
            res.set_header("Access-Control-Allow-Origin", "*");
            bool running = market_maker->is_running();
            std::ostringstream oss;
            oss << "{\"running\":" << (running ? "true" : "false") << "}";
            res.set_content(oss.str(), "application/json");
        });
    }
}

