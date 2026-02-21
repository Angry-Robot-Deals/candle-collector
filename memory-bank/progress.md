# Progress

## Current Phase

**DEV-0003** — Add method fetchTopCoins (CMC scrape, new table, daily update). Implementation complete: TopCoinFromCmc model + migration, CMC fetch/parse (cmc.service.ts), updateTopCoinsFromCmc + daily job, Prisma fallback. Tests pass; docs updated. Ready for `/reflect`.

## Completed

- [x] Pull latest from GitHub (already up to date)
- [x] Analyze project (NestJS, Prisma, exchanges, candles, ATHL)
- [x] Create memory-bank/ and core files
- [x] Update .gitignore (*.code-workspace)
- [x] Update README (stack, env, Docker, local dev, API overview, Memory Bank)
- [x] memory-bank/docs/README.md added
- [x] **DEV-0001:** pnpm migration, Docker modernized (node:24-alpine, pnpm), env_file, verify script, exchange API fixes (symbol normalization, fetchJsonSafe) — archived 2026-02-20
- [x] **DEV-0002:** Prisma prisma.config.ts, ESLint flat config, container stability (API_PORT, retries, prisma/ in image), parseEnvExchangeList + .env.example — archived 2026-02-21

## Archive

- **INIT** archived 2026-02-20 → memory-bank/archive/archive-INIT.md
- **DEV-0001** archived 2026-02-20 → memory-bank/archive/archive-DEV-0001.md
- **DEV-0002** archived 2026-02-21 → memory-bank/archive/archive-DEV-0002.md

## Next Steps

- Use `/van` for new tasks; backlog in memory-bank/backlog.md.
