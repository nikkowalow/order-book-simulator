#include <iostream>
#include <string>
#include <cstring>
#include "httplib.hpp"
#include <mutex>
#include <thread>
#include <unistd.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>
#include <types/types.hpp>
#include <sstream>
#include <atomic>
#include <sim/seed_book.hpp>
#include <server/http_handlers.hpp>


static std::atomic<long long> next_order_id{1000};

static size_t count_lines(const std::string &s)
{
    size_t n = 0;
    for (char c : s)
        if (c == '\n')
            ++n;
    if (!s.empty() && s.back() != '\n')
        ++n;
    return n;
}

static void move_cursor_up(size_t lines)
{
    if (lines == 0)
        return;
    // Same as repeating \033[F N times, but more efficient
    std::cout << "\033[" << lines << "F";
}

static std::string render_book_frame(const OrderBook &book)
{
    std::ostringstream oss;
    book.print_book(oss);
    return oss.str();
}

static bool parse_cancel_line(const std::string &line, long long &order_id)
{
    std::istringstream iss(line);
    std::string cmd;
    iss >> cmd;
    if (cmd != "CANCEL")
        return false;
    iss >> order_id;
    return !iss.fail();
}

static bool send_all(int fd, const std::string &msg)
{
    const char *data = msg.c_str();
    size_t total = 0;
    size_t len = msg.size();

    while (total < len)
    {
        ssize_t n = send(fd, data + total, len - total, 0);
        if (n <= 0)
            return false;
        total += static_cast<size_t>(n);
    }
    return true;
}

static void send_best_quote(int client_fd, const OrderBook &book)
{
    auto bb = book.best_bid();
    auto ba = book.best_ask();

    std::string out = "BOOK BEST_BID ";
    out += bb ? std::to_string(*bb) : "NONE";
    out += " BEST_ASK ";
    out += ba ? std::to_string(*ba) : "NONE";
    out += "\n";

    send_all(client_fd, out);
}

static bool parse_order_line(const std::string &line, Order &out)
{
    std::istringstream iss(line);

    std::string side_str;
    long long id;
    int price;
    long long qty;

    iss >> side_str;

    if (side_str != "BUY" && side_str != "SELL")
    {
        return false;
    }

    iss >> id >> price >> qty;
    if (iss.fail())
        return false;

    out.id = id;
    out.side = (side_str == "BUY") ? Side::Buy : Side::Sell;
    out.price = price;
    out.qty = qty;

    return true;
}

int main(int argc, char **argv)
{

    OrderBook book;
    seed_book(book);
    MatchingEngine engine(book);
    std::mutex book_mtx;

    httplib::Server http;

    // CORS preflight
    http.Options(".*", [](const httplib::Request &, httplib::Response &res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
    });

    // POST /order - submit a limit order
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

    // POST /cancel - cancel an order by id
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

    http.Get("/book", [&](const httplib::Request &, httplib::Response &res)
             {
    std::ostringstream oss;

    std::lock_guard<std::mutex> lk(book_mtx);

    oss << "{ \"bids\": [";
    bool first = true;

    // OPTIONAL: limit depth to keep payload small
    int depth = 20;
    int i = 0;

    for (const auto& [price, q] : book.bids()) {
        if (i++ >= depth) break;
        long long qty = 0;
        for (const auto& o : q) qty += o.qty;

        if (!first) oss << ","; 
        oss << "{ \"price\": " << price << ", \"qty\": " << qty << " }";
        first = false;
    }

    oss << "], \"asks\": [";
    first = true;
    i = 0;

    for (const auto& [price, q] : book.asks()) {
        if (i++ >= depth) break;
        long long qty = 0;
        for (const auto& o : q) qty += o.qty;

        if (!first) oss << ",";
        oss << "{ \"price\": " << price << ", \"qty\": " << qty << " }";
        first = false;
    }

    oss << "] }";

    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_content(oss.str(), "application/json"); });

    std::thread http_thread([&]()
                            { http.listen("0.0.0.0", 8080); });
    http_thread.detach();

    size_t last_book_lines = 0;

    // initial draw
    {
        auto frame = render_book_frame(book);
        std::cout << frame << std::flush;
        last_book_lines = count_lines(frame);
    }

    int port = 9000;
    if (argc >= 2)
        port = std::stoi(argv[1]);

    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0)
    {
        std::cerr << "socket() failed\n";
        return 1;
    }

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(static_cast<uint16_t>(port));

    if (bind(server_fd, (sockaddr *)&addr, sizeof(addr)) < 0)
    {
        std::cerr << "bind() failed\n";
        return 1;
    }

    if (listen(server_fd, 16) < 0)
    {
        std::cerr << "listen() failed\n";
        return 1;
    }

    while (true)
    {
        // r.draw(render_book_frame(book));
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);

        int client_fd = accept(server_fd, (sockaddr *)&client_addr, &client_len);
        if (client_fd < 0)
        {
            std::cerr << "accept() failed\n";
            continue;
        }

        char buf[1024];

        while (true)
        {
            std::memset(buf, 0, sizeof(buf));
            ssize_t n = recv(client_fd, buf, sizeof(buf) - 1, 0);

            if (n <= 0)
            {
                break; // break inner loop only
            }

            std::string msg(buf, buf + n);

            // trim newline
            while (!msg.empty() && (msg.back() == '\n' || msg.back() == '\r'))
            {
                msg.pop_back();
            }

            // std::cout << "Received: " << msg << "\n";
            if (msg == "PRINT")
            {
                // book.print_book(std::cout);

                // also send something back to the client so it sees a response
                send_all(client_fd, "OK PRINTED\n");
                continue;
            }
            if (msg == "QUIT")
            {
                send_all(client_fd, "BYE\n");
                std::cout << "Client quit\n";
                break; // break inner loop only
            }

            std::string reply = "SERVER_ECHO: " + msg + "\n";
            if (!send_all(client_fd, reply))
            {
                std::cout << "Send failed\n";
                break;
            }
            Order o;
            if (parse_order_line(msg, o))
            {
                // ACK
                send_all(client_fd, "ACK " + std::to_string(o.id) + "\n");

                // Match and execute
                auto trades = engine.process_limit_order(o);

                {
                    std::lock_guard<std::mutex> lk(book_mtx);
                    trades = engine.process_limit_order(o);
                }

                for (const auto &t : trades)
                {
                    std::string tr = "TRADE price=" + std::to_string(t.price) +
                                     " qty=" + std::to_string(t.qty) +
                                     " maker=" + std::to_string(t.maker_id) +
                                     " taker=" + std::to_string(t.taker_id) + "\n";
                    send_all(client_fd, tr);
                }
                {
                    std::lock_guard<std::mutex> lk(book_mtx);
                    book.print_book(std::cout);
                }
                // Print book on server for debugging
                // book.print_book(std::cout);
                auto frame = render_book_frame(book);
                std::cout << frame << std::flush;
                move_cursor_up(last_book_lines);
                last_book_lines = count_lines(frame);

                // Send best quote snapshot back
                send_best_quote(client_fd, book);

                continue;
            }
            long long cancel_id;
            if (parse_cancel_line(msg, cancel_id))
            {
                bool ok;
                {
                    std::lock_guard<std::mutex> lk(book_mtx);
                    ok = book.cancel_order(cancel_id);
                }
                send_all(client_fd, ok ? "ACK CANCEL OK\n" : "ACK CANCEL NOT_FOUND\n");

                {
                    std::lock_guard<std::mutex> lk(book_mtx);
                    book.print_book(std::cout);
                }
                continue;
            }
        }

        close(client_fd);
    }

    close(server_fd);
    return 0;
}
