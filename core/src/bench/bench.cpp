#include <algorithm>
#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <random>
#include <sstream>
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

static void print_results(const char *label, const std::vector<ns> &samples) {
    // Sort a local copy — the original stays in insertion order for the CSV.
    std::vector<ns> sorted = samples;
    std::sort(sorted.begin(), sorted.end());
    double avg = static_cast<double>(
                     std::accumulate(sorted.begin(), sorted.end(), ns{0}).count())
                 / static_cast<double>(sorted.size()) / 1000.0;

    std::fprintf(stderr, "  %-24s  n=%-6zu  avg=%7.3f µs  p50=%7.3f µs  p90=%7.3f µs  p99=%7.3f µs  max=%7.3f µs\n",
                label, sorted.size(), avg,
                pct(sorted, 50), pct(sorted, 90), pct(sorted, 99), pct(sorted, 100));
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
    std::fprintf(stderr, "\n  CSV written to: %s\n", path.c_str());
}

static void write_json(std::ostream &f,
                       const std::vector<std::pair<std::string, std::vector<ns>>> &results) {
    f << std::fixed << std::setprecision(3);

    static const double kPcts[] = {1, 5, 10, 25, 50, 75, 90, 95, 99, 99.5, 99.9};
    static const int kNumPcts   = static_cast<int>(sizeof(kPcts) / sizeof(kPcts[0]));

    static const double kBuckets[] = {
        0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 5.0,
        10.0, 25.0, 50.0, 100.0, 250.0, 500.0
    };
    static const int kNumBuckets = static_cast<int>(sizeof(kBuckets) / sizeof(kBuckets[0]));

    auto pct_val = [](const std::vector<double>& v, double p) -> double {
        size_t idx = static_cast<size_t>(p / 100.0 * static_cast<double>(v.size()));
        if (idx >= v.size()) idx = v.size() - 1;
        return v[idx];
    };

    auto json_str = [](const std::string& s) -> std::string {
        std::string out;
        out.reserve(s.size() + 2);
        out += '"';
        for (char c : s) {
            if (c == '"' || c == '\\') out += '\\';
            out += c;
        }
        out += '"';
        return out;
    };

    f << "{\n  \"scenarios\": {\n";

    for (size_t si = 0; si < results.size(); ++si) {
        const auto& [label, raw] = results[si];

        std::vector<double> v;
        v.reserve(raw.size());
        for (const auto& s : raw)
            v.push_back(static_cast<double>(s.count()) / 1000.0);
        std::sort(v.begin(), v.end());

        double avg = std::accumulate(v.begin(), v.end(), 0.0) / static_cast<double>(v.size());

        f << "    " << json_str(label) << ": {\n"
          << "      \"n\": "      << v.size()          << ",\n"
          << "      \"avg_us\": " << avg               << ",\n"
          << "      \"p50_us\": " << pct_val(v, 50)   << ",\n"
          << "      \"p90_us\": " << pct_val(v, 90)   << ",\n"
          << "      \"p99_us\": " << pct_val(v, 99)   << ",\n"
          << "      \"max_us\": " << v.back()          << ",\n";

        f << "      \"percentile_curve\": [\n";
        for (int pi = 0; pi < kNumPcts; ++pi) {
            f << "        {\"p\": " << kPcts[pi]
              << ", \"value_us\": " << pct_val(v, kPcts[pi]) << "}";
            if (pi + 1 < kNumPcts) f << ",";
            f << "\n";
        }
        f << "      ],\n";

        std::vector<long long> counts(kNumBuckets + 1, 0);
        for (double x : v) {
            bool placed = false;
            for (int bi = 0; bi < kNumBuckets; ++bi) {
                if (x <= kBuckets[bi]) { counts[bi]++; placed = true; break; }
            }
            if (!placed) counts[kNumBuckets]++;
        }

        struct Entry { std::string le; long long count; };
        std::vector<Entry> entries;
        for (int bi = 0; bi <= kNumBuckets; ++bi) {
            if (counts[bi] == 0) continue;
            std::ostringstream le;
            if (bi < kNumBuckets)
                le << std::fixed << std::setprecision(2) << kBuckets[bi];
            else
                le << "+inf";
            entries.push_back({le.str(), counts[bi]});
        }

        f << "      \"histogram\": [\n";
        for (size_t ei = 0; ei < entries.size(); ++ei) {
            f << "        {\"le_us\": \"" << entries[ei].le
              << "\", \"count\": " << entries[ei].count << "}";
            if (ei + 1 < entries.size()) f << ",";
            f << "\n";
        }
        f << "      ]\n";

        f << "    }";
        if (si + 1 < results.size()) f << ",";
        f << "\n";
    }

    f << "  }\n}\n";
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

static std::vector<ns> bench_resting_capped(MatchingEngine &engine, int n) {
    constexpr int MAX_DEPTH = 20000;

    std::mt19937 rng{42};
    std::uniform_int_distribution<int> qty_dist(1, 50);

    std::vector<long long> active_ids;
    active_ids.reserve(MAX_DEPTH);

    std::vector<ns> samples;
    samples.reserve(n);

    for (int i = 0; i < n; ++i) {

        // If we've hit max depth, cancel oldest order
        if (static_cast<int>(active_ids.size()) >= MAX_DEPTH) {
            long long oldest = active_ids.front();
            engine.cancel_order(oldest);

            // O(1) erase from front
            active_ids.front() = active_ids.back();
            active_ids.pop_back();
        }

        long long id = engine.next_order_id();
        Order o{
            .id = id,
            .side = Side::Buy,
            .price = 90,
            .qty = qty_dist(rng),
            .type = OrderType::Limit
        };

        auto t0 = clk::now();
        engine.process_order(o);
        samples.push_back(clk::now() - t0);

        active_ids.push_back(id);
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
            resting_ids[idx] = resting_ids.back();
            resting_ids.pop_back();
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
    constexpr int N      = 50000;
    const std::string csv_path = (argc >= 2) ? argv[1] : "../bench_output/bench_results.csv";

    std::fprintf(stderr, "\nOrder Book Matching Engine — Latency Benchmark\n");
    std::fprintf(stderr, "================================================\n");
    std::fprintf(stderr, "  warmup=%d  measured=%d  clk=steady_clock\n\n", WARMUP, N);

    std::vector<std::pair<std::string, std::vector<ns>>> all_results;

    all_results.emplace_back("resting limit",
        run_scenario("resting limit",    bench_resting,   WARMUP, N));
    all_results.emplace_back("aggressive limit",
        run_scenario("aggressive limit", bench_aggressive, WARMUP, N));
    all_results.emplace_back("cancel",
        run_scenario("cancel",           bench_cancel,    WARMUP, N));
    all_results.emplace_back("mixed (60/30/10)",
        run_scenario("mixed (60/30/10)", bench_mixed,     WARMUP, N));

    std::fprintf(stderr, "\n");

    auto run_sweep = [&](const char *label, int levels, int qty_per_level) {
        { OrderBook wb; seed_book(wb, 100, 2, 20, 5000, 5000); MatchingEngine we(wb);
          bench_market_sweep(we, WARMUP, levels, qty_per_level); }
        OrderBook mb; seed_book(mb, 100, 2, 20, 5000, 5000); MatchingEngine me(mb);
        auto samples = bench_market_sweep(me, N, levels, qty_per_level);
        print_results(label, samples);
        all_results.emplace_back(label, std::move(samples));
    };

    run_sweep("mkt sweep  3 levels",  3, 500);
    run_sweep("mkt sweep 10 levels", 10, 500);
    run_sweep("mkt sweep 20 levels", 20, 500);

    std::fprintf(stderr, "\n  All latencies in microseconds (µs).\n");

    write_csv(csv_path, all_results);
    write_json(std::cout, all_results);
    return 0;
}
