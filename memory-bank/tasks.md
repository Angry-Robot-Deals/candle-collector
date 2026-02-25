# Tasks

## Task ID: DEV-0005

**Title:** Add Bitget exchange — candle fetching, API docs audit, full test coverage, deploy

**Status:** planned
**Complexity:** Level 3
**Started:** —
**Type:** feature + quality
**Priority:** high
**Repository:** candles
**Branch:** main

### Summary

Full integration of Bitget exchange into the candle-collector service: fetch latest Bitget API docs, implement the adapter (same pattern as kucoin/gateio/mexc), wire it into the exchange fetch loop, audit and update docs for all existing exchanges, verify all exchange adapters against current APIs, write full test coverage for exchange adapters and DB methods, then test → fix → deploy → verify.

### Goals

1. **Bitget adapter** — implement `src/exchanges/bitget.ts` and `src/exchanges/bitget.interface.ts` following the same pattern as kucoin/gateio/mexc: `toExchangeSymbol`, `getCandleURI`, `fetchCandles`, `bitgetFindFirstCandle`, `bitgetFetchCandles`, DTO mapper `bitgetCandleToCandleModel`.
2. **Wire into feeder** — register Bitget in `exchange.constant.ts`, `exchange-dto.ts`, `interface.ts`, and in the fetch loop in `app.service.ts` (same flow as existing exchanges); add `ENABLE_BITGET_FETCH` or add to `DAY_CANDLE_FETCH_EXCHANGES` env.
3. **Exchange docs audit** — for each exchange (Binance, OKX, Bybit, HTX/Huobi, Poloniex, KuCoin, Gate.io, MEXC, Bitget): fetch current API documentation URLs (Candles/Klines endpoint), verify our endpoint URLs and field mappings against current docs, update `memory-bank/docs/exchange-api-reference.md` with endpoint URLs, timeframe maps, symbol formats, pagination info, and source doc links.
4. **Code compliance check** — verify all adapters (exchange-fetch-candles.ts, exchanges/*.ts) match live API structure: URL patterns, request params, response shapes, error codes; note and fix any discrepancies.
5. **Test coverage** — write Jest tests covering: (a) each exchange `fetchCandles` function (mock HTTP, assert `CandleDb[]` shape and mapper logic); (b) each `FindFirstCandle` function (mock responses for found/not-found/error); (c) Prisma service DB methods (candle upsert, market queries, GlobalVar, TopCoin/CMC queries) using in-memory mock or test DB.
6. **Test → fix → test cycle** — run tests, fix failures, ensure green.
7. **Push → deploy → verify** — push to main, run deploy script to production (23.88.34.218), smoke-test Bitget endpoint returns candle data, report full health status.

### Success Criteria

- `bitgetFetchCandles` and `bitgetFindFirstCandle` implemented, integrated, and collecting candles on production.
- `memory-bank/docs/exchange-api-reference.md` created with current endpoint docs and source links for all 9 exchanges.
- All exchange adapters verified against current API docs; fixes applied if needed.
- Test suite: all exchange adapter tests + DB method tests pass (`pnpm test`).
- Production (23.88.34.218): feeder running, Bitget candles in DB, health endpoint green.

### Architecture Impact

- **New files:** `src/exchanges/bitget.ts`, `src/exchanges/bitget.interface.ts`, `src/exchanges/bitget.spec.ts`, `memory-bank/docs/exchange-api-reference.md`.
- **Modified files:** `src/exchange.constant.ts` (BITGET_TIMEFRAME), `src/exchange-dto.ts` (bitgetCandleToCandleModel), `src/interface.ts` (OHLCV_Bitget), `src/app.service.ts` (register Bitget in fetch loop), `.env.example` (new flag if added), `memory-bank/techContext.md`.
- **Test files:** `src/exchanges/*.spec.ts` for each adapter; `src/prisma.service.spec.ts` (or augment existing).
- **No DB schema changes required** — Bitget uses existing `Candle` table + Exchange/Market/Symbol rows (seeded or auto-created via market fetch).

### Steps

1. **Fetch Bitget API docs** (context7 / web) — get current candles endpoint: URL, params, response shape, timeframe map, symbol format, pagination, rate limits.
2. **Audit existing exchange docs** — for each of 8 existing exchanges: verify our URL vs. current API docs; document discrepancies.
3. **Create `exchange-api-reference.md`** — table: Exchange | Endpoint URL pattern | Symbol format | Timeframe map | Pagination | Doc link.
4. **Fix discrepancies** found in step 2 (if any) — minimal, targeted edits to exchange adapters.
5. **Implement Bitget adapter** — `bitget.interface.ts` (BITGET_TIMEFRAME enum, OHLCV_Bitget type), `bitget.ts` (all functions), register in constants/dto/interface files.
6. **Wire Bitget into app.service.ts** — add to exchange fetch dispatch (same pattern as kucoin/gateio/mexc integration).
7. **Write tests** — per-exchange adapter tests (mock fetch), DB method tests (mock Prisma).
8. **Run tests, fix failures** — iterate until green.
9. **Update docs** — `memory-bank/techContext.md`, `memory-bank/activeContext.md`, `.env.example`.
10. **Push → deploy → smoke test → report**.

---

## Task ID: DEV-0004

**Title:** Migrate feeder and API to DB server (Docker, open port; DB local)

**Status:** archived  
**Complexity:** Level 2  
**Started:** 2026-02-24  
**Completed:** 2026-02-25  
**Type:** infrastructure / migration  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Reflection:** memory-bank/reflection/reflection-DEV-0004.md  
**Archive:** memory-bank/archive/archive-DEV-0004.md  

### Summary

- **Target server (new):** `ssh root@23.88.34.218` — API + feeder in Docker, port open; DB on same host (local).
- **Source server (current):** `ssh -i ~/.ssh/id_ed25519 root@37.27.107.227` — app runs here now.
- **Pre-migration:** On the *current* server: stop the application, then remove Docker (containers, images, optionally Docker itself).

### Goals

1. **Pre-migration (current server 37.27.107.227)**  
   - Stop the candle-collector service (e.g. `scripts/external-app-down.sh` or manual `docker compose down`).  
   - Remove Docker: tear down containers/images and, if desired, uninstall Docker on that host.

2. **Migration to DB server (23.88.34.218)**  
   - Deploy the same app (feeder + API) to the new server via Docker.  
   - Open the API port (e.g. 14444) on the new server.  
   - Configure the app to use the DB **locally** on the same server (e.g. `DATABASE_URL` pointing to localhost or the same host).

3. **Documentation / automation**  
   - Update deploy scripts and docs so that future deploys target the new server (e.g. `APP_SERVER_USER=root@23.88.34.218`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519` or another key).  
   - If the new server needs GitHub access for `git pull`: document or configure SSH key (or HTTPS); inform if keys need to be set up.

### Success criteria

- Current server (37.27.107.227): app stopped, Docker removed as specified.  
- New server (23.88.34.218): app (API + feeder) runs in Docker, port 14444 (or chosen port) open and reachable; DB connection uses local DB on the same server.  
- Deploy script and env (e.g. `.env.example` / docs) point to the new server; optional: note about GitHub keys on the new host.

### Notes

- **GitHub keys:** If the new server will run `git pull` (e.g. from `scripts/external-deploy.sh`), it needs either: (1) SSH key added to GitHub (deploy key or user key), or (2) HTTPS with token. If keys are not yet set up on 23.88.34.218, document the need and steps (or add a short checklist) and inform the user.

---

# DEV-0004 Implementation Plan: Migrate feeder and API to DB server

## 1. Overview

**Problem:** The candle-collector app (API + feeder) currently runs on server 37.27.107.227. It must be moved to the DB server 23.88.34.218 so that the app and database run on the same host (DB local). The old server must be shut down and Docker removed before the new deployment.

**Goals:**

1. On **current server** (37.27.107.227): stop the application, then remove Docker (containers, images, optionally Docker engine).
2. On **new server** (23.88.34.218): deploy API + feeder via Docker, open API port (14444), configure app to use local DB on the same host.
3. Update deploy automation and docs so future deploys target the new server; document GitHub key setup on the new host if needed.

**Success criteria:**

- 37.27.107.227: app stopped, Docker removed as specified.
- 23.88.34.218: app runs in Docker, port 14444 open and reachable; `DATABASE_URL` points to local DB.
- `.env` / docs use new server (e.g. `APP_SERVER_USER=root@23.88.34.218`); optional checklist for GitHub keys on new host.

---

## 2. Security Summary

- **Attack surface:** Unchanged (same app, same port; only host and DB location change). Firewall/port rules on the new server should be verified.
- **New permissions:** None in code. Server access shifts to root@23.88.34.218; ensure SSH key and access are controlled.
- **Sensitive data:** `.env.production` and `DATABASE_URL` remain in deploy flow; no new exposure. DB on same host reduces network exposure of DB.
- **Risks:** (1) Wrong server targeted during transition — mitigate by updating env once and using one source of truth. (2) New server lacks GitHub access for `git pull` — document and optionally add deploy key. (3) Firewall on 23.88.34.218 may block 14444 — document opening the port.

---

## 3. Architecture Impact

- **Components:** `scripts/external-deploy.sh`, `scripts/external-app-down.sh` (usage/flow unchanged; env vars point to new host). Local `.env`: `APP_SERVER_USER`, `APP_SERVER_SSH_KEY`. New server: Docker, repo at `/repos/candle-collector`, `.env` with local `DATABASE_URL`.
- **Integration:** Deploy script SSHs to `APP_SERVER_USER`, copies `.env.production` to server, runs `git pull` and `docker compose` on the server. App in container connects to DB via `DATABASE_URL` (on new server: localhost or same-host PostgreSQL).

---

## 4. Detailed Design

### 4.1 Component Changes

| File / location | Changes | Reason |
|-----------------|---------|--------|
| Local `.env` (dev machine) | Set `APP_SERVER_USER=root@23.88.34.218`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519` (or key used for 23.88.34.218). | Deploy script uses these to target the new server. |
| `.env.production` (local) | Ensure `DATABASE_URL` (and `SHADOW_DATABASE_URL` if used) point to DB on 23.88.34.218 (e.g. `postgresql://user:pass@localhost:5432/dbname` or `@host.docker.internal` if DB in another container on same host). | App on new server must use local DB. |
| `memory-bank/techContext.md` or README | Document new server as deploy target; optional: firewall (open 14444), GitHub key checklist for server. | Single source of truth for deploy target and prerequisites. |

### 4.2 New Components

| Item | Purpose | Dependencies |
|------|---------|--------------|
| Optional: `memory-bank/tasks/DEV-0004-migration-runbook.md` or section in docs | Step-by-step runbook: pre-migration (stop + remove Docker on old server), prepare new server (Docker, repo, env), first deploy, verification. | None. |
| Optional: `scripts/pre-migration-stop-old-server.sh` | Script that SSHs to old server (37.27.107.227), runs down + Docker cleanup (and optionally uninstall Docker). | `.env` with vars for *old* server or explicit args. |

### 4.3 API Changes

- None. Same API and port (14444); only host changes.

### 4.4 Database Changes

- None in schema. Only `DATABASE_URL` on the new server must point to the local PostgreSQL instance (same host).

---

## 5. Security Design (Appendix A)

### 5.1 Threat Model

- **Assets:** App availability, DB and env on new server, SSH access.
- **Threats:** Misuse of root/SSH on new server; exposure of 14444 to unintended networks; accidental deploy to wrong host.
- **Mitigations:** Use dedicated SSH key for deploy; document correct `APP_SERVER_*` values; on new server, open only required ports (e.g. 22, 14444) and restrict by firewall if needed.

### 5.2 Security Controls Checklist

- [x] No new secrets in repo; `.env.production` stays local and is copied via scp.
- [x] Deploy uses SSH key (no password in script).
- [x] DB on same host reduces DB network exposure.
- [ ] Confirm firewall/security group on 23.88.34.218 allows 14444 only where intended.
- [ ] Document that GitHub key on new server (if used) should be read-only deploy key where possible.

---

## 6. Implementation Steps

### Step 1: Pre-migration — stop app and remove Docker on current server (37.27.107.227)

**Actions:**

1. From local machine, ensure `.env` still has old server for this run:  
   `APP_SERVER_USER=root@37.27.107.227`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519`.
2. Run stop script:  
   `pnpm run down` (or `bash scripts/external-app-down.sh`).  
   This SSHs to 37.27.107.227 and runs `docker compose -p cc -f docker-compose.yml down --remove-orphans`.
3. SSH to the current server and remove Docker resources (and optionally Docker itself):

```bash
# SSH to current server
ssh -i ~/.ssh/id_ed25519 root@37.27.107.227

# In /repos/candle-collector (if still present)
cd /repos/candle-collector
docker compose -p cc -f docker-compose.yml down --remove-orphans

# Remove images and cleanup
docker image rm cc-candles 2>/dev/null || true
docker image prune -f -a
docker volume prune -f

# Optional: uninstall Docker (example for Debian/Ubuntu)
# apt-get remove -y docker-ce docker-ce-cli containerd.io
# apt-get purge -y docker-ce docker-ce-cli containerd.io
```

**Rationale:** Clean shutdown and removal on old host before switching deploy target.

### Step 2: Prepare new server (23.88.34.218)

**Actions:**

1. SSH: `ssh root@23.88.34.218` (or with key if required: `ssh -i ~/.ssh/id_ed25519 root@23.88.34.218`).
2. Install Docker and Docker Compose if not present (e.g. Docker docs for the distro).
3. Ensure PostgreSQL is installed and running locally; create DB and user if needed; note connection string for `DATABASE_URL`.
4. Clone repo (or prepare for first deploy):  
   `git clone <repo-url> /repos/candle-collector` (or ensure directory exists and deploy script will run `git pull`).  
   If repo is private: add SSH deploy key to GitHub and use SSH clone URL, or use HTTPS + token.
5. Create `logs` directory: `mkdir -p /repos/candle-collector/logs`.

**Rationale:** New server must have Docker, local DB, and repo in place before first deploy.

### Step 3: Update local env and .env.production for new server

**Files:** Local `.env`, `.env.production` (both in `.gitignore`).

**Changes:**

- In `.env`: set  
  `APP_SERVER_USER=root@23.88.34.218`  
  `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519`  
  (or the key that can SSH to 23.88.34.218).
- In `.env.production`: set  
  `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public`  
  (and `SHADOW_DATABASE_URL` if used) for the DB on 23.88.34.218.  
  If the app runs in Docker and DB is on host, use `host.docker.internal` or the host’s LAN IP if required by the OS.

**Rationale:** Deploy script and app config must target the new server and its local DB.

### Step 4: First deploy to new server

**Actions:**

1. From repo root (with updated `.env` and `.env.production`):  
   `bash scripts/external-deploy.sh`  
   (or `pnpm run deploy` if defined).
2. Script will: scp `.env.production` to `root@23.88.34.218:/repos/candle-collector/.env`, then SSH and run `git pull`, `docker compose build`, `docker compose up -d`.
3. Open port 14444 on the new server (firewall/security group): e.g. `ufw allow 14444/tcp` or cloud security group rule.
4. Verify: from local machine, `curl http://23.88.34.218:14444/` (or health endpoint). On server, `./scripts/verify-server.sh` if available.

**Rationale:** Single automated path for deploy; manual port and smoke test ensure correctness.

### Step 5: Document deploy target and optional GitHub key checklist

**Files:** `README.md`, optionally `memory-bank/techContext.md` or `memory-bank/tasks/DEV-0004-migration-runbook.md`.

**Changes:**

- In README (or Deploy section): state that the production deploy target is 23.88.34.218; `APP_SERVER_USER` and `APP_SERVER_SSH_KEY` must point to this host.
- Optional short checklist for new server: (1) Install Docker (and Compose). (2) Install/configure PostgreSQL; set `DATABASE_URL` in `.env.production`. (3) Clone repo to `/repos/candle-collector`; if private, configure GitHub access (SSH deploy key or HTTPS token). (4) Open port 14444. (5) Run deploy script from local.

**Rationale:** Prevents future confusion and gives a repeatable setup for the new host.

---

## 7. Test Plan

- **Pre-migration:** After Step 1, confirm no containers are running on 37.27.107.227 (`docker ps -a` empty or no `cc` stack).
- **Post-deploy:** (1) `curl http://23.88.34.218:14444/` returns expected health response. (2) Optional: call one API endpoint (e.g. `GET /exchange` or `GET /getTopCoins`) and check response. (3) On server, check container logs: `docker compose -p cc -f docker-compose.yml logs -f` and app logs in `logs/`.
- **DB:** App logs should show successful Prisma/DB connection; no connection errors to DB.

---

## 8. Rollback Strategy

- If deploy to new server fails: fix config (env, port, DB) and re-run `scripts/external-deploy.sh`. No schema or code rollback needed.
- If need to run again on old server: change `.env` back to `APP_SERVER_USER=root@37.27.107.227`, restore Docker on 37.27.107.227, ensure `.env.production` has DB reachable from that host, run deploy script. (DB would need to be reachable from old server or restored from backup.)

---

## 9. Validation Checklist

- [ ] Step 1 done: app stopped and Docker removed on 37.27.107.227.
- [ ] Step 2 done: Docker and local PostgreSQL installed on 23.88.34.218; repo present at `/repos/candle-collector`; GitHub access configured if repo is private.
- [ ] Step 3 done: local `.env` has `APP_SERVER_USER=root@23.88.34.218` and correct `APP_SERVER_SSH_KEY`; `.env.production` has `DATABASE_URL` for local DB on new server.
- [ ] Step 4 done: deploy script run successfully; port 14444 open; health (and optional API) check passes.
- [x] Step 5 done: README or docs updated with new server and optional GitHub/firewall checklist. Runbook and pre-migration script added (DEV-0004 BUILD).
- [ ] No regressions: existing API behavior unchanged; only host and DB location changed.

---

## 10. Next Steps

- Execute Steps 1–4 in order (pre-migration on old server → prepare new server → update env → deploy). Step 5 (docs) is done.
- Runbook: `memory-bank/tasks/DEV-0004-migration-runbook.md`. Pre-migration: `pnpm run pre-migration-stop` (set `OLD_APP_SERVER_USER`, `OLD_APP_SERVER_SSH_KEY` in `.env`).
- If GitHub key is not set up on 23.88.34.218: add a deploy key or use HTTPS token before first `git pull` on the server.

---

## Task ID: DEV-0003

**Title:** Add method fetchTopCoins — CMC scrape, new table, daily update, wire ENABLE_TOP_COIN_FETCH

**Status:** completed (archived)  
**Complexity:** Level 3  
**Started:** 2026-02-21  
**Type:** feature  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Archive:** [memory-bank/archive/archive-DEV-0003.md](archive/archive-DEV-0003.md)  
**Reflection:** [memory-bank/reflection/reflection-DEV-0003.md](reflection/reflection-DEV-0003.md)

---

## 1. Overview

**Problem:** Top coins are loaded from a static JSON file (`data/coins-top-500.json`); data is outdated and manual. Candle fetch for “top” coins (`ENABLE_TOP_COIN_FETCH`) relies on this source.

**Goals:** (1) Fetch live coin listing from CoinMarketCap page HTML; (2) store CMC data in a new DB table with upsert by CMC id; (3) run this update once per day when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`; (4) make `getTopCoinFirstExchange()` and related APIs use the new table so `ENABLE_TOP_COIN_FETCH` uses CMC-backed data.

**Success criteria:** CMC page fetched and JSON extracted; new table populated/updated; daily job runs under flag; `fetchTopCoinsM1Candles()` reads from new table with correct ordering (e.g. by `volume24h`).

---

## 2. Security Summary

- **Attack surface:** Unchanged (no new user-facing endpoints; outbound HTTP to CMC only).
- **New permissions:** None.
- **Sensitive data:** No PII; only public CMC listing data stored.
- **Risks:** (1) CMC may block or change HTML/JSON structure — mitigate with User-Agent, error handling, and optional fallback to existing TopCoin/JSON. (2) Parsing page HTML/JSON — validate and bound parsed data to avoid DoS; no eval/exec of CMC content.

---

## 3. Architecture Impact

- **Components:** `prisma/schema.prisma` (new model), `src/prisma.service.ts` (queries), `src/app.service.ts` (bootstrap, CMC fetch, daily job, optional TopCoin sync), new helper for CMC fetch/parse (e.g. `src/cmc.service.ts` or methods in `app.service.ts`).
- **Integration:** On bootstrap, if `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`, schedule a recurring check (e.g. same pattern as `fetchAllMarkets`): read `GlobalVar` `LastUpdateTopCoinFromCmc`; if older than 24h, run CMC fetch → parse → upsert; then set `LastUpdateTopCoinFromCmc`. `getTopCoinFirstExchange()` / `getTopCoins()` / `getTopCoinMarkets()` switch to query the new table (join by `symbol` → `Symbol.name = symbol || '/USDT'`).

---

## 4. Detailed Design

### 4.1 Component Changes

| File | Changes | Reason |
|------|---------|--------|
| `prisma/schema.prisma` | Add model `TopCoinFromCmc` with `cmcId`, `symbol`, `name`, `slug`, and CMC fields (price, volume24h, marketCap, supply, ath, atl, dates, etc.). Unique on `cmcId`. | Store CMC listing; upsert by CMC id. |
| `src/prisma.service.ts` | Add `getTopCoinFirstExchangeFromCmc()`, or change `getTopCoinFirstExchange()` to read from `TopCoinFromCmc` (join Symbol, Market, Exchange), order by `volume24h` desc. Same for `getTopCoins()` and `getTopCoinMarkets()` using new table. | Source of truth for “top coins” becomes CMC table. |
| `src/app.service.ts` | (1) Add `fetchAndUpdateTopCoinsFromCmc()`: HTTP get CMC URL, extract JSON from HTML (e.g. script id or regex), parse coins array, map to table rows, upsert by `cmcId`. (2) In `onApplicationBootstrap`, if `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`, schedule loop that checks `LastUpdateTopCoinFromCmc` (24h); runs fetch and sets var. (3) Keep `updateTopCoins()` for backward compatibility when CMC is off; optionally deprecate or call it only when CMC table is empty. | Daily CMC update and single-run fetch logic. |
| `.env.example` | Already has `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`. | Document flag. |

### 4.2 New Components

| File | Purpose | Dependencies |
|------|---------|--------------|
| Optional: `src/cmc.service.ts` | Encapsulate CMC fetch + HTML parse + JSON extraction + mapping to DTO. Returns array of coin objects. | `fetch` (Node built-in), no new deps. |
| Migration | `prisma migrate dev --name add_top_coin_from_cmc` | Prisma. |

### 4.3 API Changes

- No new endpoints. Existing: `GET /getTopCoins`, `GET /getTopCoinMarkets`, `GET /getTopCoinFirstExchange`, `GET /updateTopCoins` — response shape unchanged where possible (same `coin`/symbol, ordering by volume/cost). `GET /updateTopCoins` can be extended to trigger CMC update when flag is set, or left as legacy JSON updater.

### 4.4 Database Changes

- **Table:** `TopCoinFromCmc` (name TBD, e.g. `TopCoinFromCmc`).
- **Columns:** `cmcId Int @unique`, `symbol String`, `name String`, `slug String?`, `cmcRank Int?`, `logo String?`, `circulatingSupply Float?`, `totalSupply Float?`, `maxSupply Float?`, `ath Float?`, `atl Float?`, `high24h Float?`, `low24h Float?`, `price Float`, `volume24h Float`, `marketCap Float`, `percentChange1h Float?`, `percentChange24h Float?`, `percentChange7d Float?`, `lastUpdated DateTime?`, `dateAdded DateTime?`, `isActive Int?`, `createdAt DateTime`, `updatedAt DateTime`. Index on `symbol` for joins; index on `volume24h` for ordering.
- **Migration:** New migration creating this table.

---

## 5. Security Design (Appendix A)

### 5.1 Threat Model

- **Assets:** App availability; DB integrity.
- **Threats:** CMC returns malicious or huge payload; CMC changes structure and parser crashes; excessive memory from large HTML/JSON.
- **Mitigations:** Use native `fetch` + stream/bounded read if needed; parse only the known script/JSON block; validate array length (e.g. cap at 5000 items); try/catch and log errors without failing bootstrap; no eval of CMC content.

### 5.2 Security Controls Checklist

- [x] Input validation: Validate CMC response (status 200, content-type); validate parsed numbers/dates before DB write.
- [x] No SQL concatenation: Use Prisma upsert/queryRaw with parameters.
- [x] No secrets: CMC URL is public; no API key required for page fetch.
- [x] Access control: No new auth; job runs in-app with same privileges.
- [x] Infrastructure: No new permissions.

---

## 6. Implementation Steps

### Step 1: Prisma model and migration

**Files:** `prisma/schema.prisma`

Add model (example; adjust types to CMC payload):

```prisma
model TopCoinFromCmc {
  id                Int       @id @default(autoincrement())
  cmcId             Int       @unique
  symbol            String
  name              String
  slug              String?
  cmcRank           Int?
  logo              String?
  circulatingSupply Float?
  totalSupply       Float?
  maxSupply         Float?
  ath               Float?
  atl               Float?
  high24h           Float?
  low24h            Float?
  price             Float     @default(0)
  volume24h         Float     @default(0)
  marketCap         Float     @default(0)
  percentChange1h   Float?
  percentChange24h  Float?
  percentChange7d   Float?
  lastUpdated       DateTime?
  dateAdded         DateTime?
  isActive          Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([symbol])
  @@index([volume24h])
}
```

Run `pnpm exec prisma migrate dev --name add_top_coin_from_cmc`.

**Rationale:** Establish schema first so services can use the table.

### Step 2: CMC fetch and parse

**Files:** `src/app.service.ts` or `src/cmc.service.ts`

- Implement `fetchCmcPage(): Promise<string>`: `fetch('https://coinmarketcap.com/')` with `User-Agent` header, return response.text().
- Implement `extractCoinListingFromHtml(html: string): CmcCoin[]`: locate JSON in HTML (e.g. search for `__NEXT_DATA__` or script containing `"id":1,"name":"Bitcoin"`), parse JSON, find the array of coin objects (path depends on CMC page structure — may need one-time inspection of page source), return array. Map each item to a DTO with at least: cmcId, symbol, name, slug, quotes[USD].price, volume24h, marketCap, etc.
- Add error handling and optional max items (e.g. 2000) to avoid runaway memory.

**Rationale:** Isolate HTTP and parsing so daily job only does “fetch → parse → upsert”.

### Step 3: Upsert into TopCoinFromCmc

**Files:** `src/app.service.ts`

- Implement `updateTopCoinsFromCmc(): Promise<void>`: call fetch + extract; for each coin, find USD quote; upsert `TopCoinFromCmc` by `cmcId` with all mapped fields. Use Prisma `topCoinFromCmc.upsert({ where: { cmcId }, create: {...}, update: {...} })`.
- Expose optional GET endpoint or keep only internal call from scheduler.

**Rationale:** Single method that brings CMC data into DB.

### Step 4: Daily job with GlobalVar

**Files:** `src/app.service.ts`

- In `onApplicationBootstrap`, if `ENABLE_UPDATE_TOP_COIN_FROM_CMC === 'true' || === '1'`, schedule (setTimeout) a method e.g. `runUpdateTopCoinsFromCmcIfNeeded()`.
- In that method: `lastRun = await this.global.getGlobalVariableTime('LastUpdateTopCoinFromCmc')`; if `lastRun === null || Date.now() - lastRun > 24 * 60 * 60 * 1000`, call `updateTopCoinsFromCmc()`, then `await this.global.setGlobalVariable('LastUpdateTopCoinFromCmc', 1)`. Then reschedule itself (e.g. setTimeout(..., 60 * 60 * 1000)) to check again in 1 hour.
- Rationale: Once per day update without cron; same pattern as markets/candles.

### Step 5: Switch Prisma queries to new table

**Files:** `src/prisma.service.ts`

- **getTopCoinFirstExchange:** Change to query from `TopCoinFromCmc`: join `Symbol` ON `s.name = tc.symbol || '/USDT'`, Market, Exchange; `orderBy: { volume24h: 'desc' }`; exclude STABLES; same ROW_NUMBER per symbol, take first exchange. Use Prisma or $queryRaw with `TopCoinFromCmc` alias.
- **getTopCoins:** Change to `topCoinFromCmc.findMany({ where: { symbol: { notIn: STABLES } }, orderBy: { volume24h: 'desc' } })` and map to same shape as before (e.g. coin, name, cost24 → volume24h) so API contract holds.
- **getTopCoinMarkets:** Same join but from `TopCoinFromCmc` (tc.symbol instead of tc.coin).

**Rationale:** `fetchTopCoinsM1Candles()` already uses `getTopCoinFirstExchange()`; once Prisma reads from CMC table, no change needed in app.service for M1 loop.

### Step 6: Backward compatibility and fallback

**Files:** `src/prisma.service.ts`, `src/app.service.ts`

- If new table is empty and `getTopCoinFirstExchange()` returns [], keep existing behavior: either (a) still read from `TopCoin` when `TopCoinFromCmc` has no rows (hybrid), or (b) document that first run of CMC update or manual `updateTopCoins()` (legacy) must populate data. Prefer (a) for smooth rollout: when CMC table has rows, use it; otherwise fall back to TopCoin.
- Document in spec: `updateTopCoins()` and `coins-top-500.json` remain for fallback when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=false`.

**Rationale:** Safe rollout; no breakage if CMC fails first time.

---

## 7. Test Plan

- **Unit:** (1) `extractCoinListingFromHtml` with a fixture HTML snippet containing sample JSON — assert parsed array length and sample fields. (2) Map CMC coin + USD quote to Prisma create payload — assert shape and types.
- **Integration:** (1) With DB, run `updateTopCoinsFromCmc()` (or mock fetch to return fixture), then assert `TopCoinFromCmc` rows. (2) Call `getTopCoinFirstExchange()` and assert ordering by volume24h and join with Symbol/Market.
- **Security:** No user input in CMC path; ensure no eval/Function of CMC content.

---

## 8. Rollback Strategy

- **Revert code:** `git revert <commit(s)>`.
- **DB:** If no dependency from other features, keep table; or `prisma migrate resolve --rolled-back <migration_name>` and drop table manually. Restore `getTopCoinFirstExchange`/`getTopCoins`/`getTopCoinMarkets` to use `TopCoin` only.
- **Feature flag:** Set `ENABLE_UPDATE_TOP_COIN_FROM_CMC=false` to stop CMC updates; Prisma can be reverted to read from TopCoin only.

---

## 9. Validation Checklist

- [x] Migration applied; `TopCoinFromCmc` exists.
- [x] CMC page fetch and JSON extraction work (unit test + fetchCmcPage/extractCoinListingFromHtml).
- [x] `updateTopCoinsFromCmc()` upserts rows; `LastUpdateTopCoinFromCmc` set when job runs.
- [x] With `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`, job runs once per 24h.
- [x] `getTopCoinFirstExchange()` uses CMC table when it has data, ordered by volume24h; fallback to TopCoin.
- [x] `ENABLE_TOP_COIN_FETCH=true` → `fetchTopCoinsM1Candles()` uses CMC-backed list (via getTopCoinFirstExchange).
- [x] No regressions: getTopCoins, getTopCoinMarkets response shape consistent.
- [x] Documentation (README, techContext, projectbrief, productContext) updated.

---

## 10. Next Steps

- Proceed to `/do` command to implement Step 1–6.
- Optionally inspect CMC page source once to confirm exact JSON path (e.g. `__NEXT_DATA__.props.pageProps.initialState.cryptocurrency.listingLatest.data` or similar).

---

## Task ID: DEV-0002

**Title:** Fix Prisma deprecation, ESLint/ajv, container stability, exchange env

**Status:** completed (archived)  
**Complexity:** Level 2  
**Started:** 2026-02-21  
**Type:** infrastructure / fix  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Archive:** [memory-bank/archive/archive-DEV-0002.md](archive/archive-DEV-0002.md)  
**Reflection:** [memory-bank/reflection/reflection-DEV-0002.md](reflection/reflection-DEV-0002.md)

---

## Task ID: DEV-0001

**Title:** Migrate to pnpm, update deps, modernize Docker, verify build and deploy

**Status:** completed  
**Complexity:** Level 2  
**Started:** 2026-02-20  
**Type:** infrastructure  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Archive:** [memory-bank/archive/archive-DEV-0001.md](archive/archive-DEV-0001.md)  
**Reflection:** [memory-bank/reflection/reflection-DEV-0001.md](reflection/reflection-DEV-0001.md)

---

## Task ID: INIT

**Title:** Project initialization (Memory Bank, .gitignore, documentation)

**Status:** completed  
**Complexity:** Level 1  
**Started:** 2025-02-20  
**Type:** setup  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Reflection:** done — memory-bank/reflection/reflection-INIT.md  

### Checklist

- [x] Repo up to date (git pull)
- [x] Project analyzed
- [x] memory-bank/ structure created
- [x] projectbrief.md, techContext.md, productContext.md, systemPatterns.md
- [x] activeContext.md, progress.md, tasks.md
- [x] .gitignore updated
- [x] README and documentation updated
