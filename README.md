# Limit Order Book & Matching Engine Simulator

Limit Order Book & Matching Engine Simulator
A C++ implementation of a **price–time priority** limit order book and matching engine, exposing an HTTP API and a real-time UI for visualizing order flow, market depth, and executed trades.

This project is designed to model the core mechanics of modern electronic exchanges, with an emphasis on determinism, correctness, and clean system boundaries.

---

## Overview

At its core, the system maintains a **limit order book** consisting of resting buy and sell limit orders, organized by price and time. Incoming orders are matched according to standard exchange rules, producing trades that are immediately journaled and exposed to downstream consumers.

The project is intentionally split into clearly defined layers:

- a low-level matching engine written in C++
- an HTTP API for interaction and market data
- a frontend UI for visualization

---

## Key Features

- Price–time priority limit order book
- Support for both limit and market orders
- Partial fills and multi-trade matching
- Deterministic matching behavior
- Append-only trade journaling (JSONL)
- HTTP API for order entry and market data
- Real-time UI for order book depth and trade history

---

## Architecture

The system follows a simple but realistic pipeline:

<img width="761" height="921" alt="LOB ME drawio" src="https://github.com/user-attachments/assets/0f1235ad-80f0-4ffb-82e5-2eeca8bf311a" />

---

## Benchmarks

All benchmarks are run with a 5,000-order warmup pass followed by 50,000 measured orders on a fresh book. Latencies are measured with `std::chrono::steady_clock` at nanosecond resolution and reported in microseconds.

---

### CDF

Cumulative distribution of latency across all scenarios, zoomed to the 99.9th percentile. The steep left edge shows that the overwhelming majority of orders process well under 1 µs. The spread between scenarios reveals how much the matching complexity (resting vs. crossing vs. sweeping) affects the tail.

---

### Percentile Curve

Latency at every percentile from p50 to p99. The curve stays flat through the bulk of the distribution and rises sharply only in the extreme tail, confirming that high-latency events are rare and isolated rather than systemic.

---

### Latency vs Order Index

Raw latency plotted in the order each sample was recorded — no sorting applied. This is the most honest view of runtime behaviour. A flat trace indicates stable, consistent performance. Vertical spikes correspond to OS scheduler interruptions or memory allocator events. A rising trend would indicate structural degradation as the book grows.

---

### Tail Zoom (p99 → p100)

The top 1% of latency samples in detail. Market sweep scenarios occupy the far right as expected — sweeping 20 levels forces the matching loop to iterate through and consume multiple price levels in a single order, making them the most expensive operation in the engine.

---

### p50 / p90 / p99 Bar Chart

Side-by-side comparison of avg, p50, p90, and p99 for each scenario. Resting limit orders and cancels are the cheapest operations — they touch only the index and a single price level. Multi-level market sweeps are the most expensive, with p99 increasing roughly linearly with the number of levels consumed.

---

### Distribution (Violin)

Distribution shape for each scenario clipped at p90 for readability. Narrow violins indicate tight, predictable latency. Wider bodies at the top indicate a heavier tail. The sniper and noise bots in the mixed workload broaden the distribution compared to the pure resting scenario.

---

### Summary Table

Full numeric summary for every scenario: sample count, mean, p50, p90, p99, and max. The max column reflects worst-case OS jitter rather than engine performance — all scenarios share a similar worst-case ceiling regardless of complexity.
