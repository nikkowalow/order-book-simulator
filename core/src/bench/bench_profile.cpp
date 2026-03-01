// bench_profile.cpp — per-section latency breakdown
//
// Isolates each subsystem so you can see exactly which part of an order's
// lifecycle is slowest:
//
//   Book layer     : add_resting_order, cancel_order, best_bid/ask lookup
//   Engine paths   : resting-only path, single-fill path, multi-level sweep
//   UserManager    : register_order, on_fill, on_order_resting
//   Sinks          : JournalTradeSink::on_trade, JournalOrderSink::on_order_event
//
// Each section is timed independently so costs don't bleed into each other.

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
#include <logging/journal_order_sink.hpp>
#include <logging/journal_trade_sink.hpp>
#include <sim/seed_book.hpp>
#include <user/user_manager.hpp>

using ns  = std::chrono::nanoseconds;
using clk = std::chrono::steady_clock;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

struct Stats {
    std::string label;
    size_t      n;
    double      avg_us;
    double      p50_us;
    double      p90_us;
    double      p99_us;
    double      max_us;
};

static double pct(std::vector<ns> &v, double p) {
    size_t idx = static_cast<size_t>(p / 100.0 * static_cast<double>(v.size()));
    if (idx >= v.size()) idx = v.size() - 1;
    return static_cast<double>(v[idx].count()) / 1000.0;
}

static Stats compute(const std::string &label, std::vector<ns> samples) {
    std::sort(samples.begin(), samples.end());
    double avg = static_cast<double>(
                     std::accumulate(samples.begin(), samples.end(), ns{}).count())
                 / static_cast<double>(samples.size()) / 1000.0;
    return {label, samples.size(), avg,
            pct(samples, 50), pct(samples, 90), pct(samples, 99), pct(samples, 100)};
}

static void print_header() {
    std::printf("\n  %-38s  %7s  %7s  %7s  %7s  %7s  %7s\n",
                "Section", "n", "avg µs", "p50 µs", "p90 µs", "p99 µs", "max µs");
    std::printf("  %s\n", std::string(98, '-').c_str());
}

static void print_divider(const char *group) {
    std::printf("\n  [ %s ]\n", group);
}

static void print_row(const Stats &s) {
    std::printf("  %-38s  %7zu  %7.3f  %7.3f  %7.3f  %7.3f  %7.3f\n",
                s.label.c_str(), s.n, s.avg_us, s.p50_us, s.p90_us, s.p99_us, s.max_us);
}

