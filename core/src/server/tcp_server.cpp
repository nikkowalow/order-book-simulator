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
#include <sim/seed_book.hpp>
#include <server/http_handlers.hpp>
#include <logging/journal_trade_sink.hpp>
#include <engine/multi_trade_sink.hpp>
#include <server/ws_trade_sink.hpp>
#include <market_maker/market_maker.hpp>

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

    JournalTradeSink journal_sink("trades.jsonl");
    WsTradeSink ws_sink(9001);
    ws_sink.start();

    book.set_on_change([&ws_sink, &book]() {
        std::ostringstream oss;
        oss << "{\"bids\":[";
        bool first = true;
        int depth = 20;
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
        ws_sink.broadcast(oss.str());
    });

    MultiTradeSink multi_sink;
    multi_sink.add_sink(&journal_sink);
    multi_sink.add_sink(&ws_sink);

    MatchingEngine engine(book, &multi_sink);
    std::mutex book_mtx;

    MarketMaker mm(book, engine, book_mtx);
    // mm.start();

    httplib::Server http;
    register_http_routes(http, book, engine, book_mtx);

    std::thread http_thread([&]()
                            { http.listen("0.0.0.0", 8080); });
    http_thread.detach();

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
            std::string reply = "SERVER_ECHO: " + msg + "\n";
            if (!send_all(client_fd, reply))
            {
                std::cout << "Send failed\n";
                break;
            }
        }

        close(client_fd);
    }

    close(server_fd);
    return 0;
}
