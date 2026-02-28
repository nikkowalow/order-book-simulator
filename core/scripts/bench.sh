#!/usr/bin/env bash
set -euo pipefail

# Resolve project root (directory above scripts/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="/Users/nikkokowalow/miniconda3/bin/python"
BUILD_DIR="$PROJECT_ROOT/build"
OUT_DIR="$PROJECT_ROOT/bench_output"
PLOT_SCRIPT="$PROJECT_ROOT/src/bench/bench_plot.py"

echo "==> Project root: $PROJECT_ROOT"

# Ensure build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "==> Creating build directory"
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    cmake ..
else
    cd "$BUILD_DIR"
fi

echo "==> Building (release)"
cmake --build . -j

echo "==> Ensuring output directory exists"
mkdir -p "$OUT_DIR"

echo "==> Running benchmark"
./bench "$OUT_DIR/bench_results.csv"

echo "==> Generating report"
"$PYTHON" "$PLOT_SCRIPT" \
    "$OUT_DIR/bench_results.csv" \
    "$OUT_DIR/bench_report.png"

echo ""
echo "✔ Done"
echo "  CSV:    $OUT_DIR/bench_results.csv"
echo "  Report: $OUT_DIR/bench_report.png"