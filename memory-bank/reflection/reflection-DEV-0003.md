# Reflection: DEV-0003 — fetchTopCoins from CoinMarketCap

**Task:** Add method fetchTopCoins — CMC scrape, new table, daily update, wire ENABLE_TOP_COIN_FETCH  
**Complexity:** Level 3  
**Completed:** 2026-02-21  

---

## Summary

Replaced the static top-coins source (`data/coins-top-500.json`) with live data from CoinMarketCap. Implemented: (1) fetch of CMC listing pages (initially 1, then 10 pages); (2) new table `TopCoinFromCmc` with upsert by `cmcId`; (3) daily update job when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`; (4) Prisma queries (`getTopCoins`, `getTopCoinMarkets`, `getTopCoinFirstExchange`) use CMC table with fallback to `TopCoin`; (5) sync of top 500 by volume from CMC into `TopCoin` and removal of the rest; (6) endpoint `GET /getTopCoinCounts` for monitoring. Deployed and verified: ~1001 coins in TopCoinFromCmc, 500 in TopCoin.

---

## What Went Well

- **Plan → implementation alignment:** The implementation plan in tasks.md was followed: Prisma model, migration, CMC fetch/parse in a dedicated module (`cmc.service.ts`, `cmc.types.ts`), daily job via GlobalVar, and fallback in Prisma so existing APIs kept the same contract.
- **Separation of concerns:** Fetch and HTML/JSON parsing are in `cmc.service.ts`; app.service only orchestrates (pages loop, upsert, sync to TopCoin). Types and constants live in `cmc.types.ts`.
- **Backward compatibility:** When TopCoinFromCmc is empty, all top-coin APIs fall back to the legacy `TopCoin` table, so no breaking change on first run or CMC failure.
- **Incremental improvements:** After initial single-page fetch, requirements were refined: 10 pages CMC, TopCoin capped at 500 with tail deletion, and getTopCoinCounts for observability. These were added without reworking the core design.
- **Testing and deploy:** Unit tests for `extractCoinListingFromHtml` and `getUsdQuote`; lint and build passed; deploy script and manual `updateTopCoinsFromCmc` verified on server.
- **Security:** No user input in CMC path; no eval/exec of CMC content; Prisma for all DB access; User-Agent set for fetch.

---

## Challenges

- **CMC page structure:** The exact location of the coin list in the HTML (e.g. `__NEXT_DATA__` vs other script) was not documented; we used a recursive `findCmcListingArray` over parsed JSON and a regex fallback for the array. One-off inspection or doc would have saved a bit of trial and error.
- **Only first page initially:** Spec did not mention pagination; initially only the first page was fetched (~100 coins). User requirement “at least 10 pages” led to adding `getCmcPageUrl(page)`, a loop with delay, and dedupe by `cmcId`.
- **Commit/push discipline:** Some changes (getTopCoinCounts, multi-page CMC) were implemented but not committed before deploy; the user noticed. Lesson: after any “deploy and verify” flow, ensure all related changes are committed and pushed.
- **Jest coverage:** `npx jest --coverage` fails with `minimatch is not a function` (test-exclude dependency); unit tests run fine without coverage. Left as known issue for a future fix.

---

## Lessons Learned

1. **Clarify pagination early:** For “scrape listing from site X”, ask up front how many pages or items are needed so the first implementation matches the real requirement.
2. **Observability from the start:** Adding something like getTopCoinCounts (or a small admin view) at implementation time makes deploy verification and ops easier.
3. **Push before “deploy and check”:** Before saying “deployed and tested”, commit and push every change; otherwise the server and local state diverge and counts/behavior can be confusing.
4. **Fallback keeps risk low:** Keeping TopCoin and fallback logic allowed shipping CMC support without a big-bang cutover and made rollback trivial (flag off or Prisma reverted).

---

## Process Improvements

- **Checklist before “deploy + verify”:** (1) All edits committed. (2) Pushed to the branch used by deploy. (3) Then run deploy and verification. (4) If new files (e.g. reports) are created during verification, commit and push them in the same session.
- **Spec vs refinement:** When the user adds a requirement after implementation (e.g. “10 pages”, “only 500 in TopCoin, delete the rest”), update the spec or task doc so the reflection and archive reflect the final behavior.

---

## Technical Improvements

- **Optional env for page count:** `CMC_FETCH_PAGES` could be read from env (e.g. `CMC_FETCH_PAGES=10`) so operators can change the number of pages without a code change.
- **Retry/backoff for CMC:** A single failed page currently logs and continues; adding a retry (e.g. 2 attempts with backoff) for transient errors could improve robustness.
- **Jest coverage fix:** Resolve the minimatch/test-exclude issue so coverage reports can be generated for the new CMC and app.service paths.

---

## Next Steps

- Proceed to **/archive** to finalize task documentation.
- Optionally: add `CMC_FETCH_PAGES` to `.env.example` and read from env; fix Jest coverage; add retry for CMC page fetch.
