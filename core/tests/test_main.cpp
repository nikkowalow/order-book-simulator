#define CATCH_CONFIG_MAIN
#include <catch2/catch_all.hpp>
#include <book/order_book.hpp>
#include <engine/matching_engine.hpp>
#include <engine/multi_trade_sink.hpp>
#include <user/user_manager.hpp>

// Helper to make limit orders concise
static Order limit_buy(long long id, int price, long long qty) {
    return Order{id, 0, Side::Buy, price, qty, OrderType::Limit};
}

static Order limit_sell(long long id, int price, long long qty) {
    return Order{id, 0, Side::Sell, price, qty, OrderType::Limit};
}

static Order market_buy(long long id, long long qty) {
    return Order{id, 0, Side::Buy, 0, qty, OrderType::Market};
}

static Order market_sell(long long id, long long qty) {
    return Order{id, 0, Side::Sell, 0, qty, OrderType::Market};
}

// Helpers with user_id for UserManager tests
static Order limit_buy_u(long long id, long long uid, int price, long long qty) {
    return Order{id, uid, Side::Buy, price, qty, OrderType::Limit};
}

static Order limit_sell_u(long long id, long long uid, int price, long long qty) {
    return Order{id, uid, Side::Sell, price, qty, OrderType::Limit};
}

static Order market_buy_u(long long id, long long uid, long long qty) {
    return Order{id, uid, Side::Buy, 0, qty, OrderType::Market};
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

// ============================================================
// OrderResult status and quantity fields
// ============================================================

TEST_CASE("OrderResult: New status when no fill") {
    OrderBook book;
    MatchingEngine engine(book);

    auto result = engine.process_order(limit_buy(1, 100, 10));

    REQUIRE(result.status == OrderStatus::New);
    REQUIRE(result.original_qty == 10);
    REQUIRE(result.filled_qty == 0);
    REQUIRE(result.remaining_qty == 10);
    REQUIRE(result.trades.empty());
}

TEST_CASE("OrderResult: Filled status when fully filled") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 10));
    auto result = engine.process_order(limit_buy(2, 100, 10));

    REQUIRE(result.status == OrderStatus::Filled);
    REQUIRE(result.original_qty == 10);
    REQUIRE(result.filled_qty == 10);
    REQUIRE(result.remaining_qty == 0);
}

TEST_CASE("OrderResult: PartiallyFilled status and correct quantities") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 3));
    auto result = engine.process_order(limit_buy(2, 100, 10));

    REQUIRE(result.status == OrderStatus::PartiallyFilled);
    REQUIRE(result.original_qty == 10);
    REQUIRE(result.filled_qty == 3);
    REQUIRE(result.remaining_qty == 7);
}

TEST_CASE("OrderResult: Rejected for zero qty") {
    OrderBook book;
    MatchingEngine engine(book);

    auto result = engine.process_order(limit_buy(1, 100, 0));

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE_FALSE(result.reason.empty());
}

TEST_CASE("OrderResult: Rejected for non-positive limit price") {
    OrderBook book;
    MatchingEngine engine(book);

    auto result = engine.process_order(Order{1, 0, Side::Buy, -99, 5, OrderType::Limit});

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE_FALSE(result.reason.empty());
}

TEST_CASE("OrderResult: Canceled for market order with no opposing liquidity") {
    OrderBook book;
    MatchingEngine engine(book);

    auto buy_result  = engine.process_order(market_buy(1, 10));
    auto sell_result = engine.process_order(market_sell(2, 10));

    REQUIRE(buy_result.status  == OrderStatus::Canceled);
    REQUIRE(sell_result.status == OrderStatus::Canceled);
    REQUIRE_FALSE(buy_result.reason.empty());
    REQUIRE_FALSE(sell_result.reason.empty());
}

// ============================================================
// OrderBook depth
// ============================================================

