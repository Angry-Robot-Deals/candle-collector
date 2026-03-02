# Reflection — DEV-0005

**Feature ID:** DEV-0005  
**Feature Name:** Add Bitget exchange — candle fetching, API docs audit, full test coverage, deploy  
**Date of Reflection:** 2026-02-25  
**Complexity:** Level 3  

---

## Brief Feature Summary

Bitget exchange was fully integrated into the candle-collector: new adapter (`bitget.ts`, `bitget.interface.ts`) following the kucoin/gateio/mexc pattern, wiring in `app.service.ts`, canonical API reference for all 9 exchanges (`memory-bank/docs/exchange-api-reference.md`), audit of existing adapters vs live docs, and full test coverage for Bitget/KuCoin/Gate.io/MEXC adapters plus PrismaService DB methods. After deploy, three production bugs were found and fixed: early `return` in D1/H1/M15 exchange loops (blocking bitget), Bitget `history-candles` limit (max 200), and granularity strings (`1H`/`1D` → `1h`/`1day`).

---

## 1. Overall Outcome & Requirements Alignment

- **Requirements:** All 7 goals and success criteria from `tasks.md` were met. Bitget collects D1/H1/M15 candles on production; exchange-api-reference.md exists for all 9 exchanges; adapters verified; 54 tests pass; production health green and Bitget candles saved (e.g. `Saved [bitget] APE/USDT.D1: 200`).
- **Deviations:** Architecture kept Bitget types in `bitget.interface.ts` only (not in shared `exchange.constant.ts` / `interface.ts`), matching the existing adapter pattern — intentional and correct. Post-deploy fixes (return→continue, limit 200, granularity) were not in the original plan but were necessary to make Bitget actually run in production.
- **Assessment:** Feature successful. Scope was well defined; the main gap was incomplete validation of Bitget API constraints (limit per endpoint, exact granularity strings) before first deploy.

---

## 2. Planning Phase Review

- **Implementation plan** (`DEV-0005-implementation-plan.md`) was accurate for endpoints, symbol format, response shape, and adapter structure. It correctly noted two Bitget endpoints (candles vs history-candles) and 90-day threshold.
- **Gaps in plan:** (1) No explicit note that `history-candles` has a different max limit (200 vs 1000). (2) Granularity values were documented as `1H`, `4H`, `1D`; the live API accepts only `1h`, `1day` (lowercase). (3) No check that all exchanges are actually queued when env lists are empty (the early `return` bug prevented that).
- **Estimation:** Implementation and tests were on scope; the extra iteration (deploy → observe logs → fix three bugs → redeploy) added roughly one cycle. Planning could have included one “production smoke: all enabled exchanges appear in logs within one cycle.”

---

## 3. Creative Phase(s) Review

- No formal creative phase was used. Design followed the existing kucoin/gateio/mexc pattern; no UI or product decisions. This was appropriate for the task.

---

## 4. Implementation Phase Review

- **Successes:** Adapter pattern reuse made Bitget implementation fast. Single interface file and one adapter file kept changes local. Exchange-api-reference.md and audit of other exchanges were done without breaking existing adapters. Compliance run added missing `prisma.service.spec.ts`.
- **Challenges:** (1) **Production bug 1 — Bitget absent from logs.** Root cause: in `fetchAllSymbolD1Candles`, `fetchAllSymbolH1Candles`, and `fetchAllSymbolM15Candles`, the loop used `return` when an exchange had a “recent” timestamp, exiting the whole function so later exchanges (e.g. bitget, last by DB id) were never added to the jobs queue. Fix: change `return` to `continue`. (2) **Production bug 2 — HTTP 400 “Parameter limit error”.** Bitget `history-candles` allows max 200 per request; we sent 1000. Fix: cap limit to 200 when using history-candles. (3) **Production bug 3 — HTTP 400 “Parameter verification failed k-line time range”.** API expects `1h` and `1day`, not `1H` and `1D`. Fix: update `BITGET_TIMEFRAME` in `bitget.interface.ts`.
- **Technical note:** Docker build on the server failed initially (corepack/npm registry DNS). Resolved by copying corepack cache from deps stage into build stage in the Dockerfile. Re-enabled 704 Bitget markets that had been disabled by the granularity error and cleared GlobalVar timestamps so Bitget could run in the next cycle.

---

## 5. Testing Phase Review

