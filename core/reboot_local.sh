#!/usr/bin/env bash
set -e

CORE_DIR=~/dev/order-book-simulator/core
BUILD_DIR="$CORE_DIR/build"

echo "=== COMPILING AND REBOOTING C++ ==="

echo "=== Building services ==="
cmake --build "$BUILD_DIR" -j

echo "=== Purging Trade & Order Sinks ==="
: > "$CORE_DIR/trades.jsonl"
: > "$CORE_DIR/orders.jsonl"

echo "=== Starting TCP Server ==="
"$BUILD_DIR/tcp_server" 9000