#include "logging/journal_order_sink.hpp"

static const char* event_type_str(OrderEventType type) {
    switch (type) {
        case OrderEventType::New: return "NEW";
        case OrderEventType::Fill: return "FILL";
        case OrderEventType::PartialFill: return "PARTIAL_FILL";
        case OrderEventType::Cancelled: return "CANCELLED";
        case OrderEventType::Rejected: return "REJECTED";
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
        << "\"type\":\"" << event_type_str(e.type) << "\","
        << "\"price\":" << e.price << ","
        << "\"qty\":" << e.qty << ","
        << "\"remaining_qty\":" << e.remaining_qty << ","
        << "\"ts\":" << e.timestamp.count()
        << "}\n";

    out_.flush();
}
