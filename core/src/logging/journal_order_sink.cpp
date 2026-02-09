#include "logging/journal_order_sink.hpp"
#include "types/types.hpp"

static const char* event_type_str(OrderStatus type) {
    switch (type) {
        case OrderStatus::New: return "NEW";
        case OrderStatus::Filled: return "FILL";
        case OrderStatus::PartiallyFilled: return "PARTIAL_FILL";
        case OrderStatus::Canceled: return "CANCELLED";
        case OrderStatus::Rejected: return "REJECTED";
    }
    return "UNKNOWN";
}

static const char* side_str(Side side) {
    switch (side) {
        case Side::Buy: return "BUY";
        case Side::Sell: return "SELL";
    }
    return "UNKNOWN";
}

JournalOrderSink::JournalOrderSink(const std::string& path)
    : out_(path, std::ios::app)
{
}

void JournalOrderSink::on_order_event(const OrderEvent& e)
{
    std::lock_guard<std::mutex> lk(mtx_);

    out_
        << "{"
        << "\"seq\":" << e.seq << ","
        << "\"batch_id\":" << e.batch_id << ","
        << "\"order_id\":" << e.order_id << ","
        << "\"user_id\":" << e.user_id << ","
        << "\"type\":\"" << event_type_str(e.status) << "\","
        << "\"side\":\"" << side_str(e.side) << "\","
        << "\"price\":" << e.price << ","
        << "\"qty\":" << e.qty << ","
        << "\"remaining_qty\":" << e.remaining_qty << ","
        << "\"ts\":" << e.timestamp.count()
        << "}\n";

    out_.flush();
}
