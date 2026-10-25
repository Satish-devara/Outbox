#!/bin/sh
set -e

# If REDIS_URL is not set or points to localhost/127.0.0.1, start internal Redis
if [ -z "$REDIS_URL" ] || echo "$REDIS_URL" | grep -qE "localhost|127\.0\.0\.1"; then
  echo "🚀 Starting internal Redis server on 127.0.0.1:6379..."
  redis-server --daemonize yes --protected-mode no --save "" --appendonly no || true
  
  # Wait for Redis to be ready
  for i in $(seq 1 10); do
    if redis-cli ping > /dev/null 2>&1; then
      echo "✅ Internal Redis server is ready"
      break
    fi
    sleep 0.5
  done
fi

exec "$@"
