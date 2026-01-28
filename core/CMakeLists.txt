cmake_minimum_required(VERSION 3.10)

project(OrderBookSimulator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ------------------------
# Core library
# ------------------------
add_library(core
    src/book/order_book.cpp
    src/engine/matching_engine.cpp
    src/sim/seed_book.cpp
    utils/scoped_timer.cpp
)

target_include_directories(core
    PUBLIC
        ${CMAKE_SOURCE_DIR}/src
        ${CMAKE_SOURCE_DIR}/external/tabulate/include
)

# ------------------------
# Main demo binary
# ------------------------
add_executable(osmium
    src/main.cpp
)

target_link_libraries(osmium PRIVATE core)

# ------------------------
# TCP server
# ------------------------
add_executable(tcp_server
    src/server/tcp_server.cpp
    src/server/http_handlers.cpp
    src/logging/journal_trade_sink.cpp
)

target_include_directories(tcp_server PRIVATE
    ${CMAKE_SOURCE_DIR}/external/httplib
)

target_link_libraries(tcp_server PRIVATE core)

# ------------------------
# TCP client
# ------------------------
add_executable(tcp_client
    src/server/tcp_client.cpp
)

target_link_libraries(tcp_client PRIVATE core)

# ------------------------
# Tests
# ------------------------
find_package(Catch2 3 REQUIRED)

add_executable(tests
    tests/test_main.cpp
    # tests/test_matching_engine.cpp
    # tests/test_order_book.cpp
)

target_link_libraries(tests PRIVATE core Catch2::Catch2WithMain)
