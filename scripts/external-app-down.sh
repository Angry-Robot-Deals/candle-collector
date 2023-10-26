#!/bin/bash

if [ -f ".env" ]; then
  while IFS='=' read -r key value; do
    export "$key=$value"
  done < ".env"
else
  echo "Файл .env не найден"
  exit 1
fi

ssh -i "$APP_SERVER_SSH_KEY" "$APP_SERVER_USER" << "EOF"

# Переходим в директорию с репозиторием
cd /repos/candle-collector
pwd

# Останавливаем контейнеры
docker compose -p cc -f docker-compose.yml down --remove-orphans

EOF

# Сообщаем об успешном выполнении скрипта
echo "Application terminated successfully"
