#!/usr/bin/env bash
set -e

EC2_USER=ubuntu
EC2_HOST=18.221.171.195
KEY="$HOME/Downloads/orderbook-server-key.pem"
CORE_DIR=/home/ubuntu/order-book-simulator/core
REMOTE_DIR=/home/ubuntu/order-book-simulator/core/build
SERVICE=bloomcore
BIN=tcp_server

echo "=== Building Linux binary ==="
./build_linux.sh

echo "=== Ensuring remote directory exists ==="
ssh -i "$KEY" $EC2_USER@$EC2_HOST "mkdir -p $REMOTE_DIR"

echo "=== Uploading binary to EC2 ==="
chmod 400 "$KEY"
scp -i "$KEY" build-linux/$BIN \
  $EC2_USER@$EC2_HOST:$REMOTE_DIR/$BIN.new

echo "=== Restarting service ==="
ssh -i "$KEY" $EC2_USER@$EC2_HOST << EOF
sudo systemctl stop $SERVICE

mv $REMOTE_DIR/$BIN.new $REMOTE_DIR/$BIN
chmod +x $REMOTE_DIR/$BIN

: > $CORE_DIR/orders.jsonl
: > $CORE_DIR/trades.jsonl
: > $REMOTE_DIR/orders.jsonl
: > $REMOTE_DIR/trades.jsonl

sudo systemctl start $SERVICE
sudo systemctl status $SERVICE --no-pager
EOF

echo "✓ Deploy complete"