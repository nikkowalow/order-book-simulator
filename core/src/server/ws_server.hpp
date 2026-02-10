#pragma once

#include <engine/trade_sink.hpp>

#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/ip/tcp.hpp>

#include <vector>
#include <memory>
#include <mutex>
#include <thread>
#include <atomic>

namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;

class OrderBook;
class MatchingEngine;
class UserManager;

class WsServer : public TradeSink
{
public:
    WsServer(int port, OrderBook& book, MatchingEngine& engine,
             std::mutex& book_mtx, UserManager& user_manager);
    ~WsServer();

    void start();
    void stop();

    // TradeSink: broadcast trade events to all clients
    void on_trade(const Trade& trade) override;

    // Broadcast arbitrary JSON to all clients (used for book updates)
    void broadcast(const std::string& json);

private:
    using WsStream = websocket::stream<tcp::socket>;

    struct Client {
        std::shared_ptr<WsStream> ws;
        long long user_id;
        std::mutex write_mtx; // serializes writes (broadcasts vs responses)
    };

    void accept_loop();
    void handle_client(std::shared_ptr<Client> client);
    std::string process_message(const std::string& msg, long long user_id);
    void send_to_client(Client& client, const std::string& msg);
    void remove_client(std::shared_ptr<Client> client);

    int port_;
    OrderBook& book_;
    MatchingEngine& engine_;
    std::mutex& book_mtx_;
    UserManager& user_manager_;

    std::atomic<bool> running_{false};
    std::thread accept_thread_;
    net::io_context ioc_;

    std::mutex clients_mtx_;
    std::vector<std::shared_ptr<Client>> clients_;
};
