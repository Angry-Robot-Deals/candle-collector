# Progress

## Current Phase

**DEV-0005** — Add Bitget exchange, exchange API docs audit, full test coverage, deploy (pending).

## Completed

- [x] Pull latest from GitHub (already up to date)
- [x] Analyze project (NestJS, Prisma, exchanges, candles, ATHL)
- [x] Create memory-bank/ and core files
- [x] Update .gitignore (*.code-workspace)
- [x] Update README (stack, env, Docker, local dev, API overview, Memory Bank)
- [x] memory-bank/docs/README.md added
- [x] **DEV-0001:** pnpm migration, Docker modernized (node:24-alpine, pnpm), env_file, verify script, exchange API fixes (symbol normalization, fetchJsonSafe) — archived 2026-02-20
- [x] **DEV-0002:** Prisma prisma.config.ts, ESLint flat config, container stability (API_PORT, retries, prisma/ in image), parseEnvExchangeList + .env.example — archived 2026-02-21
- [x] **DEV-0003:** CMC top coins (fetch 10 pages, TopCoinFromCmc, daily job, TopCoin sync 500, getTopCoinCounts) — archived 2026-02-21

## Archive

- **INIT** archived 2026-02-20 → memory-bank/archive/archive-INIT.md
- **DEV-0001** archived 2026-02-20 → memory-bank/archive/archive-DEV-0001.md
- **DEV-0002** archived 2026-02-21 → memory-bank/archive/archive-DEV-0002.md
- **DEV-0003** archived 2026-02-21 → memory-bank/archive/archive-DEV-0003.md

- [x] **DEV-0004:** Migrated feeder+API to 23.88.34.218 (Docker, port 14444, DB local via host.docker.internal); CPU reduction (FETCH_CONCURRENT_EXCHANGES); logrotate; verify-server.sh — archived 2026-02-25 → memory-bank/archive/archive-DEV-0004.md

## Next Steps

- **DEV-0005:** Add Bitget exchange, exchange API docs audit, full test coverage, deploy.
- Use `/van` for new tasks; backlog in memory-bank/backlog.md.
