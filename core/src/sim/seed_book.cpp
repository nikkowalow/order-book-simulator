#include <sim/seed_book.hpp>
#include <types/types.hpp>

#include <algorithm>
#include <numeric>
#include <random>
#include <vector>

void seed_book(OrderBook &book, int mid_price, int spread, int levels,
               int target_depth_per_side, uint64_t rng_seed) {

  std::mt19937_64 rng(rng_seed == 0 ? std::random_device{}() : rng_seed);

  long long next_id = 1;

  int best_bid = mid_price - spread / 2;
  int best_ask = mid_price + spread / 2;

  // --- Random generators ---
  std::uniform_int_distribution<int> order_count_dist(1, 6);
  std::uniform_int_distribution<int> price_jitter_dist(0, 1);
  std::uniform_int_distribution<int> fat_tail_dist(1, 100);
  std::uniform_real_distribution<double> skew_dist(0.7, 1.3);

  auto seed_side = [&](Side side, int start_price, int dir) {
    // Random weights per level
    std::vector<long long> weights(levels);
    for (int i = 0; i < levels; ++i) {
      // heavy-tailed-ish randomness
      long long w = fat_tail_dist(rng);
      if (fat_tail_dist(rng) > 85)
        w *= 3; // occasional chunky level
      weights[i] = w;
    }

    long long weight_sum = std::accumulate(weights.begin(), weights.end(), 0LL);

    for (int i = 0; i < levels; ++i) {
      int base_price = start_price + dir * i;

      // small price clustering / gaps
      int price = base_price + price_jitter_dist(rng);

      long long level_qty = (target_depth_per_side * weights[i]) / weight_sum;

      if (level_qty <= 0)
        continue;

      int orders = order_count_dist(rng);
      long long remaining = level_qty;

      for (int j = 0; j < orders; ++j) {
        if (remaining <= 0)
          break;

        // uneven split
        long long slice =
            (j == orders - 1)
                ? remaining
                : std::max<long long>(1, remaining * skew_dist(rng) /
                                             (orders - j));

        remaining -= slice;

        book.add_resting_order(
            Order{.id = next_id++, .side = side, .price = price, .qty = slice});
      }
    }
  };

  // BIDS: downwards
  seed_side(Side::Buy, best_bid, -1);

  // ASKS: upwards
  seed_side(Side::Sell, best_ask, +1);
}
