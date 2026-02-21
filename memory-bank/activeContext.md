# Active Context

**Current Task:** DEV-0003 — Add method fetchTopCoins (CMC scrape, new table, daily update)

- **Status:** in_progress
- **Started:** 2026-02-21
- **Complexity:** Level 3
- **Type:** feature
- **Priority:** high
- **Repository:** candles (angry/candles)
- **Branch:** main

## Focus

Implement fetchTopCoins from CoinMarketCap: scrape CMC page JSON, new DB table for CMC data, daily update when ENABLE_UPDATE_TOP_COIN_FROM_CMC=true, ensure ENABLE_TOP_COIN_FETCH uses the new table.

## Notes

- Project: NestJS + Prisma + PostgreSQL. Build: pnpm run build. Deploy: scripts/external-deploy.sh.
- Backlog: memory-bank/backlog.md
