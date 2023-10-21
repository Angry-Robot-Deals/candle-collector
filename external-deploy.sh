#!/bin/bash

if [ -f .env ]; then
  export $(xargs < .env)
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
echo "APP CI Done!"