static void write_csv(const std::string &path,
                      const std::vector<std::pair<std::string, std::vector<ns>>> &raw) {
    std::filesystem::create_directories(std::filesystem::path(path).parent_path());
    std::ofstream f(path);
    f << "section,latency_us\n";
    for (const auto &[label, samples] : raw)
        for (const auto &s : samples)
            f << label << ',' << static_cast<double>(s.count()) / 1000.0 << '\n';
    std::printf("\n  CSV written to: %s\n\n", path.c_str());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static Order make_order(long long id, Side side, int price, long long qty,
                        OrderType type = OrderType::Limit) {
    return Order{.id = id, .side = side, .price = price, .qty = qty, .type = type};
}

static constexpr int WARMUP = 2000;
static constexpr int N      = 30000;

template <typename Fn>
static std::vector<ns> timed(Fn fn, int n) {
    std::vector<ns> s;
    s.reserve(n);
    for (int i = 0; i < n; ++i) {
        auto t0 = clk::now();
        fn(i);
        s.push_back(clk::now() - t0);
    }
    return s;
}

// ---------------------------------------------------------------------------
// 1. Book layer — raw data structure cost, no engine
// ---------------------------------------------------------------------------

static std::vector<ns> bench_book_add(int n) {
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    long long id = 9'000'000;
    return timed([&](int) {
        book.add_resting_order(make_order(id++, Side::Buy, 90, 10));
    }, n);
}

static std::vector<ns> bench_book_cancel(int n) {
    OrderBook book;
    // Pre-place n orders
    std::vector<long long> ids;
    ids.reserve(n + WARMUP);
    for (int i = 0; i < n + WARMUP; ++i) {
        long long id = 9'000'000LL + i;
        ids.push_back(id);
        book.add_resting_order(make_order(id, Side::Buy, 90, 10));
    }
    // warmup
    for (int i = 0; i < WARMUP; ++i) book.cancel_order(ids[i]);

    std::vector<ns> s;
    s.reserve(n);
    for (int i = 0; i < n; ++i) {
        auto t0 = clk::now();
        book.cancel_order(ids[WARMUP + i]);
        s.push_back(clk::now() - t0);
    }
    return s;
}

static std::vector<ns> bench_book_best_lookup(int n) {
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    return timed([&](int) {
        volatile auto b = book.best_bid();
        volatile auto a = book.best_ask();
        (void)b; (void)a;
    }, n);
}

// ---------------------------------------------------------------------------
// 2. Engine paths — sinks disabled to isolate engine-only cost
// ---------------------------------------------------------------------------

static std::vector<ns> bench_engine_resting(int n) {
    // No match: buy far below ask
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    MatchingEngine engine(book);          // no sinks
    long long id = 1'000'000;
    // warmup
    for (int i = 0; i < WARMUP; ++i)
        engine.process_order(make_order(id++, Side::Buy, 85, 5));
    return timed([&](int) {
        engine.process_order(make_order(id++, Side::Buy, 85, 5));
    }, n);
}

static std::vector<ns> bench_engine_single_fill(int n) {
    // Aggressive limit — crosses spread, fills 1 level
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    MatchingEngine engine(book);
    long long id = 1'000'000;
    // warmup
    for (int i = 0; i < WARMUP; ++i) {
        bool buy = (i % 2 == 0);
        engine.process_order(make_order(id++, buy ? Side::Buy : Side::Sell,
                                        buy ? 105 : 95, 5));
    }
    return timed([&](int i) {
        bool buy = (i % 2 == 0);
        engine.process_order(make_order(id++, buy ? Side::Buy : Side::Sell,
                                        buy ? 105 : 95, 5));
    }, n);
}

static std::vector<ns> bench_engine_sweep(int n, int levels) {
    // Market order sweeping `levels` price levels — refill between each
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    MatchingEngine engine(book);
    const long long sweep_qty = static_cast<long long>(levels) * 500;
    long long id = 1'000'000;

    auto refill = [&]() {
        for (int i = 0; i < levels; ++i)
            engine.process_order(make_order(id++, Side::Sell, 101 + i, 500));
    };
    // warmup
    for (int i = 0; i < WARMUP; ++i) { refill(); engine.process_order(make_order(id++, Side::Buy, 0, sweep_qty, OrderType::Market)); }

    return timed([&](int) {
        refill();
        engine.process_order(make_order(id++, Side::Buy, 0, sweep_qty, OrderType::Market));
    }, n);
}

// ---------------------------------------------------------------------------
// 3. Engine with sinks — diff from no-sink baseline shows sink overhead
// ---------------------------------------------------------------------------

static std::vector<ns> bench_engine_with_trade_sink(int n, const std::string &tmp) {
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    JournalTradeSink sink(tmp);
    MatchingEngine engine(book, &sink);
    long long id = 1'000'000;
    for (int i = 0; i < WARMUP; ++i) {
        bool buy = (i % 2 == 0);
        engine.process_order(make_order(id++, buy ? Side::Buy : Side::Sell,
                                        buy ? 105 : 95, 5));
    }
    return timed([&](int i) {
        bool buy = (i % 2 == 0);
        engine.process_order(make_order(id++, buy ? Side::Buy : Side::Sell,
                                        buy ? 105 : 95, 5));
    }, n);
}

static std::vector<ns> bench_engine_with_order_sink(int n, const std::string &tmp) {
    OrderBook book;
    seed_book(book, 100, 2, 20, 5000, 5000);
    JournalOrderSink sink(tmp);
    MatchingEngine engine(book, nullptr, &sink);
    long long id = 1'000'000;
    for (int i = 0; i < WARMUP; ++i) {
        bool buy = (i % 2 == 0);
        engine.process_order(make_order(id++, buy ? Side::Buy : Side::Sell,
                                        buy ? 105 : 95, 5));
    }
    return timed([&](int i) {
        bool buy = (i % 2 == 0);
        engine.process_order(make_order(id++, buy ? Side::Buy : Side::Sell,
                                        buy ? 105 : 95, 5));
    }, n);
}

// ---------------------------------------------------------------------------
// 4. Sinks directly — raw I/O + serialisation cost
// ---------------------------------------------------------------------------

static std::vector<ns> bench_trade_sink_direct(int n, const std::string &tmp) {
    JournalTradeSink sink(tmp);
    Trade t{.maker_id=1,.taker_id=2,.maker_user_id=1,.taker_user_id=2,
            .price=100,.qty=10,.seq=0,
            .timestamp=std::chrono::nanoseconds{12345678}};
    // warmup
    for (int i = 0; i < WARMUP; ++i) { t.seq = i; sink.on_trade(t); }
    return timed([&](int i) { t.seq = i; sink.on_trade(t); }, n);
}

static std::vector<ns> bench_order_sink_direct(int n, const std::string &tmp) {
    JournalOrderSink sink(tmp);
    OrderEvent e{.seq=0,.batch_id=1,.order_id=42,.user_id=1,
                 .status=OrderStatus::Filled,.side=Side::Buy,
                 .price=100,.qty=10,.remaining_qty=0,
                 .timestamp=std::chrono::nanoseconds{12345678}};
    for (int i = 0; i < WARMUP; ++i) { e.seq = i; sink.on_order_event(e); }
    return timed([&](int i) { e.seq = i; sink.on_order_event(e); }, n);
}

// ---------------------------------------------------------------------------
// 5. UserManager operations
// ---------------------------------------------------------------------------

static std::vector<ns> bench_um_register(int n, const std::string &tmp) {
    UserManager um(tmp);
    long long uid = um.next_user_id();
    long long oid = 1'000'000;
    for (int i = 0; i < WARMUP; ++i) um.register_order(oid++, uid);
    return timed([&](int) { um.register_order(oid++, uid); }, n);
}

static std::vector<ns> bench_um_on_fill(int n, const std::string &tmp) {
    UserManager um(tmp);
    long long uid = um.next_user_id();
    // Pre-register a maker and give them shares
    long long maker_id = 1, taker_id = 2;
    um.register_order(maker_id, uid);
    um.register_order(taker_id, uid);
    for (int i = 0; i < WARMUP; ++i) um.on_fill(maker_id, taker_id, 100, 1, Side::Buy);
    return timed([&](int) { um.on_fill(maker_id, taker_id, 100, 1, Side::Buy); }, n);
}

static std::vector<ns> bench_um_on_resting(int n, const std::string &tmp) {
    UserManager um(tmp);
    long long uid = um.next_user_id();
    long long oid = 1'000'000;
    for (int i = 0; i < WARMUP; ++i) {
        um.register_order(oid, uid);
        um.on_order_resting(oid++, Side::Buy, 100, 10);
    }
    return timed([&](int) {
        um.register_order(oid, uid);
        um.on_order_resting(oid++, Side::Buy, 100, 10);
    }, n);
}

// ---------------------------------------------------------------------------

int main(int argc, char **argv) {
    const std::string csv_path = (argc >= 2) ? argv[1] : "../bench_output/bench_profile.csv";
    const std::string tmp_dir  = std::filesystem::temp_directory_path().string();
    const std::string tmp_trade = tmp_dir + "/bench_trade_sink.jsonl";
    const std::string tmp_order = tmp_dir + "/bench_order_sink.jsonl";
    const std::string tmp_um    = tmp_dir + "/bench_users.jsonl";

    std::printf("\nOrder Book — Per-Section Latency Profile\n");
    std::printf("=========================================\n");
    std::printf("  warmup=%d  measured=%d  clk=steady_clock\n", WARMUP, N);

    std::vector<std::pair<std::string, std::vector<ns>>> raw;

    auto run = [&](const std::string &label, std::vector<ns> samples) {
        auto s = compute(label, samples);
        print_row(s);
        raw.emplace_back(label, std::move(samples));
    };

    print_header();

    // ---- Book layer --------------------------------------------------------
    print_divider("Book (no engine, no sinks)");
    run("book: add_resting_order",     bench_book_add(N));
    run("book: cancel_order",          bench_book_cancel(N));
    run("book: best_bid + best_ask",   bench_book_best_lookup(N));

    // ---- Engine (no sinks) -------------------------------------------------
    print_divider("Engine (sinks disabled — pure engine cost)");
    run("engine: resting limit",       bench_engine_resting(N));
    run("engine: single fill",         bench_engine_single_fill(N));
    run("engine: sweep  5 levels",     bench_engine_sweep(N,  5));
    run("engine: sweep 10 levels",     bench_engine_sweep(N, 10));
    run("engine: sweep 20 levels",     bench_engine_sweep(N, 20));

    // ---- Engine (with sinks) — reveals sink overhead -----------------------
    print_divider("Engine + sink (subtract no-sink baseline for sink cost)");
    run("engine+trade_sink: single fill",  bench_engine_with_trade_sink(N, tmp_trade));
    run("engine+order_sink: single fill",  bench_engine_with_order_sink(N, tmp_order));

    // ---- Sinks directly ----------------------------------------------------
    print_divider("Sinks (direct call — serialisation + I/O cost)");
    run("trade_sink: on_trade",        bench_trade_sink_direct(N, tmp_trade));
    run("order_sink: on_order_event",  bench_order_sink_direct(N, tmp_order));

    // ---- UserManager -------------------------------------------------------
    print_divider("UserManager");
    run("user_manager: register_order",    bench_um_register(N, tmp_um));
    run("user_manager: on_fill",           bench_um_on_fill(N, tmp_um));
    run("user_manager: on_order_resting",  bench_um_on_resting(N, tmp_um));

    std::printf("\n  All latencies in microseconds (µs).\n");
    write_csv(csv_path, raw);
    return 0;
}
