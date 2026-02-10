#!/usr/bin/env bash
set -e

EC2_USER=ubuntu
EC2_HOST=18.221.171.195
KEY=~/Downloads/orderbook-server-key.pem
REMOTE_DIR=/home/ubuntu/order-book-simulator/core/build
SERVICE=bloomcore
BIN=tcp_server

echo "=== Building Linux binary ==="
./build_linux.sh

echo "=== Uploading binary to EC2 ==="
scp -i "$KEY" build-linux/$BIN \
  $EC2_USER@$EC2_HOST:$REMOTE_DIR/$BIN.new

echo "=== Restarting service ==="
ssh -i "$KEY" $EC2_USER@$EC2_HOST << EOF
sudo systemctl stop $SERVICE
mv $REMOTE_DIR/$BIN.new $REMOTE_DIR/$BIN
chmod +x $REMOTE_DIR/$BIN
sudo systemctl start $SERVICE
sudo systemctl status $SERVICE --no-pager
EOF

echo "✓ Deploy complete"
