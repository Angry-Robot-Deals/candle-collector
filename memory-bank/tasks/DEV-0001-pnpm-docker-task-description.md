# DEV-0001: Migrate to pnpm, update deps, modernize Docker

## Task summary

Перевести проект с npm на pnpm, обновить все зависимости в `package.json` и в Docker Compose, привести Docker-конфигурацию к актуальному состоянию по документации, проверить сборку и деплой на сервер.

## Goals

1. **Package manager:** полный переход на pnpm (lockfile, команды в Docker и в документации).
2. **Dependencies:** обновить все зависимости в `package.json` до совместимых актуальных версий.
3. **Docker:** привести Dockerfile и docker-compose к текущим рекомендациям (Compose spec, best practices).
4. **Verification:** убедиться, что локальная сборка и деплой на сервер работают.

## Scope

### In scope

- Замена npm на pnpm в проекте (корень, Docker).
- Добавление `packageManager` в `package.json`, генерация `pnpm-lock.yaml`, удаление `package-lock.json`.
- Обновление зависимостей (production и dev) через pnpm.
- Dockerfile: установка pnpm, `pnpm install` / `pnpm run build` / `pnpm run start:prod`.
- docker-compose.yml: команда запуска через pnpm, при необходимости — актуализация формата и настроек по документации Docker.
- Обновление упоминаний npm → pnpm в README.md, memory-bank (techContext, projectbrief, style-guide).
- Проверка: `pnpm run build` успешен локально.
- Проверка: деплой на сервер (скрипт `scripts/external-deploy.sh`, образ на pnpm) выполняется и приложение запускается.

### Out of scope

- Смена версий Node/NestJS/Prisma по мажорным версиям (только обновление в рамках текущего мажора, если не требуется иное).
- Изменение логики приложения или API.
- CI (GitHub Actions и т.п.), если не упомянуты отдельно.

## Deliverables

- Репозиторий использует pnpm; `package-lock.json` удалён, `pnpm-lock.yaml` закоммичен.
- Dockerfile и docker-compose.yml переведены на pnpm и соответствуют актуальным практикам Docker.
- Документация (README, Memory Bank) обновлена под pnpm.
- Локальная сборка и деплой на сервер проверены и работают.

## Definition of done

- [ ] pnpm как единственный package manager в проекте (`packageManager` в package.json, pnpm-lock.yaml).
- [ ] Dockerfile собирает образ с pnpm и успешно выполняет build.
- [ ] docker-compose.yml запускает приложение через pnpm, соответствует текущей документации Docker.
- [ ] Зависимости обновлены, lockfile закоммичен.
- [ ] README и Memory Bank ссылаются на pnpm, а не npm.
- [ ] `pnpm run build` выполняется без ошибок.
- [ ] Деплой на сервер через `scripts/external-deploy.sh` успешен, контейнеры поднимаются и приложение отвечает.

## References

- Текущий package manager: npm (package-lock.json).
- Docker: Dockerfile (node:22-alpine), docker-compose.yml (сервис candles, порт 14444).
- Деплой: `scripts/external-deploy.sh` — копирование .env, ssh, git pull, docker compose build/up на сервере.
