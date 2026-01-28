#pragma once

#include <chrono>

class ScopedTimer {
public:
    explicit ScopedTimer(const char* name);
    ~ScopedTimer();

private:
    const char* name_;
    std::chrono::high_resolution_clock::time_point start_;
};