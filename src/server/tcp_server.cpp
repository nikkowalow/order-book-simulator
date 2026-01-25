#include <iostream>
#include <string>
#include <cstring>

#include <unistd.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>
#include <types/types.hpp>
#include <sstream>

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
    MatchingEngine engine(book);

    book.add_resting_order(Order{.id = 101, .side = Side::Buy, .price = 99, .qty = 10});
    book.add_resting_order(Order{.id = 102, .side = Side::Buy, .price = 99, .qty = 5});
    book.add_resting_order(Order{.id = 201, .side = Side::Sell, .price = 101, .qty = 7});
    book.add_resting_order(Order{.id = 202, .side = Side::Sell, .price = 102, .qty = 12});

    book.print_book(std::cout);

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

    std::cout << "Server listening on port " << port << "\n";
    std::cout << "Waiting for a client...\n";

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

        std::cout << "Client connected\n";

        char buf[1024];

        while (true)
        {
            std::memset(buf, 0, sizeof(buf));
            ssize_t n = recv(client_fd, buf, sizeof(buf) - 1, 0);

            if (n <= 0)
            {
                std::cout << "Client disconnected\n";
                break; // break inner loop only
            }

            std::string msg(buf, buf + n);

            // trim newline
            while (!msg.empty() && (msg.back() == '\n' || msg.back() == '\r'))
            {
                msg.pop_back();
            }

            std::cout << "Received: " << msg << "\n";
            if (msg == "PRINT")
            {
                book.print_book(std::cout);

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

                // Send trades back
                for (const auto &t : trades)
                {
                    std::string tr = "TRADE price=" + std::to_string(t.price) +
                                     " qty=" + std::to_string(t.qty) +
                                     " maker=" + std::to_string(t.maker_id) +
                                     " taker=" + std::to_string(t.taker_id) + "\n";
                    send_all(client_fd, tr);
                }

                // Print book on server for debugging
                book.print_book(std::cout);

                // Send best quote snapshot back
                send_best_quote(client_fd, book);

                continue;
            }
            long long cancel_id;
            if (parse_cancel_line(msg, cancel_id))
            {
                bool ok = book.cancel_order(cancel_id);
                send_all(client_fd, ok ? "ACK CANCEL OK\n" : "ACK CANCEL NOT_FOUND\n");
                book.print_book(std::cout);
                continue;
            }
        }

        close(client_fd);
        std::cout << "Waiting for a client...\n";
    }

    close(server_fd);
    return 0;
}