TEST_CASE("bid_depth and ask_depth sum all resting quantities") {
    OrderBook book;
    book.add_resting_order(limit_buy(1, 100, 5));
    book.add_resting_order(limit_buy(2, 99, 10));
    book.add_resting_order(limit_sell(3, 101, 7));
    book.add_resting_order(limit_sell(4, 102, 3));

    REQUIRE(book.bid_depth() == 15);
    REQUIRE(book.ask_depth() == 10);
}

TEST_CASE("bid_depth and ask_depth are zero on empty book") {
    OrderBook book;
    REQUIRE(book.bid_depth() == 0);
    REQUIRE(book.ask_depth() == 0);
}

TEST_CASE("ask_depth decreases after partial fill") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 10));
    engine.process_order(limit_buy(2, 100, 3));

    REQUIRE(book.ask_depth() == 7);
}

TEST_CASE("depth reaches zero after full sweep of multiple levels") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 5));
    book.add_resting_order(limit_sell(2, 101, 5));
    engine.process_order(limit_buy(3, 101, 10));

    REQUIRE(book.ask_depth() == 0);
    REQUIRE_FALSE(book.best_ask().has_value());
}

// ============================================================
// find_order
// ============================================================

TEST_CASE("find_order returns correct order fields") {
    OrderBook book;
    book.add_resting_order(limit_buy(42, 100, 7));

    auto found = book.find_order(42);

    REQUIRE(found.has_value());
    REQUIRE(found->id == 42);
    REQUIRE(found->price == 100);
    REQUIRE(found->qty == 7);
    REQUIRE(found->side == Side::Buy);
}

TEST_CASE("find_order returns nullopt for unknown id") {
    OrderBook book;
    REQUIRE_FALSE(book.find_order(999).has_value());
}

TEST_CASE("find_order returns nullopt after cancel") {
    OrderBook book;
    book.add_resting_order(limit_sell(5, 100, 3));
    book.cancel_order(5);

    REQUIRE_FALSE(book.find_order(5).has_value());
}

TEST_CASE("find_order reflects quantity after partial fill") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 10));
    engine.process_order(limit_buy(2, 100, 4));

    auto found = book.find_order(1);
    REQUIRE(found.has_value());
    REQUIRE(found->qty == 6);
}

// ============================================================
// Engine cancel_order
// ============================================================

TEST_CASE("engine cancel_order removes order from book") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_buy(1, 100, 10));
    REQUIRE(engine.cancel_order(1));
    REQUIRE_FALSE(book.best_bid().has_value());
}

TEST_CASE("engine cancel_order returns false for unknown id") {
    OrderBook book;
    MatchingEngine engine(book);

    REQUIRE_FALSE(engine.cancel_order(999));
}

TEST_CASE("engine cancel_order on partially filled order") {
    OrderBook book;
    MatchingEngine engine(book);

    book.add_resting_order(limit_sell(1, 100, 10));
    engine.process_order(limit_buy(2, 100, 3));

    REQUIRE(engine.cancel_order(1));
    REQUIRE_FALSE(book.best_ask().has_value());
}

// ============================================================
// Duplicate order ID
// ============================================================

TEST_CASE("duplicate order ID is silently ignored by book") {
    OrderBook book;
    book.add_resting_order(limit_buy(1, 100, 10));
    book.add_resting_order(limit_buy(1, 100, 5)); // duplicate — ignored

    REQUIRE(book.bid_depth() == 10);
    REQUIRE(book.cancel_order(1));
    REQUIRE_FALSE(book.best_bid().has_value());
    REQUIRE_FALSE(book.cancel_order(1));
}

// ============================================================
// UserManager — position tracking
// ============================================================

TEST_CASE("UserManager initial position defaults") {
    UserManager um("/dev/null");
    long long uid = um.next_user_id();
    auto pos = um.get_position(uid);

    REQUIRE(pos.balance == 100000);
    REQUIRE(pos.shares == 100);
    REQUIRE(pos.reserved_balance == 0);
    REQUIRE(pos.reserved_shares == 0);
    REQUIRE(pos.net_qty == 0);
}

