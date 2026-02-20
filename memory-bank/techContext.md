# Tech Context: Candles

**Note:** Repository is public. Env and secrets live only in `.env` / `.env.production` (both in `.gitignore`). See root [SECURITY.md](../SECURITY.md).

## Stack

- **Runtime:** Node.js  
- **Framework:** NestJS 10.x  
- **Language:** TypeScript 5.7  
- **ORM:** Prisma 6.5  
- **DB:** PostgreSQL (DATABASE_URL, SHADOW_DATABASE_URL)  
- **Exchange data:** ccxt 4.x  
- **Env:** dotenv; TZ=UTC in scripts  

## Structure

- `src/` — приложение: `main.ts`, `app.module.ts`, контроллер, сервисы.
- `prisma/` — `schema.prisma`, миграции, seed.
- `src/exchanges/` — адаптеры бирж (kucoin, gateio, mexc + интерфейсы).
- `src/exchange-fetch-candles.ts` — binance, bybit, htx, okx, poloniex.
- `src/timeseries*.ts` — таймфреймы, константы, утилиты времени.
- `data/` — статика (например, coins-top-500.json).
- `scripts/` — deploy/down (external-deploy.sh, external-app-down.sh).

## Key Env Vars

- `DATABASE_URL`, `SHADOW_DATABASE_URL` — PostgreSQL.
- `API_PORT` — порт API (default 14444).
- `ENABLE_TOP_COIN_FETCH`, `ENABLE_CANDLE_D1_FETCH`, `ENABLE_ATHL_CALCULATION` — флаги фоновых задач.
- `DAY_CANDLE_FETCH_EXCHANGES` — список бирж для D1 (binance,okx,poloniex,htx,bybit).
- `APP_SERVER_USER`, `APP_SERVER_SSH_KEY` — для deploy-скриптов.

## Build & Run

- `pnpm run build` — prebuild: prisma generate; nest build.
- `pnpm run start:dev` — dev с watch, TZ=UTC.
- `pnpm run start:prod` — node dist/src/main.
- Docker: build from Dockerfile (target: production), command: pnpm run start:prod, port 14444.
- **Package manager:** pnpm (Node 24 LTS in Docker).
