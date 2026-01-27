#include "http_handlers.hpp"

#include <atomic>
#include <cctype>
#include <sstream>

#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>

// -------- helpers --------

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

    if (!extract_string_field(body, "side", side_str)) return false;
    if (!extract_int_field(body, "price", price_ll)) return false;
    if (!extract_int_field(body, "qty", qty_ll)) return false;

    if (side_str != "BUY" && side_str != "SELL") return false;
    if (price_ll <= 0 || qty_ll <= 0) return false;

    out.side = (side_str == "BUY") ? Side::Buy : Side::Sell;
    out.price = static_cast<int>(price_ll);
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

std::string json_order_result(long long id, const std::vector<Trade>& trades) {
    std::ostringstream oss;
    oss << "{\"id\":" << id << ",\"trades\":[";
    bool first = true;
    for (const auto& t : trades) {
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
                          MatchingEngine& engine, std::mutex& book_mtx)
{
    // CORS preflight
    http.Options(".*", [](const httplib::Request &, httplib::Response &res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
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

        long long id = next_order_id++;
        Order o{.id = id, .side = r.side, .price = r.price, .qty = r.qty};

        std::vector<Trade> trades;
        {
            std::lock_guard<std::mutex> lk(book_mtx);
            trades = engine.process_limit_order(o);
        }

        res.set_content(json_order_result(id, trades), "application/json");
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
            ok = book.cancel_order(r.id);
        }

        res.set_content(json_ok(ok), "application/json");
    });

    // GET /book
    http.Get("/book", [&](const httplib::Request &, httplib::Response &res) {
        std::ostringstream oss;

        std::lock_guard<std::mutex> lk(book_mtx);

        oss << "{\"bids\":[";
        bool first = true;
        int depth = 20;
        int i = 0;

        for (const auto& [price, q] : book.bids()) {
            if (i++ >= depth) break;
            long long qty = 0;
            for (const auto& o : q) qty += o.qty;

            if (!first) oss << ",";
            oss << "{\"price\":" << price << ",\"qty\":" << qty << "}";
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
            oss << "{\"price\":" << price << ",\"qty\":" << qty << "}";
            first = false;
        }

        oss << "]}";

        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_content(oss.str(), "application/json");
    });
}