TEST_CASE("UserManager on_order_resting reserves BUY balance") {
    UserManager um("/dev/null");
    long long uid = um.next_user_id();
    um.register_order(1, uid);
    um.on_order_resting(1, Side::Buy, 100, 10); // reserves 100*10 = 1000

    auto pos = um.get_position(uid);
    REQUIRE(pos.reserved_balance == 1000);
    REQUIRE(pos.balance == 100000); // total balance unchanged
}

TEST_CASE("UserManager on_order_resting reserves SELL shares") {
    UserManager um("/dev/null");
    long long uid = um.next_user_id();
    um.register_order(1, uid);
    um.on_order_resting(1, Side::Sell, 100, 8);

    auto pos = um.get_position(uid);
    REQUIRE(pos.reserved_shares == 8);
    REQUIRE(pos.shares == 100);
}

TEST_CASE("UserManager on_cancel releases BUY reservation") {
    UserManager um("/dev/null");
    long long uid = um.next_user_id();
    um.register_order(1, uid);
    um.on_order_resting(1, Side::Buy, 100, 10);
    um.on_cancel(1, Side::Buy, 100, 10);

    REQUIRE(um.get_position(uid).reserved_balance == 0);
}

TEST_CASE("UserManager on_cancel releases SELL reservation") {
    UserManager um("/dev/null");
    long long uid = um.next_user_id();
    um.register_order(1, uid);
    um.on_order_resting(1, Side::Sell, 100, 8);
    um.on_cancel(1, Side::Sell, 100, 8);

    REQUIRE(um.get_position(uid).reserved_shares == 0);
}

TEST_CASE("UserManager on_cancel partial release") {
    UserManager um("/dev/null");
    long long uid = um.next_user_id();
    um.register_order(1, uid);
    um.on_order_resting(1, Side::Buy, 100, 10); // reserves 1000

    // Cancel with only 6 remaining (4 were filled prior)
    um.on_cancel(1, Side::Buy, 100, 6); // releases 600

    REQUIRE(um.get_position(uid).reserved_balance == 400);
}

// ============================================================
// Preflight checks with UserManager
// ============================================================

TEST_CASE("Preflight: rejects BUY limit with insufficient cash") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    book.add_resting_order(limit_sell(99, 100, 2000));
    auto result = engine.process_order(limit_buy_u(1, uid, 100, 2000)); // 200000 > 100000

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE(result.reason == "insufficient cash");
}

TEST_CASE("Preflight: rejects SELL limit with insufficient shares") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    book.add_resting_order(limit_buy(99, 100, 200));
    auto result = engine.process_order(limit_sell_u(1, uid, 100, 200)); // 200 > 100

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE(result.reason == "insufficient shares");
}

TEST_CASE("Preflight: rejects BUY market with insufficient cash") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    book.add_resting_order(limit_sell(99, 1000, 200));
    auto result = engine.process_order(market_buy_u(1, uid, 200)); // 1000*200=200000 > 100000

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE(result.reason == "insufficient cash");
}

TEST_CASE("Preflight: reserved balance counts against available cash") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    um.register_order(100, uid);
    um.on_order_resting(100, Side::Buy, 100, 900); // reserves 90000; available = 10000

    book.add_resting_order(limit_sell(99, 100, 200));
    auto result = engine.process_order(limit_buy_u(1, uid, 100, 200)); // 20000 > 10000

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE(result.reason == "insufficient cash");
}

TEST_CASE("Preflight: reserved shares count against available shares") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    um.register_order(100, uid);
    um.on_order_resting(100, Side::Sell, 100, 90); // reserved_shares=90; available=10

    book.add_resting_order(limit_buy(99, 100, 20));
    auto result = engine.process_order(limit_sell_u(1, uid, 100, 20)); // 20 > 10

    REQUIRE(result.status == OrderStatus::Rejected);
    REQUIRE(result.reason == "insufficient shares");
}

