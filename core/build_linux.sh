#!/usr/bin/env bash
set -e

echo "=== Bloomcore Linux x86_64 build (Docker) ==="

# Ensure we are in the core directory
if [ ! -f CMakeLists.txt ]; then
  echo "ERROR: Run this script from the core/ directory"
  exit 1
fi

BUILD_DIR="build-linux"

echo "→ Cleaning old Linux build directory (if any)"
rm -rf "$BUILD_DIR"

echo "→ Running Docker Linux build"
docker run --rm \
  --platform linux/amd64 \
  -v "$PWD:/app" \
  bloomcore-build \
  bash -c "
    cmake -S . -B $BUILD_DIR -DCMAKE_BUILD_TYPE=Release &&
    cmake --build $BUILD_DIR -j
  "

echo "→ Verifying binary architecture"
file "$BUILD_DIR/tcp_server"

echo "✓ Linux build complete"