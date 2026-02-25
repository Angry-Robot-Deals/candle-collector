# Reflection: DEV-0004 — Migrate feeder and API to DB server

**Task:** Migrate candle-collector (API + feeder) from server 37.27.107.227 to DB server 23.88.34.218 (Docker, port open, DB local)  
**Complexity:** Level 2  
**Started:** 2026-02-24  
**Completed:** 2026-02-25  

---

## Summary

Полная миграция сервиса с одного сервера на другой за один рабочий сеанс. На старом сервере (37.27.107.227) приложение остановлено, Docker очищен. На новом сервере (23.88.34.218) развёрнуто в Docker, PORT 14444 открыт, PostgreSQL работает локально через `host.docker.internal:51432`. В ходе задачи дополнительно сделано:
- логирование и logrotate;
- `verify-server.sh` и `diagnose-server.sh` для диагностики;
- ограничение CPU (`FETCH_CONCURRENT_EXCHANGES`, Docker CPU limits);
- обновление топ-коинов: `TOP_COIN_SYNC_LIMIT=150`, `CMC_FETCH_PAGES=100`;
- полный deployment pipeline: сборка образа, `git pull`, smoke-test встроен в скрипт.

**Итог:** API отвечает (`Works N minutes`), topCoin=149, все эндпоинты 200.

---

## What Went Well

- **Быстрый результат:** Вся миграция от остановки старого сервера до работающего API на новом заняла один сеанс (~несколько часов).
- **Диагностика:** Скрипты `verify-server.sh` и `diagnose-server.sh` сильно помогли — проблема с `2host.docker.internal` была обнаружена и исправлена за минуты.
- **Встроенная верификация в deploy:** После деплоя скрипт сам ждёт 35 секунд и запускает `verify-server.sh`, что исключает ситуацию «задеплоили и не проверили».
- **CPU reduction:** Идея с `FETCH_CONCURRENT_EXCHANGES` вышла за рамки задачи, но была реализована аккуратно (chunked loop, env-based config) и сразу задеплоена.
- **extra_hosts + host.docker.internal:** Простое решение для связи Docker-контейнера с PostgreSQL на хосте — одна строчка в `docker-compose.yml`, не требует ip-адресов или отдельной сети.
- **Runbook:** `DEV-0004-migration-runbook.md` стал полезным самодостаточным документом для будущих миграций.
- **Compliance прошёл чисто:** Lint 0 ошибок, все 5 тестов зелёные, PRD alignment полный.

---

## Challenges

### 1. Опечатка `2host.docker.internal`
**Проблема:** В `.env.production` (локальном) осталась опечатка из предыдущего сеанса: `2host.docker.internal` вместо `host.docker.internal`. Контейнер циклически перезапускался, API не отвечал.  
**Решение:** `sed -i` на сервере, пересоздание контейнера.  
**Урок:** Перед деплоем надо явно проверять `DATABASE_URL` в `.env.production` через `grep` или валидацию.

### 2. Docker CPU limits только в Stack-режиме
**Проблема:** `deploy.resources.limits.cpus` не применяется при `docker compose up` (только при `docker stack deploy`).  
**Решение:** Добавили `FETCH_CONCURRENT_EXCHANGES` как program-level throttle — он работает независимо от Docker-режима.  
**Урок:** Для CPU-ограничений в `docker compose` нужен `--cpus` флаг при запуске или управление на уровне приложения.

### 3. CMC update занял ~4.5 минуты
**Проблема:** `CMC_FETCH_PAGES=100` × `CMC_PAGE_DELAY_MS=1500ms` = 150 секунд только задержки. HTTP-запрос к `/updateTopCoinsFromCmc` висел почти 5 минут.  
**Решение:** Ждали с `--max-time 300`.  
**Урок:** Длительные операции не должны быть синхронными HTTP-эндпоинтами. В будущем стоит сделать `POST /updateTopCoinsFromCmc` асинхронным (202 Accepted + background job).

### 4. Повторный деплой на старый сервер
**Проблема:** В процессе миграции один из деплоев ушёл на старый сервер (37.27.107.227), потому что `.env` ещё не был обновлён.  
**Решение:** Остановили и удалили контейнер ещё раз; обновили `.env`.  
**Урок:** После обновления `APP_SERVER_USER` в `.env` — сразу проверить командой `grep APP_SERVER_USER .env` прежде чем запускать deploy.

---

## Lessons Learned

1. **Валидация `.env.production` перед деплоем:** Добавить в `external-deploy.sh` проверку хоста в `DATABASE_URL` (grep + warn), чтобы очевидные опечатки вроде `2host` выявлялись до сборки образа.
2. **Асинхронные долгие операции:** Любая операция, которая может длиться >30 секунд (CMC, bulk data), должна запускаться в фоне (job queue, background timeout) и возвращать `202 + job id` вместо синхронного ответа.
3. **Проверить target перед деплоем:** Перед запуском `pnpm run deploy` — явно вывести целевой сервер: `grep APP_SERVER_USER .env`.
4. **CPU throttle на уровне приложения надёжнее:** `FETCH_CONCURRENT_EXCHANGES` срабатывает всегда, независимо от того, как запущен Docker. Docker-level limits — бонус, не основной механизм.
5. **`diagnose-server.sh` окупился сразу:** Скрипт с port-check + curl + log-tail помог диагностировать проблему за одну команду вместо нескольких ручных шагов.

---

## Process Improvements

- **Pre-deploy checklist:**
  ```
  □ grep APP_SERVER_USER .env              # correct target server?
  □ grep DATABASE_URL .env.production      # no typos (2host, etc.)?
  □ git status → all changes committed?
  □ git push → in sync with remote?
  ```
- **После `pnpm run deploy`:** скрипт уже запускает `verify-server.sh`; если там FAIL — не считать деплой успешным.
- **Для долгих API-операций:** при написании нового контроллера сразу оценивать, может ли он занять >30с. Если да — async pattern.

---

## Technical Improvements

- **Валидация `DATABASE_URL` в `external-deploy.sh`:** Перед `scp .env.production` добавить:
  ```bash
  if grep -q '2host\|typo' .env.production 2>/dev/null; then
    echo "ERROR: suspicious DATABASE_URL in .env.production"; exit 1
  fi
  ```
  Или более общую валидацию через regex.
- **`/updateTopCoinsFromCmc` → async:** Вернуть `202 Accepted` + запустить job в фоне. Добавить `GET /updateTopCoinsFromCmc/status` для polling.
- **`FETCH_CONCURRENT_EXCHANGES` в `.env` на сервере:** После деплоя — добавить в `.env` на 23.88.34.218 явно: `FETCH_CONCURRENT_EXCHANGES=2`. Сейчас используется default=2, но лучше явное.
- **Logrotate проверка:** Убедиться, что `/etc/logrotate.d/candles` установлен корректно (`sudo logrotate --debug /etc/logrotate.d/candles`).

---

## Next Steps

- Перейти к **/archive** для финализации DEV-0004.
- Обновить статус DEV-0004 в `tasks.md`: `in_progress → completed`.
- В будущей задаче: реализовать асинхронный `updateTopCoinsFromCmc`.
- DEV-0005 (Bitget, full test coverage) — уже описан в backlog; может стартовать.
