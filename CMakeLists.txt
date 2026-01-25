cmake_minimum_required(VERSION 3.10)

project(PortfolioOptimizationEngine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

include_directories(include)

add_executable(osmium
    src/main.cpp
    src/DataLoader.cpp
    src/PortfolioOptimizer.cpp
)
