#include <algorithm>
#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <numeric>
#include <random>
#include <string>
#include <utility>
#include <vector>

#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>
#include <sim/seed_book.hpp>

using ns  = std::chrono::nanoseconds;
using clk = std::chrono::steady_clock;

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

static double pct(std::vector<ns> &v, double p) {
    size_t idx = static_cast<size_t>(p / 100.0 * static_cast<double>(v.size()));
    if (idx >= v.size()) idx = v.size() - 1;
    return static_cast<double>(v[idx].count()) / 1000.0; // ns -> µs
}

static void print_results(const char *label, std::vector<ns> &samples) {
    std::sort(samples.begin(), samples.end());
    double avg = static_cast<double>(
                     std::accumulate(samples.begin(), samples.end(), ns{0}).count())
                 / static_cast<double>(samples.size()) / 1000.0;

    std::printf("  %-24s  n=%-6zu  avg=%7.3f µs  p50=%7.3f µs  p90=%7.3f µs  p99=%7.3f µs  max=%7.3f µs\n",
                label, samples.size(), avg,
                pct(samples, 50), pct(samples, 90), pct(samples, 99), pct(samples, 100));
}

static void write_csv(const std::string &path,
                      const std::vector<std::pair<std::string, std::vector<ns>>> &results) {
    std::filesystem::create_directories(std::filesystem::path(path).parent_path());
    std::ofstream f(path);
    f << "scenario,latency_us\n";
    for (const auto &[label, samples] : results) {
        for (const auto &s : samples) {
            f << label << ',' << static_cast<double>(s.count()) / 1000.0 << '\n';
        }
    }
    std::printf("\n  CSV written to: %s\n", path.c_str());
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

static std::vector<ns> bench_resting(MatchingEngine &engine, int n) {
    std::mt19937 rng{42};
    std::uniform_int_distribution<int> qty_dist(1, 50);
    std::vector<ns> samples;
    samples.reserve(n);
    for (int i = 0; i < n; ++i) {
        Order o{.id = engine.next_order_id(), .side = Side::Buy,
                .price = 90, .qty = qty_dist(rng), .type = OrderType::Limit};
        auto t0 = clk::now();
        engine.process_order(o);
        samples.push_back(clk::now() - t0);
    }
    return samples;
}

static std::vector<ns> bench_aggressive(MatchingEngine &engine, int n) {
    std::mt19937 rng{43};
    std::uniform_int_distribution<int> qty_dist(1, 20);
    std::vector<ns> samples;
    samples.reserve(n);
    for (int i = 0; i < n; ++i) {
        bool buy = (i % 2 == 0);
        Order o{.id = engine.next_order_id(),
                .side  = buy ? Side::Buy : Side::Sell,
                .price = buy ? 110 : 90,
                .qty   = qty_dist(rng),
                .type  = OrderType::Limit};
        auto t0 = clk::now();
        engine.process_order(o);
        samples.push_back(clk::now() - t0);
    }
    return samples;
}

static std::vector<ns> bench_cancel(MatchingEngine &engine, int n) {
    std::vector<long long> ids;
    ids.reserve(n);
    for (int i = 0; i < n; ++i) {
        long long id = engine.next_order_id();
        ids.push_back(id);
        engine.process_order(Order{.id = id, .side = Side::Buy,
                                   .price = 85, .qty = 10, .type = OrderType::Limit});
    }
    std::vector<ns> samples;
    samples.reserve(n);
    for (long long id : ids) {
        auto t0 = clk::now();
        engine.cancel_order(id);
        samples.push_back(clk::now() - t0);
    }
    return samples;
}

static std::vector<ns> bench_mixed(MatchingEngine &engine, int n) {
    std::mt19937 rng{44};
    std::uniform_int_distribution<int> qty_dist(1, 30);
    std::uniform_real_distribution<double> roll(0.0, 1.0);
    std::vector<long long> resting_ids;
    resting_ids.reserve(512);
    std::vector<ns> samples;
    samples.reserve(n);
    for (int i = 0; i < n; ++i) {
        double r = roll(rng);
        auto t0  = clk::now();
        if (r < 0.60) {
            long long id = engine.next_order_id();
            engine.process_order(Order{.id = id, .side = Side::Buy,
                                       .price = 90, .qty = qty_dist(rng), .type = OrderType::Limit});
            resting_ids.push_back(id);
        } else if (r < 0.90) {
            engine.process_order(Order{.id = engine.next_order_id(), .side = Side::Buy,
                                       .price = 110, .qty = qty_dist(rng), .type = OrderType::Limit});
        } else if (!resting_ids.empty()) {
            std::uniform_int_distribution<size_t> pick(0, resting_ids.size() - 1);
            size_t idx = pick(rng);
            engine.cancel_order(resting_ids[idx]);
            resting_ids.erase(resting_ids.begin() + static_cast<ptrdiff_t>(idx));
        }
        samples.push_back(clk::now() - t0);
    }
    return samples;
}

static std::vector<ns> bench_market_sweep(MatchingEngine &engine, int n,
                                          int levels_to_sweep, int qty_per_level) {
    const long long sweep_qty = static_cast<long long>(levels_to_sweep) * qty_per_level;
    auto refill = [&]() {
        for (int i = 0; i < levels_to_sweep; ++i) {
            engine.process_order(Order{.id = engine.next_order_id(), .side = Side::Sell,
                                       .price = 101 + i, .qty = qty_per_level,
                                       .type = OrderType::Limit});
        }
    };
    std::vector<ns> samples;
    samples.reserve(n);
    for (int i = 0; i < n; ++i) {
        refill();
        auto t0 = clk::now();
        engine.process_order(Order{.id = engine.next_order_id(), .side = Side::Buy,
                                   .price = 0, .qty = sweep_qty, .type = OrderType::Market});
        samples.push_back(clk::now() - t0);
    }
    return samples;
}

// ---------------------------------------------------------------------------

template <typename Fn>
static std::vector<ns> run_scenario(const char *label, Fn fn, int warmup, int n) {
    { OrderBook wb; seed_book(wb, 100, 2, 20, 5000, 5000); MatchingEngine we(wb); fn(we, warmup); }
    OrderBook mb; seed_book(mb, 100, 2, 20, 5000, 5000); MatchingEngine me(mb);
    auto samples = fn(me, n);
    print_results(label, samples);
    return samples;
}

int main(int argc, char **argv) {
    constexpr int WARMUP = 5000;
    constexpr int N      = 100000;
    const std::string csv_path = (argc >= 2) ? argv[1] : "../bench_output//bench_results.csv";

    std::printf("\nOrder Book Matching Engine — Latency Benchmark\n");
    std::printf("================================================\n");
    std::printf("  warmup=%d  measured=%d  clk=steady_clock\n\n", WARMUP, N);

    std::vector<std::pair<std::string, std::vector<ns>>> all_results;

    all_results.emplace_back("resting limit",
        run_scenario("resting limit",    bench_resting,   WARMUP, N));
    all_results.emplace_back("aggressive limit",
        run_scenario("aggressive limit", bench_aggressive, WARMUP, N));
    all_results.emplace_back("cancel",
        run_scenario("cancel",           bench_cancel,    WARMUP, N));
    all_results.emplace_back("mixed (60/30/10)",
        run_scenario("mixed (60/30/10)", bench_mixed,     WARMUP, N));

    std::printf("\n");

    auto run_sweep = [&](const char *label, int levels, int qty_per_level) {
        { OrderBook wb; seed_book(wb, 100, 2, 20, 5000, 5000); MatchingEngine we(wb);
          bench_market_sweep(we, WARMUP, levels, qty_per_level); }
        OrderBook mb; seed_book(mb, 100, 2, 20, 5000, 5000); MatchingEngine me(mb);
        auto samples = bench_market_sweep(me, N, levels, qty_per_level);
        print_results(label, samples);
        all_results.emplace_back(label, std::move(samples));
    };

    // run_sweep("mkt sweep  3 levels",  3, 500);
    // run_sweep("mkt sweep 10 levels", 10, 500);
    // run_sweep("mkt sweep 20 levels", 20, 500);

    std::printf("\n  All latencies in microseconds (µs).\n");

    write_csv(csv_path, all_results);
    return 0;
}
