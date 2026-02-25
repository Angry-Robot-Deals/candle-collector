# TASK ARCHIVE: DEV-0003 — Add method fetchTopCoins (CMC scrape, new table, daily update)

**Task ID:** DEV-0003  
**Archived:** 2026-02-21  
**Complexity:** Level 3  
**Type:** feature  
**Repository:** candles (angry/candles)  
**Branch:** main  

---

## METADATA

| Field | Value |
|-------|--------|
| Task ID | DEV-0003 |
| Title | Add method fetchTopCoins — CMC scrape, new table, daily update, wire ENABLE_TOP_COIN_FETCH |
| Started | 2026-02-21 |
| Status | completed |
| Priority | high |

---

## SUMMARY

Replaced the static top-coins source (`data/coins-top-500.json`) with live data from CoinMarketCap. Implemented: (1) fetch of up to 10 CMC listing pages (`?page=1` … `?page=10`), ~100 coins per page; (2) new table `TopCoinFromCmc` with upsert by `cmcId`; (3) daily update job when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true` (GlobalVar `LastUpdateTopCoinFromCmc`, 24h interval); (4) Prisma `getTopCoins`, `getTopCoinMarkets`, `getTopCoinFirstExchange` use CMC table with fallback to `TopCoin` when empty; (5) sync of top 500 by volume from CMC into `TopCoin` and deletion of the rest (max 500 in TopCoin); (6) `GET /updateTopCoinsFromCmc` and `GET /getTopCoinCounts` for trigger and monitoring. Deployed and verified: ~1001 coins in TopCoinFromCmc, 500 in TopCoin.

---

## REQUIREMENTS

- Fetch CoinMarketCap listing page(s), extract embedded JSON (e.g. `__NEXT_DATA__` or regex), parse coin array.
- New DB table for CMC data; upsert by CMC id; store price, volume24h, marketCap, supply, etc.
- Env `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true` → run update once per day.
- Existing top-coin APIs use CMC-backed source; `ENABLE_TOP_COIN_FETCH` flow uses new table for M1 candle fetch.
- (Refined) Fetch at least 10 pages from CMC; keep TopCoin table with only top 500 by volume; remove the rest from TopCoin.

---

## IMPLEMENTATION

### New / changed files

- **prisma/schema.prisma:** Model `TopCoinFromCmc` (cmcId, symbol, name, slug, price, volume24h, marketCap, supply fields, dates; @@index symbol, volume24h). Migration `20260221172949_add_top_coin_from_cmc`.
- **src/cmc.types.ts:** Types `CmcCoinRaw`, `CmcQuote`; constants `CMC_BASE_URL`, `CMC_DEFAULT_PAGES`, `getCmcPageUrl(page)`.
- **src/cmc.service.ts:** `fetchCmcPage(page)`, `extractCoinListingFromHtml(html)`, `getUsdQuote(coin)`; __NEXT_DATA__ + regex fallback; `findCmcListingArray` for nested JSON.
- **src/cmc.service.spec.ts:** Unit tests for extract and getUsdQuote.
- **src/app.constant.ts:** `TOP_COIN_SYNC_LIMIT=500`, `CMC_FETCH_PAGES=10`, `CMC_PAGE_DELAY_MS=1500`.
- **src/app.service.ts:** `updateTopCoinsFromCmc()` — loop pages 1..CMC_FETCH_PAGES, fetch, extract, dedupe by id, upsert TopCoinFromCmc; then top 500 by volume24h → upsert TopCoin, deleteMany(notIn topSymbols). `runUpdateTopCoinsFromCmcIfNeeded()` — 24h check via GlobalVar, reschedule every 1h. Bootstrap: schedule when `ENABLE_UPDATE_TOP_COIN_FROM_CMC` true.
- **src/prisma.service.ts:** `hasTopCoinFromCmcData()`, `getTopCoinCounts()`; `getTopCoins` / `getTopCoinMarkets` / `getTopCoinFirstExchange` read from TopCoinFromCmc when has data (order by volume24h), else TopCoin.
- **src/app.controller.ts:** `GET /updateTopCoinsFromCmc`, `GET /getTopCoinCounts`.
- **.env.example:** `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`.

### Key design

- Fallback: if TopCoinFromCmc has no rows, all top-coin APIs use TopCoin (no breaking change).
- TopCoin cap: after each CMC run, only the top 500 by volume24h remain in TopCoin; others deleted.
- Rate limiting: 1.5s delay between CMC page fetches.

---

## TESTING

- Unit: `extractCoinListingFromHtml` (__NEXT_DATA__ fixture, empty HTML), `getUsdQuote` (cmc.service.spec.ts). All tests pass.
- Lint: ESLint pass. Build: `pnpm run build` pass.
- Deploy: external-deploy.sh; verify-server.sh (GET /, /exchange, /market, /getTopCoins, /getATHL, /getTopTradeCoins). Manual: GET /updateTopCoinsFromCmc (10 pages, ~60s), GET /getTopCoinCounts → topCoinFromCmc 1001, topCoin 500.

---

## LESSONS LEARNED

- Clarify pagination early for “scrape site X” tasks.
- Add observability (e.g. getTopCoinCounts) at implementation time.
- Commit and push all changes before “deploy and verify”.
- Fallback to legacy table keeps risk low and rollback trivial.

---

## REFERENCES

- **Spec:** [memory-bank/tasks/DEV-0003-fetchTopCoins-from-CMC.md](../tasks/DEV-0003-fetchTopCoins-from-CMC.md)
- **Reflection:** [memory-bank/reflection/reflection-DEV-0003.md](../reflection/reflection-DEV-0003.md)
- **Compliance report:** [memory-bank/reports/compliance-report-DEV-0003-2026-02-21.md](../reports/compliance-report-DEV-0003-2026-02-21.md)
- **QA report (deploy):** [memory-bank/reports/qa-report-DEV-0003-deploy-2026-02-21.md](../reports/qa-report-DEV-0003-deploy-2026-02-21.md)
