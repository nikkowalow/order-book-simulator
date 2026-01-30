#pragma once

#include <string>
#include <book/order_book.hpp>

// Serialize the order book to JSON with individual order sizes
std::string serialize_book_json(const OrderBook& book, int depth = 20);
