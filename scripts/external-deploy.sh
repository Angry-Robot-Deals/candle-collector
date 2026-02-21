#!/bin/bash

if [ -f ".env" ]; then
  while IFS='=' read -r key value; do
    export "$key=$value"
  done < ".env"
else
  echo ".env file not found"
  exit 1
fi

scp -i "$APP_SERVER_SSH_KEY" ./.env.production "$APP_SERVER_USER":/repos/candle-collector/.env

ssh -i "$APP_SERVER_SSH_KEY" "$APP_SERVER_USER" << "EOF"

# Change to repo directory
cd /repos/candle-collector
pwd

# Stop containers
docker compose -p cc -f docker-compose.yml down --remove-orphans

docker image rm cc-candles 2>/dev/null || true
docker image prune -f -a
docker volume prune -f

# Pull latest from repository
git reset --hard
git checkout main
git reset --hard
git pull

# Ensure logs directory exists (bind-mounted into container)
mkdir -p logs

# Install logrotate config for app logs (optional, needs sudo)
if [ -f scripts/logrotate-candles.conf ] && [ -d /etc/logrotate.d ]; then
  sudo cp -f scripts/logrotate-candles.conf /etc/logrotate.d/candles 2>/dev/null || true
fi

# Build image (pnpm, Node 24 LTS) and start containers
docker compose -p cc -f docker-compose.yml build
docker compose --env-file .env -p cc -f docker-compose.yml up -d --remove-orphans

# Wait for app to start (DB connect retries ~30s) then verify endpoints and logs
sleep 35
if [ -f scripts/verify-server.sh ]; then
  chmod +x scripts/verify-server.sh
  BASE_URL=http://localhost:14444 LOG_FILE=./logs/app.log ./scripts/verify-server.sh || true
fi

EOF

echo "Deploy done."
