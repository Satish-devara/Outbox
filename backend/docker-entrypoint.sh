#!/bin/sh
set -e

# Always start internal Redis server on 127.0.0.1:6379 as a robust fallback/primary daemon
echo "🚀 Starting internal Redis server on 127.0.0.1:6379..."
redis-server --daemonize yes --protected-mode no --save "" --appendonly no || true

# Wait for internal Redis to respond
for i in $(seq 1 10); do
  if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Internal Redis server is active on 127.0.0.1:6379"
    break
  fi
  sleep 0.2
done

exec "$@"