- **Strategy:** Unit tests with mocked `fetchJsonSafe` for Bitget (and extended to KuCoin, Gate.io, MEXC); PrismaService tests with mocked Prisma client. No integration or E2E tests against live Bitget API.
- **Effectiveness:** Tests caught correct mapping and error handling in adapters. They did not catch the “return vs continue” bug (that logic lives in `app.service.ts`, not in the exchange specs) or the Bitget-specific limit/granularity (no live or contract tests). Compliance phase added PrismaService tests that were in scope but initially missing.
- **Improvement:** For a new exchange, add a single “contract” or doc test: e.g. assert that the documented granularity values and limit rules match constants in code (e.g. HISTORY_CANDLES_MAX_LIMIT and BITGET_TIMEFRAME values vs a small fixture from API docs).

---

## 6. What Went Well?

1. **Pattern reuse** — Implementing Bitget as a clone of kucoin/gateio/mexc kept the codebase consistent and made review straightforward.
2. **Exchange API reference** — One canonical doc for all 9 exchanges (endpoints, symbol format, timeframes, links) will simplify future audits and new adapters.
3. **Compliance** — The `/compliance` run identified the missing PrismaService tests and led to adding them before archive.
4. **Focused fixes** — The three production bugs had clear causes and localized fixes (app.service.ts loop, bitget.ts limit/granularity); no large refactors.
5. **Verification** — Final deploy showed Bitget in logs with correct parameters and successful candle saves (e.g. `Saved [bitget] ACH/USDT.D1: 200`), confirming end-to-end health.

---

## 7. What Could Have Been Done Differently?

1. **API constraints up front** — Before coding, confirm from official Bitget docs: exact granularity enum (case-sensitive) and per-endpoint limit (candles vs history-candles). Would have avoided the 400 errors and disabled markets.
2. **Loop semantics** — The “delay this exchange” logic should have been `continue` from the start; a short code review or one test (“all enabled exchanges get a job when no recent timestamp”) would have caught it.
3. **Deploy verification** — First deploy could have included an explicit check: “within N minutes, logs contain at least one line per enabled exchange” to detect bitget’s absence earlier.
4. **Dockerfile** — Document or fix corepack/pnpm usage when the build environment has no outbound DNS (e.g. copy pnpm from deps or set COREPACK_ENABLE_STRICT=0) so deploy is robust on locked-down servers.
5. **Bitget error string** — Add Bitget’s “symbol not exists” (or equivalent) to the `app.service.ts` error string list so that invalid/delisted symbols trigger market disable consistently with other exchanges (noted in compliance report as optional hardening).

---

## 8. Key Lessons Learned

- **Technical:** (1) Bitget’s two endpoints have different limits (1000 vs 200); always check per-endpoint caps in the docs. (2) Many REST APIs use case-sensitive enums; use the exact strings from the official spec. (3) When iterating over a list and “skipping” an item, use `continue`; using `return` exits the whole function and can hide bugs when the first item often matches the skip condition.
- **Process:** (1) Compliance after implementation caught a missing test file (PrismaService); running it before archive is valuable. (2) Production logs are the source of truth for “is this exchange actually running?” — a quick grep for each exchange name in logs would have highlighted bitget’s absence.
- **Estimation:** Level 3 “feature + quality” with a new exchange and full test coverage was roughly on target; the extra deploy/fix cycle was ~20% overhead and could be reduced by the improvements above.

---

## 9. Actionable Improvements for Future L3 Features

1. **New exchange checklist** — Before coding: (a) document exact granularity strings and per-endpoint limits from official API docs; (b) add a small test or constant assertion that our timeframe map and limits match that doc.
2. **Exchange loop invariant** — Add a comment in `app.service.ts` above the D1/H1/M15 loops: “Use `continue` to skip only this exchange; do not `return` or later exchanges will never run.” Consider a unit test that, with mocked GlobalVar, asserts all enabled exchanges receive a job when timestamps are empty or stale.
3. **Deploy verification** — In `verify-server.sh` or deploy doc: optionally check that the last M minutes of app.log contain at least one line per enabled exchange (e.g. “Saved [bitget]” or “bitget”).
4. **Dockerfile** — Document the corepack cache copy for build stage when the server has no npm registry access, or add a fallback (e.g. use bundled pnpm or COREPACK_ENABLE_STRICT=0).
5. **Optional** — Add Bitget-specific error message(s) to the `app.service.ts` “disable market” error string list (see compliance report).

---

## Next Steps

- Proceed to **/archive** to finalize task documentation.
- Optionally create a BACKLOG item for: “Add Bitget error string to app.service.ts disable list” and “Add tests for exchange-fetch-candles.ts adapters (Binance, OKX, Bybit, HTX, Poloniex).”
