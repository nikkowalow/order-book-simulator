#include <atomic>
#include <chrono>
#include <random>
#include <tabulate/table.hpp>
#include <thread>

using namespace tabulate;
using Row_t = Table::Row_t;
std::atomic_bool keep_running(true);

void waitingForWorkEnterKey()
{
    while (keep_running)
    {
        if (std::cin.get() == 10)
        {
            keep_running = false;
        }
    }
    return;
}

int main()
{
    Table top;
    top.add_row({"BIDS", "ASKS"});

    top.format()
        .width(50)
        .corner(" ")
        .border_top(" ")
        .border_left(" ")
        .border_right(" ")
        // .border_bottom("-")
        .border_top(" ")
        .column_separator("|");

    top[0].format().padding_top(1).padding_bottom(1).font_align(FontAlign::center).font_style({FontStyle::underline}).font_background_color(Color::green);

    top[0][1].format().font_background_color(Color::red).font_color(Color::white);

    // --- Book header (4 columns) ---
    Table book;
    book.add_row({"Size", "Bid", "Ask", "Size"});

    book.format()
        .font_style({FontStyle::bold})
        .border_top("-")
        .border_bottom("-")
        .border_left("|")
        .border_right("|")
        .corner("+");

    // Your chosen fixed widths (note: 24x4 is very wide; keep if you like it)
    book.column(0).format().width(24).font_align(FontAlign::right);
    book.column(1).format().width(24).font_align(FontAlign::right);
    book.column(2).format().width(24).font_align(FontAlign::right);
    book.column(3).format().width(24).font_align(FontAlign::right);

    std::cout << top << std::endl;
    std::cout << book << std::endl;
    return 0;
}