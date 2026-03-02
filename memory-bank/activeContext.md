# Active Context

**Current Task:** DEV-0007 — Structured logging: API/APP split with rotation

- **Status:** planned
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Complexity:** Level 3
- **Type:** feature / refactor
- **Priority:** high
- **Repository:** candles (angry/candles)
- **Branch:** main

## Completed

DEV-0006 реализован полностью:
1. Prisma migration: `CandleUpdateStatus` (marketId, tf, symbolId, exchangeId, candleFirstTime, candleLastTime, status)
2. `src/exchange-fetch-last-candles.ts` — unified `fetchLastCandles` + 9 exchange implementations
3. `src/exchange-fetch-last-candles.spec.ts` — 41 unit test (all pass)
4. `src/prisma.service.ts` — 3 методa: getCandleUpdateStatus, upsertCandleUpdateStatus, updateCandleStatusFields
5. `src/app.service.ts` — private `processCandleStateMachine` + интеграция в M15/H1/D1 циклы
6. `src/app.controller.ts` — PATCH /market/:marketId/candle-status/:tf/pause|resume
7. Build: ✅ pnpm build | Tests: ✅ 95/95 passed

## Previous Task

DEV-0005 (Add Bitget exchange, API docs audit, full test coverage, deploy) — **archived 2026-02-26** → memory-bank/archive/archive-DEV-0005.md

## Notes

- Project: NestJS + Prisma + PostgreSQL. Build: pnpm run build.
- Production server: **23.88.34.218** (Docker, port 14444, DB local via host.docker.internal:51432)
- **Deploy command:** `cd /repos/candle-collector && git pull && docker compose -p cc build candles && docker compose -p cc restart candles`
- Container name: `cc-candles-1` (project name **cc**, NOT default candle-collector)
- Backlog: memory-bank/backlog.md
- Last archived: DEV-0005 (2026-02-26) → memory-bank/archive/archive-DEV-0005.md
