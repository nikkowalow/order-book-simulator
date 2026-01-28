#include "market_maker/market_maker.hpp"

#include <iostream>
#include <chrono>
#include <thread>

MarketMaker::MarketMaker(OrderBook &book, MatchingEngine &engine, std::mutex &mtx)
    : book_(book), engine_(engine), mtx_(mtx)
{
}

MarketMaker::~MarketMaker()
{
    stop();
}

void MarketMaker::start()
{
    running_.store(true);
    thread_ = std::thread(&MarketMaker::run, this);

    std::cout << "MarketMaker started "
              << "(spread=" << spread_
              << ", qty=" << qty_
              << ", interval=" << interval_ms_ << "ms)\n";
}

void MarketMaker::stop()
{
    running_.store(false);
    if (thread_.joinable())
        thread_.join();
}

void MarketMaker::run()
{
    using namespace std::chrono_literals;

    while (running_.load())
    {
        {
            std::lock_guard<std::mutex> lk(mtx_);

            auto bb = book_.best_bid();
            auto ba = book_.best_ask();


            int mid;

            if (bb && ba)
                mid = (*bb + *ba) / 2;
            else if (bb)
                mid = *bb;
            else if (ba)
                mid = *ba;
            else
                mid = 100; // bootstrap price



            int new_bid_px = mid - spread_ / 2;
            int new_ask_px = mid + spread_ / 2;


            if (new_bid_px >= new_ask_px)
                new_bid_px = new_ask_px - 1;



            // std::cout << "bid_id_=" << bid_id_ << " new_bid_px=" << new_bid_px << " bid_px=" << bid_px_ << "\n";
            if (!bid_id_ || new_bid_px != bid_px_)
            {
                std::cout << "MarketMaker updating bid to " << new_bid_px << "\n";
                if (bid_id_)
                    book_.cancel_order(bid_id_);

                bid_id_ = engine_.next_order_id();
                bid_px_ = new_bid_px;

                engine_.process_order({bid_id_, Side::Buy, price: bid_px_, qty_, type: OrderType::Limit});
            }

            if (!ask_id_ || new_ask_px != ask_px_)
            {
                if (ask_id_)
                    book_.cancel_order(ask_id_);

                ask_id_ = engine_.next_order_id();
                ask_px_ = new_ask_px;

                engine_.process_order({ask_id_, Side::Sell, price: ask_px_, qty_, type: OrderType::Limit});
            }
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms_));
    }

    // Cleanup on shutdown
    {
        std::lock_guard<std::mutex> lk(mtx_);
        if (bid_id_)
            book_.cancel_order(bid_id_);
        if (ask_id_)
            book_.cancel_order(ask_id_);
    }
}
