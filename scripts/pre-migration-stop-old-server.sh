#!/bin/bash
# DEV-0004: Stop app and remove Docker on the OLD server (pre-migration).
# Uses OLD_APP_SERVER_USER and OLD_APP_SERVER_SSH_KEY from .env so you can keep
# APP_SERVER_* pointing to the new server. Run this before switching deploy target.

set -e

if [ -f ".env" ]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines; export non-empty values
    case "$key" in
      \#*|"") ;;
      *) export "$key=$value" ;;
    esac
  done < ".env"
else
  echo ".env file not found"
  exit 1
fi

if [ -z "${OLD_APP_SERVER_USER}" ] || [ -z "${OLD_APP_SERVER_SSH_KEY}" ]; then
  echo "Set OLD_APP_SERVER_USER and OLD_APP_SERVER_SSH_KEY in .env (old server, e.g. root@37.27.107.227)"
  exit 1
fi

echo "Connecting to OLD server: $OLD_APP_SERVER_USER"

ssh -i "$OLD_APP_SERVER_SSH_KEY" "$OLD_APP_SERVER_USER" << "EOF"

# Change to repo directory (may not exist if already cleaned)
if [ -d /repos/candle-collector ]; then
  cd /repos/candle-collector
  docker compose -p cc -f docker-compose.yml down --remove-orphans 2>/dev/null || true
  docker image rm cc-candles 2>/dev/null || true
fi

docker image prune -f -a
docker volume prune -f

echo "Docker cleanup on old server done."
EOF

echo "Pre-migration stop and cleanup completed."
