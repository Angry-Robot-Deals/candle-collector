# TASK ARCHIVE: DEV-0001 — Migrate to pnpm, update deps, modernize Docker

**Task ID:** DEV-0001  
**Archived:** 2026-02-20  
**Complexity:** Level 2  
**Type:** infrastructure  
**Repository:** candles (angry/candles)  
**Branch:** main  

---

## METADATA

| Field | Value |
|-------|--------|
| Task ID | DEV-0001 |
| Title | Migrate to pnpm, update deps, modernize Docker, verify build and deploy |
| Started | 2026-02-20 |
| Status | completed |
| Priority | high |

---

## SUMMARY

The project was migrated from npm to pnpm; dependencies were updated; Docker was modernized (Node 24 LTS, multi-stage Dockerfile with pnpm, current Compose spec); and local build plus Docker run were verified. Follow-up work included fixing container startup via `env_file` in docker-compose, adding log volume and a deploy verify script, and fixing exchange API errors by normalizing symbol formats and introducing safe response parsing (`fetchJsonSafe`).

---

## REQUIREMENTS

- Use pnpm as the single package manager (lockfile, Docker, docs).
- Update dependencies and align Docker with current pnpm/Docker documentation.
- Verify local build and deployment to server.
- No remaining npm references in repo or Memory Bank docs.

---

## IMPLEMENTATION

### Core (DEV-0001 plan)

- **package.json:** `packageManager` set (pnpm 10); scripts use pnpm; `pnpm-lock.yaml` generated; `package-lock.json` removed.
- **.dockerignore:** Added; excludes node_modules, .git, .env, dist, etc.
- **Dockerfile:** Multi-stage with node:24-alpine, Corepack, pnpm, `pnpm install --frozen-lockfile`, `pnpm run build`, CMD `pnpm run start:prod`.
- **docker-compose.yml:** Command `pnpm run start:prod`; later added `env_file: - .env` and logs volume.
- **Docs:** README, techContext, projectbrief, style-guide — all npm references replaced with pnpm.
- **Tests:** global-variables-db.service.spec.ts fixed (mock PrismaService).

### Follow-up (same period)

- **Container env:** `env_file: - .env` in docker-compose so DATABASE_URL is available in container on server.
- **Logs:** Volume `./logs:/usr/app/logs`; logrotate config `scripts/logrotate-candles.conf`; verify script `scripts/verify-server.sh` (last 200 lines, critical errors only).
- **Exchange APIs:** `src/fetch-json-safe.ts` — `fetchJsonSafe()` (fetch + text + JSON parse with status/body logging) and `toExchangeSymbol` (noSeparator, underscore, hyphen). All exchange candle fetchers (binance, okx, poloniex, bybit, htx, mexc, gateio, kucoin) use normalized symbols and safe fetch; ERROR logging kept for real failures.

### Files changed (main)

- `package.json`, `pnpm-lock.yaml`, `.dockerignore`, `Dockerfile`, `docker-compose.yml`
- `README.md`, `memory-bank/techContext.md`, `memory-bank/projectbrief.md`, `memory-bank/style-guide.md`
- `scripts/external-deploy.sh`, `scripts/verify-server.sh`, `scripts/logrotate-candles.conf`
- `src/fetch-json-safe.ts` (new), `src/exchange-fetch-candles.ts`, `src/exchanges/mexc.ts`, `src/exchanges/gateio.ts`, `src/exchanges/kucoin.ts`, `src/app.service.ts`
- `src/global-variables-db.service.spec.ts`

---

## TESTING

- `pnpm run build` — succeeds.
- `pnpm run test` — succeeds (Prisma mock in global-variables-db.service.spec.ts).
- `docker compose build` and `docker compose up` — verified locally; app runs with DATABASE_URL from env_file.
- Deploy to server: manual step (run `pnpm run deploy` or `scripts/external-deploy.sh` on server with .env).

---

## LESSONS LEARNED

- Docker Compose on server must provide runtime config (e.g. env_file) so the same image works in production.
- Deploy verification should check only critical failures (e.g. DB/config) in recent log lines, not every exchange API message.
- Prefer fixing root causes (symbol format, response parsing) over downgrading ERROR to WARN; keep ERROR for real failures.
- Exchange APIs use different symbol formats (BTCUSDT vs BTC_USDT vs BTC-USDT); normalize per exchange when calling APIs.

---

## REFERENCES

- Reflection: [memory-bank/reflection/reflection-DEV-0001.md](../reflection/reflection-DEV-0001.md)
- Implementation plan: [memory-bank/tasks/DEV-0001-implementation-plan.md](../tasks/DEV-0001-implementation-plan.md)
- Tasks: [memory-bank/tasks.md](../tasks.md)

---

## STATUS

✅ COMPLETED AND ARCHIVED
