#!/bin/bash

if [ -f ".env" ]; then
  while IFS='=' read -r key value; do
    export "$key=$value"
  done < ".env"
else
  echo "Файл .env не найден"
  exit 1
fi

scp -i "$APP_SERVER_SSH_KEY" ./.env.production "$APP_SERVER_USER":/repos/candle-collector/.env

ssh -i "$APP_SERVER_SSH_KEY" "$APP_SERVER_USER" << "EOF"

# Переходим в директорию с репозиторием
cd /repos/candle-collector
pwd

# Останавливаем контейнеры
docker compose -p cc -f docker-compose.yml down --remove-orphans

docker volume rm cc_data
docker image rm cc-candles

# REMOVE ALL UNUSED DATA
docker image prune -f -a
docker volume prune -f

# Стягиваем последние изменения из репозитория
git reset --hard
git checkout main
git reset --hard
git pull

# Поднимаем контейнеры с последними изменениями
docker compose -p cc -f docker-compose.yml build
docker compose --env-file .env -p cc -f docker-compose.yml up -d --remove-orphans

EOF

# Сообщаем об успешном выполнении скрипта
echo "Deploy Done!"
