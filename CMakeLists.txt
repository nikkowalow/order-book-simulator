cmake_minimum_required(VERSION 3.10)

project(OrderBookSimulator)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# If you want to include headers from src/ (like "book/order_book.hpp")
include_directories(src)

# Build core logic as a library (order book + matching engine)
add_library(core
    src/book/order_book.cpp
    src/engine/matching_engine.cpp
)

# Demo binary (your old single-process main)
add_executable(osmium
    src/main.cpp
)
target_link_libraries(osmium PRIVATE core)

# TCP server binary
add_executable(tcp_server
    src/server/tcp_server.cpp
)
target_link_libraries(tcp_server PRIVATE core)

# TCP client binary
add_executable(tcp_client
    src/server/tcp_client.cpp
)
target_link_libraries(tcp_client PRIVATE core)
