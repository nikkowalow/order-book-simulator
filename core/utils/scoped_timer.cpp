#include "scoped_timer.hpp"
#include <chrono>
#include <iostream>
#include <iomanip>

ScopedTimer::ScopedTimer(const char* name)
    : name_(name),
      start_(std::chrono::high_resolution_clock::now()) {}

ScopedTimer::~ScopedTimer() {
    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> ms = end - start_;
    std::cout << std::fixed << std::setprecision(3)
            << name_ << " took " << ms.count() << " ms\n";
}