#include <sim/seed_book.hpp>
#include <types/types.hpp>

void seed_book(OrderBook &book)
{
    // BIDS
    book.add_resting_order(Order{.id = 101, .side = Side::Buy, .price = 99, .qty = 120});
    book.add_resting_order(Order{.id = 102, .side = Side::Buy, .price = 99, .qty = 80});
    book.add_resting_order(Order{.id = 103, .side = Side::Buy, .price = 99, .qty = 55});

    book.add_resting_order(Order{.id = 104, .side = Side::Buy, .price = 98, .qty = 140});
    book.add_resting_order(Order{.id = 105, .side = Side::Buy, .price = 98, .qty = 65});

    book.add_resting_order(Order{.id = 106, .side = Side::Buy, .price = 97, .qty = 200});
    book.add_resting_order(Order{.id = 107, .side = Side::Buy, .price = 97, .qty = 90});

    book.add_resting_order(Order{.id = 108, .side = Side::Buy, .price = 96, .qty = 160});
    book.add_resting_order(Order{.id = 109, .side = Side::Buy, .price = 96, .qty = 75});

    book.add_resting_order(Order{.id = 110, .side = Side::Buy, .price = 95, .qty = 240});
    book.add_resting_order(Order{.id = 111, .side = Side::Buy, .price = 95, .qty = 110});

    book.add_resting_order(Order{.id = 112, .side = Side::Buy, .price = 94, .qty = 300});
    book.add_resting_order(Order{.id = 113, .side = Side::Buy, .price = 94, .qty = 150});

    book.add_resting_order(Order{.id = 114, .side = Side::Buy, .price = 93, .qty = 180});
    book.add_resting_order(Order{.id = 115, .side = Side::Buy, .price = 93, .qty = 95});

    book.add_resting_order(Order{.id = 116, .side = Side::Buy, .price = 92, .qty = 220});
    book.add_resting_order(Order{.id = 117, .side = Side::Buy, .price = 92, .qty = 60});

    // ASKS
    book.add_resting_order(Order{.id = 201, .side = Side::Sell, .price = 101, .qty = 70});
    book.add_resting_order(Order{.id = 202, .side = Side::Sell, .price = 101, .qty = 40});
    book.add_resting_order(Order{.id = 203, .side = Side::Sell, .price = 101, .qty = 25});

    book.add_resting_order(Order{.id = 204, .side = Side::Sell, .price = 102, .qty = 90});
    book.add_resting_order(Order{.id = 205, .side = Side::Sell, .price = 102, .qty = 55});

    book.add_resting_order(Order{.id = 206, .side = Side::Sell, .price = 103, .qty = 130});
    book.add_resting_order(Order{.id = 207, .side = Side::Sell, .price = 103, .qty = 60});

    book.add_resting_order(Order{.id = 208, .side = Side::Sell, .price = 104, .qty = 150});
    book.add_resting_order(Order{.id = 209, .side = Side::Sell, .price = 104, .qty = 80});

    book.add_resting_order(Order{.id = 210, .side = Side::Sell, .price = 105, .qty = 220});
    book.add_resting_order(Order{.id = 211, .side = Side::Sell, .price = 105, .qty = 100});

    book.add_resting_order(Order{.id = 212, .side = Side::Sell, .price = 106, .qty = 260});
    book.add_resting_order(Order{.id = 213, .side = Side::Sell, .price = 106, .qty = 140});

    book.add_resting_order(Order{.id = 214, .side = Side::Sell, .price = 107, .qty = 190});
    book.add_resting_order(Order{.id = 215, .side = Side::Sell, .price = 107, .qty = 75});

    book.add_resting_order(Order{.id = 216, .side = Side::Sell, .price = 108, .qty = 210});
    book.add_resting_order(Order{.id = 217, .side = Side::Sell, .price = 108, .qty = 90});
}