// ============================================================
// Balance updates via engine (on_fill + on_order_resting)
// ============================================================

TEST_CASE("Taker BUY: balance decreases, shares increase, no reservation") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long buyer  = um.next_user_id();
    long long seller = um.next_user_id();

    engine.process_order(limit_sell_u(1, seller, 100, 10)); // rests
    engine.process_order(limit_buy_u(2, buyer, 100, 10));   // takes

    auto bp = um.get_position(buyer);
    REQUIRE(bp.balance == 100000 - 1000);
    REQUIRE(bp.shares  == 100 + 10);
    REQUIRE(bp.reserved_balance == 0);

    auto sp = um.get_position(seller);
    REQUIRE(sp.balance == 100000 + 1000);
    REQUIRE(sp.shares  == 100 - 10);
    REQUIRE(sp.reserved_shares == 0); // released on fill
}

TEST_CASE("Taker SELL: balance increases, shares decrease, no reservation") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long buyer  = um.next_user_id();
    long long seller = um.next_user_id();

    engine.process_order(limit_buy_u(1, buyer, 100, 10));    // rests
    engine.process_order(limit_sell_u(2, seller, 100, 10));  // takes

    auto sp = um.get_position(seller);
    REQUIRE(sp.balance == 100000 + 1000);
    REQUIRE(sp.shares  == 100 - 10);

    auto bp = um.get_position(buyer);
    REQUIRE(bp.balance == 100000 - 1000);
    REQUIRE(bp.shares  == 100 + 10);
    REQUIRE(bp.reserved_balance == 0); // released on fill
}

TEST_CASE("Partial fill then rest: correct immediate debit and reservation") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    book.add_resting_order(limit_sell(99, 100, 3));

    // Buy 10: fills 3 immediately (taker), rests 7 at 100
    engine.process_order(limit_buy_u(1, uid, 100, 10));

    auto pos = um.get_position(uid);
    REQUIRE(pos.balance == 100000 - 300);  // 3 filled @ 100
    REQUIRE(pos.shares  == 100 + 3);
    REQUIRE(pos.reserved_balance == 700);  // 7 remaining @ 100 reserved
}

TEST_CASE("Cancel via engine releases reserved balance") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    engine.process_order(limit_buy_u(1, uid, 100, 5)); // rests; reserves 500

    REQUIRE(um.get_position(uid).reserved_balance == 500);
    engine.cancel_order(1);
    REQUIRE(um.get_position(uid).reserved_balance == 0);
}

TEST_CASE("Cancel via engine releases reserved shares") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    engine.process_order(limit_sell_u(1, uid, 100, 5)); // rests; reserves 5 shares

    REQUIRE(um.get_position(uid).reserved_shares == 5);
    engine.cancel_order(1);
    REQUIRE(um.get_position(uid).reserved_shares == 0);
}

// ============================================================
// Spy sinks for sink callback tests
// ============================================================

struct SpyTradeSink : TradeSink {
    std::vector<Trade> trades;
    void on_trade(const Trade& t) override { trades.push_back(t); }
};

struct SpyOrderSink : OrderSink {
    std::vector<OrderEvent> events;
    void on_order_event(const OrderEvent& e) override { events.push_back(e); }
};

TEST_CASE("net_qty and trade counters track across multiple fills") {
    OrderBook book;
    UserManager um("/dev/null");
    MatchingEngine engine(book, nullptr, nullptr, &um);

    long long uid = um.next_user_id();
    long long mm  = um.next_user_id();

    // mm provides liquidity on both sides
    engine.process_order(limit_sell_u(1, mm, 100, 10));
    engine.process_order(limit_sell_u(2, mm, 100, 5));
    engine.process_order(limit_buy_u(3, mm, 90, 20));

    // uid buys 10, then sells 5
    engine.process_order(limit_buy_u(10, uid, 100, 10));
    engine.process_order(limit_sell_u(11, uid, 90, 5));

    auto pos = um.get_position(uid);
    REQUIRE(pos.net_qty == 5);
    REQUIRE(pos.total_buy_qty  == 10);
    REQUIRE(pos.total_sell_qty == 5);
    REQUIRE(pos.total_buy_value  == 1000);
    REQUIRE(pos.total_sell_value == 450);
}

