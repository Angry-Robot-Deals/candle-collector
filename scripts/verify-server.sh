#!/bin/bash
# Verify API endpoints and check logs for errors. Run on server after deploy or locally with BASE_URL.
# Usage: BASE_URL=http://37.27.107.227:14444 ./scripts/verify-server.sh
# On server: cd /repos/candle-collector && ./scripts/verify-server.sh

set -e
BASE_URL="${BASE_URL:-http://localhost:14444}"
LOG_FILE="${LOG_FILE:-./logs/app.log}"
FAILED=0

echo "=== Checking endpoints at $BASE_URL ==="

check() {
  local path="$1"
  local name="${2:-$path}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$path" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  OK $name (HTTP $code)"
  else
    echo "  FAIL $name (HTTP $code)"
    FAILED=$((FAILED + 1))
  fi
}

check "" "GET /"
check "exchange" "GET /exchange"
check "market" "GET /market"
check "getTopCoins" "GET /getTopCoins"
check "getATHL" "GET /getATHL"
check "getTopTradeCoins" "GET /getTopTradeCoins"

echo ""
echo "=== Log file check ($LOG_FILE) ==="
if [ ! -f "$LOG_FILE" ]; then
  echo "  Log file not found (container may need a moment to start)"
else
  ERRORS=$(grep -iE "error|exception|failed|ECONNREFUSED|ECONNRESET|PrismaClientInitializationError|P1012" "$LOG_FILE" 2>/dev/null | tail -20)
  if [ -n "$ERRORS" ]; then
    echo "  Possible errors in log:"
    echo "$ERRORS" | sed 's/^/    /'
    FAILED=$((FAILED + 1))
  else
    echo "  No obvious errors in recent log"
  fi
  echo "  Last 5 log lines:"
  tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
fi

echo ""
if [ $FAILED -gt 0 ]; then
  echo "Verification finished with $FAILED failure(s)."
  exit 1
fi
echo "Verification passed."
exit 0
