#pragma once
#include <book/order_book.hpp>

void seed_book(OrderBook &book, int mid_price, int spread, int levels,
               int target_depth_per_side, uint64_t rng_seed = 0);