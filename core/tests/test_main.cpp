#define CATCH_CONFIG_MAIN
#include <catch2/catch_all.hpp>
#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>

// Helper to make limit orders concise
static Order limit_buy(long long id, int price, long long qty) {
    return Order{.id = id, .side = Side::Buy, .type = OrderType::Limit, .price = price, .qty = qty};
}

static Order limit_sell(long long id, int price, long long qty) {
    return Order{.id = id, .side = Side::Sell, .type = OrderType::Limit, .price = price, .qty = qty};
}

static Order market_buy(long long id, long long qty) {
    return Order{.id = id, .side = Side::Buy, .type = OrderType::Market, .price = 0, .qty = qty};
}

static Order market_sell(long long id, long long qty) {
    return Order{.id = id, .side = Side::Sell, .type = OrderType::Market, .price = 0, .qty = qty};
}

// ============================================================
// OrderBook tests
// ============================================================

TEST_CASE("OrderBook starts empty") {
    OrderBook book;
    REQUIRE_FALSE(book.best_bid().has_value());
    REQUIRE_FALSE(book.best_ask().has_value());
}

TEST_CASE("OrderBook tracks best bid and ask") {
    OrderBook book;
    book.add_resting_order(limit_buy(1, 100, 10));
    book.add_resting_order(limit_buy(2, 99, 5));
    book.add_resting_order(limit_sell(3, 102, 7));
    book.add_resting_order(limit_sell(4, 105, 3));

    REQUIRE(book.best_bid().value() == 100);
    REQUIRE(book.best_ask().value() == 102);
}

TEST_CASE("OrderBook cancel removes order") {
    OrderBook book;
    book.add_resting_order(limit_buy(1, 100, 10));
    book.add_resting_order(limit_buy(2, 100, 5));

    REQUIRE(book.cancel_order(1));
    // Still have order 2 at 100
    REQUIRE(book.best_bid().value() == 100);

    REQUIRE(book.cancel_order(2));
    // Now empty
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("OrderBook cancel nonexistent returns false") {
    OrderBook book;
    REQUIRE_FALSE(book.cancel_order(999));
}

// ============================================================
// Matching engine — limit orders
// ============================================================

TEST_CASE("Limit buy no match rests on book") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 105, 10));

    // Buy at 100 doesn't cross the ask at 105
    auto result = engine.process_order(limit_buy(2, 100, 5));

    REQUIRE(result.trades.empty());
    REQUIRE(book.best_bid().value() == 100);
    REQUIRE(book.best_ask().value() == 105);
}

TEST_CASE("Limit sell no match rests on book") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 95, 10));

    // Sell at 100 doesn't cross the bid at 95
    auto result = engine.process_order(limit_sell(2, 100, 5));

    REQUIRE(result.trades.empty());
    REQUIRE(book.best_bid().value() == 95);
    REQUIRE(book.best_ask().value() == 100);
}

TEST_CASE("Limit buy exact fill") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 10));

    auto result = engine.process_order(limit_buy(2, 100, 10));

    REQUIRE(result.trades.size() == 1);
    REQUIRE(result.trades[0].price == 100);
    REQUIRE(result.trades[0].qty == 10);
    REQUIRE(result.trades[0].maker_id == 1);
    REQUIRE(result.trades[0].taker_id == 2);
    // Book should be empty
    REQUIRE_FALSE(book.best_ask().has_value());
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("Limit sell exact fill") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 100, 10));

    auto result = engine.process_order(limit_sell(2, 100, 10));

    REQUIRE(result.trades.size() == 1);
    REQUIRE(result.trades[0].price == 100);
    REQUIRE(result.trades[0].qty == 10);
    REQUIRE(result.trades[0].maker_id == 1);
    REQUIRE(result.trades[0].taker_id == 2);
    REQUIRE_FALSE(book.best_bid().has_value());
    REQUIRE_FALSE(book.best_ask().has_value());
}

TEST_CASE("Limit buy partial fill — remainder rests") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 5));

    // Buy 10, only 5 available
    auto result = engine.process_order(limit_buy(2, 100, 10));

    REQUIRE(result.trades.size() == 1);
    REQUIRE(result.trades[0].qty == 5);
    // Remaining 5 rests as a bid
    REQUIRE(book.best_bid().value() == 100);
    REQUIRE_FALSE(book.best_ask().has_value());
}

