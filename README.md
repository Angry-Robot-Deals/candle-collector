# Candles

Fetches crypto exchange candles (K-lines) and saves them to a PostgreSQL database.

**Version:** 0.3.0 · **Author:** Pavel Valentov · **License:** MIT

## Supported exchanges

- Binance
- Bybit
- Gateio
- HTX
- Kucoin
- Mexc
- Okx
- Poloniex

## Tech stack

- **Runtime:** Node.js
- **Framework:** NestJS 10
- **ORM:** Prisma 6
- **Database:** PostgreSQL
- **Exchange data:** ccxt

## Prepare for launch

```bash
cp .env.example .env
```

Edit `.env` with your values. Main variables:

- `DATABASE_URL`, `SHADOW_DATABASE_URL` — PostgreSQL connection strings
- `API_PORT` — HTTP API port (default: 14444)
- `ENABLE_TOP_COIN_FETCH`, `ENABLE_CANDLE_D1_FETCH`, `ENABLE_ATHL_CALCULATION` — feature flags for background jobs
- `DAY_CANDLE_FETCH_EXCHANGES` — comma-separated list of exchanges for D1 candles (e.g. `binance,okx,poloniex,htx,bybit`)

## Running the app

### Docker (production-like)

```bash
docker compose -p cc -f docker-compose.yml build
docker compose --env-file .env -p cc -f docker-compose.yml up -d --remove-orphans
```

API: `http://localhost:14444` (or the port mapped in `docker-compose.yml`).

### Local development

```bash
pnpm install
pnpm exec prisma generate
pnpm run start:dev
```

Runs with watch mode; API port from `API_PORT` in `.env`.

### Stop (Docker)

```bash
docker compose -p cc -f docker-compose.yml down
```

## API overview

- `GET /` — health
- `GET /exchange` — list exchanges
- `GET /market` — list markets
- `GET /market/fetch-all` — trigger fetch of all markets
- `GET /market/fetch/:exchange` — fetch markets for one exchange
- `GET /updateTopCoins`, `GET /getTopCoins`, `GET /getTopCoinMarkets`, `GET /getTopCoinFirstExchange`
- `GET /getTopTradeCoins?turnover=...` — top coins by turnover
- `GET /getATHL`, `GET /getATHL/:symbol` — ATH/ATL and quantiles
- `POST /candle/list` — body: `{ exchange, symbol, timeframe }`
- `POST /candle/download` — body: `{ exchange, symbol, timeframe, start?, limit? }`

## Project documentation

- **Memory Bank** (task context, progress, tech/product notes): see `memory-bank/` directory.
- **Memory Bank docs:** `memory-bank/docs/README.md`.

## Scripts

- `pnpm run build` — Prisma generate + Nest build
- `pnpm run start` — run app (development)
- `pnpm run start:dev` — run with watch
- `pnpm run start:prod` — run compiled app (production)
- `pnpm run lint`, `pnpm run format` — lint and format
- `pnpm run test` — unit tests
- `pnpm run seed` — run Prisma seed
- `pnpm run init` — Prisma migrate dev (init)
