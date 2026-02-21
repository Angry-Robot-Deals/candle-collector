# Tasks

## Task ID: DEV-0003

**Title:** Add method fetchTopCoins — CMC scrape, new table, daily update, wire ENABLE_TOP_COIN_FETCH

**Status:** implemented (ready for /reflect)  
**Complexity:** Level 3  
**Started:** 2026-02-21  
**Type:** feature  
**Priority:** high  
**Repository:** candles  
**Branch:** main  

**Spec:** [memory-bank/tasks/DEV-0003-fetchTopCoins-from-CMC.md](tasks/DEV-0003-fetchTopCoins-from-CMC.md)

---

# DEV-0003 Implementation Plan

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
