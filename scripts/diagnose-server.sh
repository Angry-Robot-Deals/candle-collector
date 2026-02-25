#!/bin/bash
# Run on server to diagnose why 23.88.34.218:14444 is not responding.
# Usage: ssh root@23.88.34.218 'cd /repos/candle-collector && bash scripts/diagnose-server.sh'

set -e
cd /repos/candle-collector 2>/dev/null || cd "$(dirname "$0")/.."
echo "=== Docker containers (project cc) ==="
docker compose -p cc -f docker-compose.yml ps -a 2>/dev/null || docker ps -a --filter name=cc

echo ""
echo "=== Port 14444 listening? ==="
ss -tlnp | grep 14444 || true
netstat -tlnp 2>/dev/null | grep 14444 || true

echo ""
echo "=== Last 40 lines of container log ==="
docker compose -p cc -f docker-compose.yml logs --tail=40 candles 2>/dev/null || docker logs cc-candles-1 --tail=40 2>&1 || true

echo ""
echo "=== App log file (last 30 lines) ==="
if [ -f ./logs/app.log ]; then
  tail -30 ./logs/app.log
else
  echo "  (no ./logs/app.log)"
fi

echo ""
echo "=== Curl from server localhost ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" --connect-timeout 5 http://localhost:14444/ || echo "  Connection failed"

echo ""
echo "=== .env present and DATABASE_URL set? ==="
if [ -f .env ]; then
  if grep -q "DATABASE_URL=" .env 2>/dev/null; then
    echo "  .env exists, DATABASE_URL is set (value hidden)"
  else
    echo "  .env exists but DATABASE_URL missing!"
  fi
else
  echo "  .env not found (deploy copies .env.production as .env)"
fi