// ============================================================
// TradeSink tests
// ============================================================

TEST_CASE("TradeSink: not called when order rests with no fill") {
    OrderBook book;
    SpyTradeSink spy;
    MatchingEngine engine(book, &spy);

    engine.process_order(limit_buy(1, 100, 5));

    REQUIRE(spy.trades.empty());
}

TEST_CASE("TradeSink: called once with correct fields on exact fill") {
    OrderBook book;
    SpyTradeSink spy;
    MatchingEngine engine(book, &spy);

    book.add_resting_order(limit_sell(1, 100, 5));
    engine.process_order(limit_buy(2, 100, 5));

    REQUIRE(spy.trades.size() == 1);
    REQUIRE(spy.trades[0].maker_id == 1);
    REQUIRE(spy.trades[0].taker_id == 2);
    REQUIRE(spy.trades[0].price == 100);
    REQUIRE(spy.trades[0].qty == 5);
}

TEST_CASE("TradeSink: called once per fill when sweeping multiple price levels") {
    OrderBook book;
    SpyTradeSink spy;
    MatchingEngine engine(book, &spy);

    book.add_resting_order(limit_sell(1, 100, 3));
    book.add_resting_order(limit_sell(2, 101, 4));
    book.add_resting_order(limit_sell(3, 102, 5));

    engine.process_order(limit_buy(10, 102, 12));

    REQUIRE(spy.trades.size() == 3);
    REQUIRE(spy.trades[0].price == 100);
    REQUIRE(spy.trades[0].qty == 3);
    REQUIRE(spy.trades[1].price == 101);
    REQUIRE(spy.trades[1].qty == 4);
    REQUIRE(spy.trades[2].price == 102);
    REQUIRE(spy.trades[2].qty == 5);
}

TEST_CASE("TradeSink: seq and trade_id are distinct across fills") {
    OrderBook book;
    SpyTradeSink spy;
    MatchingEngine engine(book, &spy);

    book.add_resting_order(limit_sell(1, 100, 3));
    book.add_resting_order(limit_sell(2, 101, 3));
    engine.process_order(limit_buy(10, 101, 6));

    REQUIRE(spy.trades.size() == 2);
    REQUIRE(spy.trades[0].seq != spy.trades[1].seq);
    REQUIRE(spy.trades[0].trade_id != spy.trades[1].trade_id);
}

TEST_CASE("TradeSink: not called for rejected order") {
    OrderBook book;
    SpyTradeSink spy;
    MatchingEngine engine(book, &spy);

    engine.process_order(limit_buy(1, 100, 0)); // zero qty → rejected

    REQUIRE(spy.trades.empty());
}

TEST_CASE("TradeSink: not called for canceled market order with no liquidity") {
    OrderBook book;
    SpyTradeSink spy;
    MatchingEngine engine(book, &spy);

    engine.process_order(market_buy(1, 10));

    REQUIRE(spy.trades.empty());
}

TEST_CASE("TradeSink: maker_user_id and taker_user_id populated when user_manager present") {
    OrderBook book;
    SpyTradeSink spy;
    UserManager um("/dev/null");
    MatchingEngine engine(book, &spy, nullptr, &um);

    long long seller = um.next_user_id();
    long long buyer  = um.next_user_id();

    engine.process_order(limit_sell_u(1, seller, 100, 5));
    engine.process_order(limit_buy_u(2, buyer, 100, 5));

    REQUIRE(spy.trades.size() == 1);
    REQUIRE(spy.trades[0].maker_user_id == seller);
    REQUIRE(spy.trades[0].taker_user_id == buyer);
}

