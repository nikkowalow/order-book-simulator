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

using WsStream = websocket::stream<tcp::socket>;

class WsTradeSink : public TradeSink
{
public:
    explicit WsTradeSink(int port = 9001);
    ~WsTradeSink();

    void start();
    void stop();

    void on_trade(const Trade &trade) override;

    void broadcast(const std::string &json);

private:
    void accept_loop();

    int port_;
    std::atomic<bool> running_{false};
    std::thread accept_thread_;

    net::io_context ioc_;

    std::mutex clients_mtx_;
    std::vector<std::shared_ptr<WsStream>> clients_;
};
