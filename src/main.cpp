#include <iostream>

#include "book/order_book.hpp"
#include "engine/matching_engine.hpp"

static const char *side_str(Side s)
{
    return (s == Side::Buy) ? "BUY" : "SELL";
}

static void submit(MatchingEngine &engine, OrderBook &book, const Order &o)
{
    std::cout << "\nSubmitting " << side_str(o.side)
              << " id=" << o.id
              << " qty=" << o.qty
              << " @ " << o.price << "\n";

    auto trades = engine.process_limit_order(o);

    for (const auto &t : trades)
    {
        std::cout << "TRADE price=" << t.price
                  << " qty=" << t.qty
                  << " maker=" << t.maker_id
                  << " taker=" << t.taker_id
                  << "\n";
    }

    book.print_book(std::cout);
}

int main()
{
    OrderBook book;
    MatchingEngine engine(book);

    submit(engine, book, Order{.id = 1, .side = Side::Sell, .price = 101, .qty = 10});
    submit(engine, book, Order{.id = 2, .side = Side::Sell, .price = 101, .qty = 5});
    submit(engine, book, Order{.id = 3, .side = Side::Buy, .price = 101, .qty = 12});

    return 0;
}
