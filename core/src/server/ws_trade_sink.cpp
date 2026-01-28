#include "server/ws_trade_sink.hpp"

#include <iostream>
#include <sstream>

WsTradeSink::WsTradeSink(int port)
    : port_(port)
{
}

WsTradeSink::~WsTradeSink()
{
    stop();
}

void WsTradeSink::start()
{
    running_.store(true);
    accept_thread_ = std::thread(&WsTradeSink::accept_loop, this);
    std::cout << "WsTradeSink: listening on ws://localhost:" << port_ << "\n";
}

void WsTradeSink::stop()
{
    running_.store(false);

    // Unblock the acceptor by connecting to it
    {
        boost::system::error_code ec;
        tcp::socket sock(ioc_);
        sock.connect(tcp::endpoint(net::ip::make_address("127.0.0.1"), static_cast<unsigned short>(port_)), ec);
    }

    if (accept_thread_.joinable())
        accept_thread_.join();

    std::lock_guard<std::mutex> lk(clients_mtx_);
    for (auto &ws : clients_)
    {
        boost::system::error_code ec;
        ws->close(websocket::close_code::going_away, ec);
    }
    clients_.clear();
}

void WsTradeSink::accept_loop()
{
    try
    {
        tcp::acceptor acceptor(ioc_, tcp::endpoint(tcp::v4(), static_cast<unsigned short>(port_)));

        while (running_.load())
        {
            tcp::socket socket(ioc_);
            acceptor.accept(socket);

            if (!running_.load())
                break;

            try
            {
                auto ws = std::make_shared<WsStream>(std::move(socket));
                ws->accept();

                {
                    std::lock_guard<std::mutex> lk(clients_mtx_);
                    clients_.push_back(ws);
                }

                std::cout << "WsTradeSink: client connected\n";
            }
            catch (const std::exception &e)
            {
                std::cerr << "WsTradeSink: handshake failed: " << e.what() << "\n";
            }
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "WsTradeSink: accept_loop error: " << e.what() << "\n";
    }
}

void WsTradeSink::broadcast(const std::string &json)
{
    std::lock_guard<std::mutex> lk(clients_mtx_);
    for (auto it = clients_.begin(); it != clients_.end();)
    {
        boost::system::error_code ec;

        (*it)->text(true);
        (*it)->write(net::buffer(json), ec);

        if (ec)
        {
            std::cout << "WsTradeSink: client disconnected\n";
            it = clients_.erase(it);
        }
        else
        {
            ++it;
        }
    }
}

void WsTradeSink::on_trade(const Trade &trade)
{
    std::ostringstream oss;
    oss << "{\"type\":\"trade\""
        << ",\"seq\":" << trade.seq
        << ",\"trade_id\":" << trade.trade_id
        << ",\"price\":" << trade.price
        << ",\"qty\":" << trade.qty
        << ",\"maker\":" << trade.maker_id
        << ",\"taker\":" << trade.taker_id
        << ",\"ts\":" << trade.timestamp.count()
        << "}";
    broadcast(oss.str());
}
