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
#include <sim/seed_book.hpp>
#include <server/http_handlers.hpp>
#include <server/book_serializer.hpp>
#include <logging/journal_trade_sink.hpp>
#include <engine/multi_trade_sink.hpp>
#include <server/ws_trade_sink.hpp>
#include <market_maker/market_maker.hpp>

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

int main(int argc, char **argv)
{
    OrderBook book;
    seed_book(book);

    JournalTradeSink journal_sink("trades.jsonl");
    WsTradeSink ws_sink(9001);
    ws_sink.start();

    book.set_on_change([&ws_sink, &book]() {
        ws_sink.broadcast(serialize_book_json(book));
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

    // Legacy TCP echo server (port 9000)
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

    std::cout << "Server running: HTTP=8080, WS=9001, TCP=" << port << "\n";

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
                break;

            std::string msg(buf, buf + n);

            while (!msg.empty() && (msg.back() == '\n' || msg.back() == '\r'))
                msg.pop_back();

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