TEST_CASE("Limit sell partial fill — remainder rests") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 100, 5));

    auto result = engine.process_order(limit_sell(2, 100, 10));

    REQUIRE(result.trades.size() == 1);
    REQUIRE(result.trades[0].qty == 5);
    REQUIRE(book.best_ask().value() == 100);
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("Limit buy sweeps multiple price levels") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 5));
    book.add_resting_order(limit_sell(2, 101, 5));
    book.add_resting_order(limit_sell(3, 102, 5));

    // Buy 12 at limit 102 — should sweep 100 (5), 101 (5), 102 (2)
    auto result = engine.process_order(limit_buy(10, 102, 12));

    REQUIRE(result.trades.size() == 3);
    REQUIRE(result.trades[0].price == 100);
    REQUIRE(result.trades[0].qty == 5);
    REQUIRE(result.trades[1].price == 101);
    REQUIRE(result.trades[1].qty == 5);
    REQUIRE(result.trades[2].price == 102);
    REQUIRE(result.trades[2].qty == 2);

    // 3 remaining at 102
    REQUIRE(book.best_ask().value() == 102);
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("Limit sell sweeps multiple price levels") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 102, 5));
    book.add_resting_order(limit_buy(2, 101, 5));
    book.add_resting_order(limit_buy(3, 100, 5));

    // Sell 12 at limit 100 — should sweep 102 (5), 101 (5), 100 (2)
    auto result = engine.process_order(limit_sell(10, 100, 12));

    REQUIRE(result.trades.size() == 3);
    REQUIRE(result.trades[0].price == 102);
    REQUIRE(result.trades[0].qty == 5);
    REQUIRE(result.trades[1].price == 101);
    REQUIRE(result.trades[1].qty == 5);
    REQUIRE(result.trades[2].price == 100);
    REQUIRE(result.trades[2].qty == 2);

    REQUIRE(book.best_bid().value() == 100);
    REQUIRE_FALSE(book.best_ask().has_value());
}

TEST_CASE("Limit buy fills multiple orders at same price level (FIFO)") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 3));
    book.add_resting_order(limit_sell(2, 100, 4));
    book.add_resting_order(limit_sell(3, 100, 3));

    auto result = engine.process_order(limit_buy(10, 100, 10));

    REQUIRE(result.trades.size() == 3);
    // FIFO: order 1, then 2, then 3
    REQUIRE(result.trades[0].maker_id == 1);
    REQUIRE(result.trades[0].qty == 3);
    REQUIRE(result.trades[1].maker_id == 2);
    REQUIRE(result.trades[1].qty == 4);
    REQUIRE(result.trades[2].maker_id == 3);
    REQUIRE(result.trades[2].qty == 3);

    REQUIRE_FALSE(book.best_ask().has_value());
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("Limit buy stops at price limit") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 5));
    book.add_resting_order(limit_sell(2, 101, 5));
    book.add_resting_order(limit_sell(3, 102, 5));

    // Buy at limit 101 — should only take levels 100 and 101
    auto result = engine.process_order(limit_buy(10, 101, 20));

    REQUIRE(result.trades.size() == 2);
    REQUIRE(result.trades[0].price == 100);
    REQUIRE(result.trades[1].price == 101);

    // Remaining 10 rests at 101
    REQUIRE(book.best_bid().value() == 101);
    REQUIRE(book.best_ask().value() == 102);
}

TEST_CASE("Limit sell stops at price limit") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 102, 5));
    book.add_resting_order(limit_buy(2, 101, 5));
    book.add_resting_order(limit_buy(3, 100, 5));

    // Sell at limit 101 — should only take levels 102 and 101
    auto result = engine.process_order(limit_sell(10, 101, 20));

    REQUIRE(result.trades.size() == 2);
    REQUIRE(result.trades[0].price == 102);
    REQUIRE(result.trades[1].price == 101);

    REQUIRE(book.best_ask().value() == 101);
    REQUIRE(book.best_bid().value() == 100);
}

// ============================================================
// Matching engine — market orders
// ============================================================

TEST_CASE("Market buy sweeps all available liquidity") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 5));
    book.add_resting_order(limit_sell(2, 200, 5));

    // Market buy ignores price — takes everything it can
    auto result = engine.process_order(market_buy(10, 8));

    REQUIRE(result.trades.size() == 2);
    REQUIRE(result.trades[0].price == 100);
    REQUIRE(result.trades[0].qty == 5);
    REQUIRE(result.trades[1].price == 200);
    REQUIRE(result.trades[1].qty == 3);

    // Does NOT rest on book (market order)
    REQUIRE_FALSE(book.best_bid().has_value());
    REQUIRE(book.best_ask().value() == 200);
}

