# Active Context

**Current Task:** DEV-0005 — Add Bitget exchange, exchange API docs audit, full test coverage, deploy

- **Status:** pending
- **Started:** —
- **Complexity:** Level 3
- **Type:** feature + quality
- **Priority:** high
- **Repository:** candles (angry/candles)
- **Branch:** main

## Focus

Add Bitget candle-fetching adapter (pattern: kucoin/gateio/mexc), audit all exchange API docs, fix any discrepancies, write full test coverage for adapters + DB methods, push → deploy → verify.

## Previous Task

DEV-0004 (migrate feeder to new server 23.88.34.218) — **archived 2026-02-25** → memory-bank/archive/archive-DEV-0004.md

## Notes

- Project: NestJS + Prisma + PostgreSQL. Build: pnpm run build. Deploy: scripts/external-deploy.sh.
- Production server: **23.88.34.218** (Docker, port 14444, DB local via host.docker.internal:51432)
- Backlog: memory-bank/backlog.md
- Last archived: DEV-0004 (2026-02-25) → memory-bank/archive/archive-DEV-0004.md
