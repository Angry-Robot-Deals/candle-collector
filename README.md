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

## Security (repository is public)

**Do not commit** `.env`, `.env.production`, or any file with passwords, API keys, or real connection strings. Use `.env.example` as a template only (it has placeholders). See [SECURITY.md](SECURITY.md) for a before-push checklist.

## Prepare for launch

```bash
cp .env.example .env
```

Edit `.env` with your values. Main variables:

- `DATABASE_URL`, `SHADOW_DATABASE_URL` — PostgreSQL connection strings
- `API_PORT` — HTTP API port (default: 14444)
- `ENABLE_TOP_COIN_FETCH`, `ENABLE_UPDATE_TOP_COIN_FROM_CMC`, `ENABLE_CANDLE_D1_FETCH`, `ENABLE_ATHL_CALCULATION` — feature flags for background jobs
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
- `GET /updateTopCoins`, `GET /updateTopCoinsFromCmc` — update top coins from static JSON or CoinMarketCap
- `GET /getTopCoins`, `GET /getTopCoinMarkets`, `GET /getTopCoinFirstExchange`
- `GET /getTopTradeCoins?turnover=...` — top coins by turnover
- `GET /getATHL`, `GET /getATHL/:symbol` — ATH/ATL and quantiles
- `POST /candle/list` — body: `{ exchange, symbol, timeframe }`
- `POST /candle/download` — body: `{ exchange, symbol, timeframe, start?, limit? }`

## Project documentation

- **Memory Bank** (task context, progress, tech/product notes): see `memory-bank/` directory.
- **Memory Bank docs:** `memory-bank/docs/README.md`.

## Deploy (optional)

**Production deploy target:** `23.88.34.218` (DB server; API + feeder run in Docker, DB is local on the same host).

Deploy script `scripts/external-deploy.sh` uses `APP_SERVER_USER`, `APP_SERVER_SSH_KEY`, and copies `.env.production` to the server. Set them to the production host (e.g. `APP_SERVER_USER=root@23.88.34.218`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519`). Keep `.env.production` only locally (it is in `.gitignore`).

**New server checklist (first-time setup on 23.88.34.218):**

1. Install Docker and Docker Compose.
2. Install PostgreSQL; set `DATABASE_URL` in `.env.production` to the local DB (e.g. `localhost:5432` or `host.docker.internal` from container).
3. Clone repo to `/repos/candle-collector`; if private, configure GitHub access (SSH deploy key or HTTPS token).
4. Open port **14444** (firewall / security group).
5. Run `pnpm run deploy` from your local machine.

**Pre-migration (DEV-0004):** To stop the app and remove Docker on the *old* server before switching deploy target, set `OLD_APP_SERVER_USER` and `OLD_APP_SERVER_SSH_KEY` in `.env` and run `pnpm run pre-migration-stop`. See `memory-bank/tasks/DEV-0004-migration-runbook.md`.

## Scripts

- `pnpm run build` — Prisma generate + Nest build
- `pnpm run start` — run app (development)
- `pnpm run start:dev` — run with watch
- `pnpm run start:prod` — run compiled app (production)
- `pnpm run deploy` — deploy to production server (external-deploy.sh)
- `pnpm run down` — stop app on server (external-app-down.sh)
- `pnpm run pre-migration-stop` — stop app and remove Docker on *old* server (DEV-0004 pre-migration; set OLD_APP_SERVER_USER, OLD_APP_SERVER_SSH_KEY)
- `pnpm run lint`, `pnpm run format` — lint and format
- `pnpm run test` — unit tests
- `pnpm run seed` — run Prisma seed
- `pnpm run init` — Prisma migrate dev (init)