// ============================================================
// MultiTradeSink tests
// ============================================================

TEST_CASE("MultiTradeSink: fans out to all registered sinks") {
    OrderBook book;
    SpyTradeSink spy1, spy2;
    MultiTradeSink multi;
    multi.add_sink(&spy1);
    multi.add_sink(&spy2);
    MatchingEngine engine(book, &multi);

    book.add_resting_order(limit_sell(1, 100, 5));
    engine.process_order(limit_buy(2, 100, 5));

    REQUIRE(spy1.trades.size() == 1);
    REQUIRE(spy2.trades.size() == 1);
    REQUIRE(spy1.trades[0].price == spy2.trades[0].price);
    REQUIRE(spy1.trades[0].qty == spy2.trades[0].qty);
}

TEST_CASE("MultiTradeSink: empty sink list does not crash") {
    OrderBook book;
    MultiTradeSink multi;
    MatchingEngine engine(book, &multi);

    book.add_resting_order(limit_sell(1, 100, 5));
    REQUIRE_NOTHROW(engine.process_order(limit_buy(2, 100, 5)));
}

// ============================================================
// OrderSink tests
// ============================================================

TEST_CASE("OrderSink: rejected order emits single Rejected event without a prior New") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    engine.process_order(limit_buy(1, 100, 0)); // zero qty → rejected

    REQUIRE(spy.events.size() == 1);
    REQUIRE(spy.events[0].status == OrderStatus::Rejected);
    REQUIRE(spy.events[0].order_id == 1);
}

TEST_CASE("OrderSink: canceled market order emits single Canceled event") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    engine.process_order(market_buy(1, 5)); // no asks → canceled

    REQUIRE(spy.events.size() == 1);
    REQUIRE(spy.events[0].status == OrderStatus::Canceled);
    REQUIRE(spy.events[0].order_id == 1);
}

TEST_CASE("OrderSink: resting order emits New event with correct fields") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    engine.process_order(limit_buy(1, 100, 7));

    REQUIRE(spy.events.size() == 1);
    const auto& e = spy.events[0];
    REQUIRE(e.status == OrderStatus::New);
    REQUIRE(e.order_id == 1);
    REQUIRE(e.side == Side::Buy);
    REQUIRE(e.price == 100);
    REQUIRE(e.qty == 7);
    REQUIRE(e.remaining_qty == 7);
}

TEST_CASE("OrderSink: exact fill emits New(taker) Filled(maker) Filled(taker)") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    book.add_resting_order(limit_sell(1, 100, 5));
    engine.process_order(limit_buy(2, 100, 5));

    REQUIRE(spy.events.size() == 3);

    REQUIRE(spy.events[0].order_id == 2);
    REQUIRE(spy.events[0].status == OrderStatus::New);

    REQUIRE(spy.events[1].order_id == 1);
    REQUIRE(spy.events[1].status == OrderStatus::Filled);
    REQUIRE(spy.events[1].qty == 5);
    REQUIRE(spy.events[1].remaining_qty == 0);

    REQUIRE(spy.events[2].order_id == 2);
    REQUIRE(spy.events[2].status == OrderStatus::Filled);
    REQUIRE(spy.events[2].qty == 5);
    REQUIRE(spy.events[2].remaining_qty == 0);
}

