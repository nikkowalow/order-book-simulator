#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <iostream>

namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;

int main() {
    try {
        net::io_context ioc;

        tcp::acceptor acceptor{ioc, {tcp::v4(), 9002}};
        std::cout << "WebSocket server listening on port 9002\n";

        tcp::socket socket{ioc};
        acceptor.accept(socket);

        websocket::stream<tcp::socket> ws{std::move(socket)};
        ws.accept();

        std::cout << "Client connected\n";

        while (true) {
            beast::flat_buffer buffer;

            ws.read(buffer);
            std::string msg = beast::buffers_to_string(buffer.data());

            std::cout << "Received: " << msg << std::endl;

            ws.text(ws.got_text());
            ws.write(buffer.data());
        }

    } catch (std::exception const& e) {
        std::cerr << "Error: " << e.what() << std::endl;
    }
}
