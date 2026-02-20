#!/bin/bash

if [ -f ".env" ]; then
  while IFS='=' read -r key value; do
    export "$key=$value"
  done < ".env"
else
  echo ".env file not found"
  exit 1
fi

ssh -i "$APP_SERVER_SSH_KEY" "$APP_SERVER_USER" << "EOF"

# Change to repo directory
cd /repos/candle-collector
pwd

# Stop containers
docker compose -p cc -f docker-compose.yml down --remove-orphans

EOF

echo "Application terminated successfully."