TEST_CASE("OrderSink: taker partial fill emits New(taker) Filled(maker) PartiallyFilled(taker)") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    book.add_resting_order(limit_sell(1, 100, 3));
    engine.process_order(limit_buy(2, 100, 10));

    REQUIRE(spy.events.size() == 3);

    REQUIRE(spy.events[0].order_id == 2);
    REQUIRE(spy.events[0].status == OrderStatus::New);

    REQUIRE(spy.events[1].order_id == 1);
    REQUIRE(spy.events[1].status == OrderStatus::Filled);
    REQUIRE(spy.events[1].qty == 3);
    REQUIRE(spy.events[1].remaining_qty == 0);

    REQUIRE(spy.events[2].order_id == 2);
    REQUIRE(spy.events[2].status == OrderStatus::PartiallyFilled);
    REQUIRE(spy.events[2].qty == 3);        // filled amount
    REQUIRE(spy.events[2].remaining_qty == 7); // 10 - 3
}

TEST_CASE("OrderSink: maker partial fill emits PartiallyFilled for maker") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    book.add_resting_order(limit_sell(1, 100, 10));
    engine.process_order(limit_buy(2, 100, 4)); // fills 4 of maker's 10

    // New(taker), PartiallyFilled(maker), Filled(taker)
    REQUIRE(spy.events.size() == 3);

    REQUIRE(spy.events[1].order_id == 1);
    REQUIRE(spy.events[1].status == OrderStatus::PartiallyFilled);
    REQUIRE(spy.events[1].qty == 4);
    REQUIRE(spy.events[1].remaining_qty == 6);

    REQUIRE(spy.events[2].order_id == 2);
    REQUIRE(spy.events[2].status == OrderStatus::Filled);
}

TEST_CASE("OrderSink: cancel emits Canceled event for the canceled order") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    engine.process_order(limit_buy(1, 100, 5)); // rests → New emitted
    spy.events.clear();

    engine.cancel_order(1);

    REQUIRE(spy.events.size() == 1);
    REQUIRE(spy.events[0].order_id == 1);
    REQUIRE(spy.events[0].status == OrderStatus::Canceled);
}

TEST_CASE("OrderSink: sequence numbers increase monotonically") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    engine.process_order(limit_buy(1, 100, 5));
    engine.process_order(limit_buy(2, 99, 5));

    REQUIRE(spy.events.size() == 2);
    REQUIRE(spy.events[0].seq < spy.events[1].seq);
}

TEST_CASE("OrderSink: all events from one process_order share a batch_id") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    book.add_resting_order(limit_sell(1, 100, 5));
    engine.process_order(limit_buy(2, 100, 5)); // 3 events: New, Filled(maker), Filled(taker)

    REQUIRE(spy.events.size() == 3);
    long long bid = spy.events[0].batch_id;
    REQUIRE(spy.events[1].batch_id == bid);
    REQUIRE(spy.events[2].batch_id == bid);
}

TEST_CASE("OrderSink: different process_order calls produce different batch_ids") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    engine.process_order(limit_buy(1, 100, 5));
    engine.process_order(limit_buy(2, 99, 5));

    REQUIRE(spy.events.size() == 2);
    REQUIRE(spy.events[0].batch_id != spy.events[1].batch_id);
}

TEST_CASE("OrderSink: sweeping two levels produces events for each maker and final taker Filled") {
    OrderBook book;
    SpyOrderSink spy;
    MatchingEngine engine(book, nullptr, &spy);

    book.add_resting_order(limit_sell(1, 100, 3));
    book.add_resting_order(limit_sell(2, 101, 3));
    engine.process_order(limit_buy(10, 101, 6)); // exact sweep of both levels

    // New(taker), Filled(maker1), Filled(maker2), Filled(taker)
    REQUIRE(spy.events.size() == 4);
    REQUIRE(spy.events[0].order_id == 10);
    REQUIRE(spy.events[0].status == OrderStatus::New);
    REQUIRE(spy.events[1].order_id == 1);
    REQUIRE(spy.events[1].status == OrderStatus::Filled);
    REQUIRE(spy.events[2].order_id == 2);
    REQUIRE(spy.events[2].status == OrderStatus::Filled);
    REQUIRE(spy.events[3].order_id == 10);
    REQUIRE(spy.events[3].status == OrderStatus::Filled);
}
