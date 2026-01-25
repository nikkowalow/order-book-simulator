#include <iostream>
#include <string>
#include <cstring>

#include <unistd.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <arpa/inet.h>

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
    std::string host = "127.0.0.1";
    int port = 9000;

    if (argc >= 2)
        host = argv[1];
    if (argc >= 3)
        port = std::stoi(argv[2]);

    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0)
    {
        std::cerr << "socket() failed\n";
        return 1;
    }

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<uint16_t>(port));

    if (inet_pton(AF_INET, host.c_str(), &addr.sin_addr) <= 0)
    {
        std::cerr << "inet_pton() failed\n";
        return 1;
    }

    if (connect(fd, (sockaddr *)&addr, sizeof(addr)) < 0)
    {
        std::cerr << "connect() failed\n";
        return 1;
    }

    std::cout << "Connected to " << host << ":" << port << "\n";
    std::cout << "Commands: BUY id price qty | SELL id price qty | PRINT | QUIT\n\n";

    std::string line;
    while (true)
    {
        std::cout << "> ";
        if (!std::getline(std::cin, line))
            break;

        if (line.empty())
            continue;
        line.push_back('\n');

        if (!send_all(fd, line))
        {
            std::cerr << "send failed\n";
            break;
        }

        // Read server response (simple)
        char buf[1024];
        std::memset(buf, 0, sizeof(buf));
        ssize_t n = recv(fd, buf, sizeof(buf) - 1, 0);

        if (n <= 0)
        {
            std::cerr << "server disconnected\n";
            break;
        }

        std::cout << buf;

        if (line == "QUIT\n")
            break;
    }

    close(fd);
    return 0;
}
