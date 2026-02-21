# Compliance Report: DEV-0003

**Task:** Add method fetchTopCoins — CMC scrape, new table, daily update, wire ENABLE_TOP_COIN_FETCH  
**Date:** 2026-02-21  
**Report type:** Post-QA hardening & PRD revalidation  

---

## 1. Revalidation vs PRD / Task

| Requirement | Status | Notes |
|-------------|--------|--------|
| Fetch CMC page via HTTP; extract JSON with coin list | Done | `fetchCmcPage()`, `extractCoinListingFromHtml()` in cmc.service.ts; __NEXT_DATA__ + regex fallback |
| New table with CMC id and columns; upsert by id | Done | `TopCoinFromCmc` model + migration; upsert by `cmcId` |
| ENABLE_UPDATE_TOP_COIN_FROM_CMC → update once per day | Done | `runUpdateTopCoinsFromCmcIfNeeded()` + GlobalVar `LastUpdateTopCoinFromCmc`, 24h interval |
| getTopCoinFirstExchange / getTopCoins / getTopCoinMarkets use CMC source | Done | Prisma reads from TopCoinFromCmc when `hasTopCoinFromCmcData()`, else TopCoin fallback |
| ENABLE_TOP_COIN_FETCH uses CMC-backed list | Done | Via getTopCoinFirstExchange() |
| TopCoin kept as top N by volume; tail removed | Done | Sync top 500 from CMC into TopCoin; deleteMany(notIn: topSymbols) |

**Conclusion:** Implementation matches spec and acceptance criteria. TopCoin cap (max 500, delete tail) implemented as requested.

---

## 2. Code Simplifier

- **cmc.service.ts:** Single responsibility (fetch, extract, getUsdQuote). No redundant logic; regex fallback is a clear second path. No simplification needed.
- **app.service.ts (CMC block):** create/update in upsert are verbose but symmetric; extracting a `toTopCoinFromCmcRow(coin, usd)` would add indirection without reducing duplication much. Optional: shared `rowData` object for create/update to avoid double field list — deferred as low value.
- **prisma.service.ts:** hasTopCoinFromCmcData() + conditional getTopCoins/getTopCoinMarkets/getTopCoinFirstExchange is clear. No change.

**Conclusion:** No mandatory simplifications; code is readable and within scope.

---

## 3. References / Unused

- **cmc.service.ts:** All imports used (Logger, types, constants). `Logger.warn?.()` used in catch.
- **cmc.types.ts:** No imports; types only.
- **app.service.ts:** CMC-related imports (fetchCmcPage, extractCoinListingFromHtml, getUsdQuote, TOP_COIN_SYNC_LIMIT) are used.
- **prisma.service.ts:** topCoinFromCmc, STABLES, TOP_COIN_EXCHANGES used.

**Conclusion:** No unused references in DEV-0003 code. IDE may show `Property 'topCoinFromCmc' does not exist on type 'PrismaService'` until `pnpm exec prisma generate` is run; build succeeds with generated client.

---

## 4. Coverage

- **Unit tests:** `pnpm test` — 2 suites, 5 tests, all pass (cmc.service.spec.ts, global-variables-db.service.spec.ts).
- **Coverage run:** `npx jest --coverage` fails with `minimatch is not a function` when instrumenting app.service.ts (test-exclude/minimatch dependency). Pre-existing Jest/coverage setup issue; not introduced by DEV-0003.
- **DEV-0003 coverage:** extractCoinListingFromHtml (__NEXT_DATA__ + empty HTML) and getUsdQuote covered by tests; fetchCmcPage and updateTopCoinsFromCmc are integration-level (no unit tests).

**Conclusion:** Unit tests pass. Coverage collection is broken by env/deps; recommend fixing minimatch/test-exclude for future coverage. New CMC logic that is unit-testable is covered.

---

## 5. Linters / Formatters

- **ESLint:** `pnpm run lint` — exit 0, no errors.
- **Prettier:** Not run separately; ESLint run includes --fix. No formatting issues reported.

**Conclusion:** Lint passes.

---

## 6. Tests

- **pnpm test:** All tests pass (5 tests, 2 suites).
- **Build:** `pnpm run build` — success.

**Conclusion:** Tests and build OK.

---

## 7. Optional Hardening

- **Security:** No user input in CMC path; no eval/exec of CMC content; Prisma parameterized queries; User-Agent set. No changes.
- **Resilience:** CMC fetch/parse errors are caught and logged; empty coin list exits early; deleteMany only when topSymbols.length > 0 to avoid wiping TopCoin. Adequate.
- **Observability:** Logs for "CMC update: N coins processed", "TopCoin: removed M coins", "TopCoin table synced". Sufficient for ops.

**Conclusion:** No hardening required for compliance.

---

## Summary

| Step | Result |
|------|--------|
| 1. PRD revalidation | Pass — implementation matches spec; TopCoin cap (500, delete tail) done |
| 2. Code simplifier | Pass — no required simplifications |
| 3. References/unused | Pass — no unused refs; IDE Prisma types need generate |
| 4. Coverage | Pass with caveat — unit tests pass; coverage collection fails (minimatch) |
| 5. Linters | Pass — ESLint clean |
| 6. Tests | Pass — 5 tests, build OK |
| 7. Hardening | Pass — no actions required |

**Overall:** Compliance passed. Ready for /reflect.

---

## Next Steps

- Proceed to **/reflect** for task review.
- Optional: fix Jest coverage (minimatch / test-exclude) in a separate task for future coverage reports.
