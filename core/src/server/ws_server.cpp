#include "server/ws_server.hpp"
#include "http_handlers.hpp"
#include "user/user_manager.hpp"

#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>

#include <boost/beast/http.hpp>

#include <iostream>
#include <sstream>
#include <algorithm>
#include "book_serializer.hpp"

WsServer::WsServer(int port, OrderBook& book, MatchingEngine& engine,
                    std::mutex& book_mtx, UserManager& user_manager)
    : port_(port), book_(book), engine_(engine),
      book_mtx_(book_mtx), user_manager_(user_manager)
{
}

WsServer::~WsServer()
{
    stop();
}

void WsServer::start()
{
    running_.store(true);
    accept_thread_ = std::thread(&WsServer::accept_loop, this);
    std::cout << "WsServer: listening on ws://localhost:" << port_ << "\n";
}

void WsServer::stop()
{
    running_.store(false);

    // Unblock the acceptor
    {
        boost::system::error_code ec;
        tcp::socket sock(ioc_);
        sock.connect(tcp::endpoint(net::ip::make_address("127.0.0.1"),
                     static_cast<unsigned short>(port_)), ec);
    }

    if (accept_thread_.joinable())
        accept_thread_.join();

    std::lock_guard<std::mutex> lk(clients_mtx_);
    for (auto& c : clients_)
    {
        boost::system::error_code ec;
        c->ws->close(websocket::close_code::going_away, ec);
    }
    clients_.clear();
}

void WsServer::accept_loop()
{
    try
    {
        tcp::acceptor acceptor(ioc_, tcp::endpoint(tcp::v4(),
                               static_cast<unsigned short>(port_)));

        while (running_.load())
        {
            tcp::socket socket(ioc_);
            acceptor.accept(socket);

            if (!running_.load())
                break;

            try
            {
                beast::flat_buffer http_buf;
                beast::http::request<beast::http::empty_body> http_req;
                beast::http::read(socket, http_buf, http_req);

                long long reclaim_uid = 0;
                std::string target(http_req.target());
                auto q = target.find('?');
                if (q != std::string::npos) {
                    std::string qs = target.substr(q + 1);
                    auto key = qs.find("userId=");
                    if (key != std::string::npos) {
                        try {
                            reclaim_uid = std::stoll(qs.substr(key + 7));
                        } catch (...) {}
                    }
                }

                auto ws = std::make_shared<WsStream>(std::move(socket));
                ws->accept(http_req);

                long long user_id = user_manager_.reconnect_user(reclaim_uid);

                auto client = std::make_shared<Client>();
                client->ws = ws;
                client->user_id = user_id;

                {
                    std::lock_guard<std::mutex> lk(clients_mtx_);
                    clients_.push_back(client);
                }

                bool reconnected = (reclaim_uid > 0 && reclaim_uid == user_id);
                std::ostringstream session_msg;
                session_msg << "{\"type\":\"session\",\"userId\":" << user_id
                            << ",\"reconnected\":" << (reconnected ? "true" : "false") << "}";
                send_to_client(*client, session_msg.str());

                {
                    std::lock_guard<std::mutex> lk(book_mtx_);
                    std::string snapshot = serialize_book_json(book_);
                    send_to_client(*client, snapshot);
                }

                {
                    std::lock_guard<std::mutex> lk(book_mtx_);
                    std::string orders = serialize_orders_json(book_);
                    send_to_client(*client, orders);
                }

                std::cout << "WsServer: client connected (user_id=" << user_id << ")\n";

                std::thread(&WsServer::handle_client, this, client).detach();
            }
            catch (const std::exception& e)
            {
                std::cerr << "WsServer: handshake failed: " << e.what() << "\n";
            }
        }
    }
    catch (const std::exception& e)
    {
        std::cerr << "WsServer: accept_loop error: " << e.what() << "\n";
    }
}

void WsServer::handle_client(std::shared_ptr<Client> client)
{
    try
    {
        while (running_.load())
        {
            beast::flat_buffer buffer;
            client->ws->read(buffer);

            std::string msg = beast::buffers_to_string(buffer.data());
            std::string response = process_message(msg, client->user_id);

            send_to_client(*client, response);
        }
    }
    catch (const beast::system_error& e)
    {
        if (e.code() != websocket::error::closed)
        {
            std::cerr << "WsServer: client error: " << e.what() << "\n";
        }
    }
    catch (const std::exception& e)
    {
        std::cerr << "WsServer: client error: " << e.what() << "\n";
    }

    std::cout << "WsServer: client disconnected (user_id=" << client->user_id << ")\n";
    remove_client(client);
}

