#include "logging/journal_trade_sink.hpp"
#include <iostream>

JournalTradeSink::JournalTradeSink(const std::string& path)
    : out_(path, std::ios::app)
{
}

void JournalTradeSink::on_trade(const Trade& t)
{

    std::cout << "JournalTradeSink: Logging trade " << t.trade_id << "\n";
    std::lock_guard<std::mutex> lk(mtx_);

    out_
        << "{"
        << "\"seq\":" << t.seq << ","
        << "\"trade_id\":" << t.trade_id << ","
        << "\"price\":" << t.price << ","
        << "\"qty\":" << t.qty << ","
        << "\"maker\":" << t.maker_id << ","
        << "\"taker\":" << t.taker_id << ","
        << "\"ts\":" << t.timestamp.count()
        << "}\n";

    out_.flush();
}