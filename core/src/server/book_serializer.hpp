#pragma once

#include <string>
#include <book/order_book.hpp>

// Serialize the order book to JSON with individual order sizes
std::string serialize_book_json(const OrderBook& book, int depth = 20);

// Serialize all resting orders as a flat array
std::string serialize_orders_json(const OrderBook& book);