void WsServer::send_to_client(Client& client, const std::string& msg)
{
    std::lock_guard<std::mutex> lk(client.write_mtx);
    boost::system::error_code ec;
    client.ws->text(true);
    client.ws->write(net::buffer(msg), ec);
}

void WsServer::remove_client(std::shared_ptr<Client> client)
{
    std::lock_guard<std::mutex> lk(clients_mtx_);
    clients_.erase(
        std::remove(clients_.begin(), clients_.end(), client),
        clients_.end());
}

void WsServer::broadcast(const std::string& json)
{
    std::lock_guard<std::mutex> lk(clients_mtx_);
    for (auto it = clients_.begin(); it != clients_.end();)
    {
        auto& client = *it;
        std::lock_guard<std::mutex> wlk(client->write_mtx);
        boost::system::error_code ec;

        client->ws->text(true);
        client->ws->write(net::buffer(json), ec);

        if (ec)
        {
            std::cout << "WsServer: client dropped during broadcast\n";
            it = clients_.erase(it);
        }
        else
        {
            ++it;
        }
    }
}

void WsServer::on_trade(const Trade& trade)
{
    std::ostringstream oss;
    oss << "{\"type\":\"trade\""
        << ",\"seq\":" << trade.seq
        << ",\"trade_id\":" << trade.trade_id
        << ",\"price\":" << trade.price
        << ",\"qty\":" << trade.qty
        << ",\"maker\":" << trade.maker_id
        << ",\"taker\":" << trade.taker_id
        << ",\"maker_user\":" << trade.maker_user_id
        << ",\"taker_user\":" << trade.taker_user_id
        << ",\"ts\":" << trade.timestamp.count()
        << "}";
    broadcast(oss.str());
}

std::string WsServer::process_message(const std::string& msg, long long user_id)
{
    
    std::cout << "(WEBSOCKET) Processing message from user " << user_id << ": " << msg << "\n";
    auto find_string = [&](const char* key) -> std::string {
        std::string k = "\"";
        k += key;
        k += "\"";
        auto pos = msg.find(k);
        if (pos == std::string::npos) return "";
        auto colon = msg.find(':', pos);
        if (colon == std::string::npos) return "";
        auto q1 = msg.find('"', colon);
        if (q1 == std::string::npos) return "";
        auto q2 = msg.find('"', q1 + 1);
        if (q2 == std::string::npos) return "";
        return msg.substr(q1 + 1, q2 - q1 - 1);
    };

    std::string action = find_string("action");
    std::string request_id = find_string("requestId");

    auto with_request_id = [&](std::string json) -> std::string {
        if (request_id.empty()) return json;
        return "{\"requestId\":\"" + request_id + "\"," + json.substr(1);
    };

    if (action == "order")
    {
        OrderRequest req;
        if (!parse_order_json(msg, req))
            return with_request_id(json_error("Invalid order"));

        long long id = engine_.next_order_id();
        Order o{.id = id, .user_id = user_id, .side = req.side,
                .price = req.price, .qty = req.qty, .type = req.type};

        OrderResult result;
        {
            std::lock_guard<std::mutex> lk(book_mtx_);
            result = engine_.process_order(o);
        }

        return with_request_id(json_order_result(result));
    }
    else if (action == "cancel")
    {
        CancelRequest req;
        if (!parse_cancel_json(msg, req))
            return with_request_id(json_error("Invalid cancel request"));

        long long owner = user_manager_.get_user_for_order(req.id);
        if (owner != user_id)
            return with_request_id(json_error("Not your order"));

        bool ok;
        {
            std::lock_guard<std::mutex> lk(book_mtx_);
            ok = engine_.cancel_order(req.id);
        }

        return with_request_id(json_ok(ok));
    }
    else
    {
        return with_request_id(json_error("Unknown action. Use 'order' or 'cancel'"));
    }
}