TEST_CASE("Market sell sweeps all available liquidity") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 200, 5));
    book.add_resting_order(limit_buy(2, 100, 5));

    auto result = engine.process_order(market_sell(10, 8));

    REQUIRE(result.trades.size() == 2);
    REQUIRE(result.trades[0].price == 200);
    REQUIRE(result.trades[0].qty == 5);
    REQUIRE(result.trades[1].price == 100);
    REQUIRE(result.trades[1].qty == 3);

    REQUIRE_FALSE(book.best_ask().has_value());
    REQUIRE(book.best_bid().value() == 100);
}

TEST_CASE("Market order unfilled remainder does NOT rest") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 3));

    // Market buy for 10, only 3 available
    auto result = engine.process_order(market_buy(10, 10));

    REQUIRE(result.trades.size() == 1);
    REQUIRE(result.trades[0].qty == 3);
    // Remaining 7 should NOT be on the book
    REQUIRE_FALSE(book.best_bid().has_value());
    REQUIRE_FALSE(book.best_ask().has_value());
}

TEST_CASE("Market order on empty book produces no trades") {
    OrderBook book;
    MatchingEngine engine(book);

    auto result = engine.process_order(market_buy(1, 10));

    REQUIRE(result.trades.empty());
    REQUIRE_FALSE(book.best_bid().has_value());
    REQUIRE_FALSE(book.best_ask().has_value());
}

// ============================================================
// Edge cases
// ============================================================

TEST_CASE("Zero qty order produces no trades") {
    OrderBook book;
    MatchingEngine engine(book);

    auto result = engine.process_order(limit_buy(1, 100, 0));
    REQUIRE(result.trades.empty());
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("Self-trade is not prevented (no self-trade protection)") {
    // This test documents current behavior — the engine does not
    // prevent self-trading. If that changes, update this test.
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 5));
    // Same "participant" buys against their own sell
    auto result = engine.process_order(limit_buy(1, 100, 5));

    // Engine matches regardless of ID collision
    REQUIRE(result.trades.size() == 1);
}

TEST_CASE("Cancel after partial fill") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 10));

    // Partially fill: buy 3
    auto result = engine.process_order(limit_buy(2, 100, 3));
    REQUIRE(result.trades.size() == 1);
    REQUIRE(result.trades[0].qty == 3);

    // Order 1 should still be resting with 7 remaining
    REQUIRE(book.best_ask().value() == 100);

    // Cancel the remaining
    REQUIRE(book.cancel_order(1));
    REQUIRE_FALSE(book.best_ask().has_value());
}

TEST_CASE("Multiple orders build and drain book correctly") {
    OrderBook book;
    MatchingEngine engine(book);

    // Build a book
    book.add_resting_order(limit_buy(1, 99, 10));
    book.add_resting_order(limit_buy(2, 98, 20));
    book.add_resting_order(limit_sell(3, 101, 10));
    book.add_resting_order(limit_sell(4, 102, 20));

    REQUIRE(book.best_bid().value() == 99);
    REQUIRE(book.best_ask().value() == 101);

    // Aggressive sell sweeps both bid levels
    auto result = engine.process_order(limit_sell(10, 98, 25));

    REQUIRE(result.trades.size() == 2);
    REQUIRE(result.trades[0].price == 99);
    REQUIRE(result.trades[0].qty == 10);
    REQUIRE(result.trades[1].price == 98);
    REQUIRE(result.trades[1].qty == 15);

    // Bid side: 5 left at 98
    REQUIRE(book.best_bid().value() == 98);
    // Ask side untouched
    REQUIRE(book.best_ask().value() == 101);
}

TEST_CASE("Price-time priority across multiple levels and orders") {
    OrderBook book;
    MatchingEngine engine(book);

    // Two orders at 100, one at 99
    book.add_resting_order(limit_sell(1, 100, 2));
    book.add_resting_order(limit_sell(2, 100, 3));
    book.add_resting_order(limit_sell(3, 99, 4));

    // Buy at 100 for 9: should take 99 first (price priority),
    // then 100 FIFO (order 1 then 2)
    auto result = engine.process_order(limit_buy(10, 100, 9));

    REQUIRE(result.trades.size() == 3);
    // Best ask is 99 (lowest)
    REQUIRE(result.trades[0].price == 99);
    REQUIRE(result.trades[0].qty == 4);
    REQUIRE(result.trades[0].maker_id == 3);
    // Then 100, FIFO
    REQUIRE(result.trades[1].price == 100);
    REQUIRE(result.trades[1].qty == 2);
    REQUIRE(result.trades[1].maker_id == 1);
    REQUIRE(result.trades[2].price == 100);
    REQUIRE(result.trades[2].qty == 3);
    REQUIRE(result.trades[2].maker_id == 2);

    REQUIRE_FALSE(book.best_ask().has_value());
    REQUIRE_FALSE(book.best_bid().has_value());
}
