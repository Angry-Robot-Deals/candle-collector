# Reflection: DEV-0002 — Fix Prisma deprecation, ESLint/ajv, container stability, exchange env

**Task ID:** DEV-0002  
**Title:** Fix Prisma deprecation, ESLint/ajv, container stability, exchange env  
**Complexity:** Level 2  
**Type:** infrastructure / fix  
**Completed:** 2026-02-21  

---

## Summary

Four fix areas were completed: (1) Prisma deprecation — moved config from `package.json#prisma` to `prisma.config.ts` so build and deploy show no deprecation warning. (2) ESLint — flat config without `@eslint/eslintrc` so lint runs; ajv override removed (incompatible with eslintrc; CVE not applicable per upstream). (3) Container stability — default `API_PORT`, bootstrap try/catch, `prisma/` in production image, Prisma DB connect retries and longer deploy verify sleep so the app stays up after deploy. (4) Exchange env — centralised `parseEnvExchangeList()` so empty/unset env means “all exchanges”; `.env.example` documented; MEXC confirmed in logs when env lists are empty.

## What Went Well

- **Prisma config:** Single `prisma.config.ts` with `defineConfig`, schema, migrations path and seed; removal of `prisma` from `package.json` was enough; build and server Docker build both use the new config with no warning.
- **ESLint flat config:** Using `@typescript-eslint/eslint-plugin/use-at-your-own-risk/raw-plugin` and `flat/recommended` plus `eslint-config-prettier/flat` avoided loading `@eslint/eslintrc` and fixed the ajv-related crash; removing the ajv override was the correct fix given upstream stance on the CVE.
- **Container fixes:** Default port and try/catch in `main.ts` plus copying `prisma/` into the production stage improved robustness; DB connect retries gave the app time to reach the DB after container start; deploy verification sleep 35s allowed retries to complete before checks.
- **Exchange env:** One helper `parseEnvExchangeList()` used in all four call sites (D1, H1, M15, FETCH_EXCHANGES) keeps behaviour consistent; empty or whitespace-only value correctly yields “all exchanges”; `.env.example` documents empty = all and lists enabled exchanges.
- **Deploy flow:** Push and redeploy were run; server verification showed endpoints OK and MEXC present in log lines (find first candle, fetchCandles continue).

## Challenges

- **ESLint vs ajv:** Overriding ajv to ≥8.18.0 for the CVE made `@eslint/eslintrc` throw (`defaultMeta` on undefined). Fixing that inside eslintrc was out of scope; the only viable fix was to stop using eslintrc (flat config) and remove the override; CVE is documented as not applicable for ESLint.
- **Container crash cause:** The real failure was `PrismaClientInitializationError: Can't reach database server`; it only became visible after deploy when verification failed and log output was inspected. Retries and longer verify sleep addressed timing; if the DB is unreachable (e.g. firewall), that remains an infra/network fix.
- **MEXC “nothing in logs”:** Initial assumption was env filter excluding MEXC. User’s env had empty exchange lists; code already treated empty as “all”. Reflection: the log was not fully checked for `[mexc]` and `Saved [mexc]` before concluding MEXC was disabled; after deploy, MEXC appeared in the same log tail. Lesson: confirm actual log content before blaming env.

## Lessons Learned

- **Deprecations:** Prisma 6 supports `prisma.config.ts`; migrating early avoids warning noise in CI and Docker logs and keeps options open for Prisma 7.
- **Security overrides vs tooling:** Forcing a major dependency upgrade (ajv 6→8) via overrides can break other deps (eslintrc). Prefer fixing usage (e.g. flat config) or documenting CVE as not applicable instead of forcing the upgrade when upstream has not adopted it.
- **Container startup:** DB connect retries and a longer post-deploy sleep are low-cost and make startup more resilient to DB or network delay; always copy any runtime-needed paths (e.g. `prisma/`) into the production image unless docs explicitly say otherwise.
- **Env semantics:** Centralising “parse env list, empty = no filter” in one function and documenting it in `.env.example` avoids duplicate logic and wrong assumptions (e.g. spaces in env values).
- **Log investigation:** For “exchange X not in logs”, first grep the actual server log for that exchange and for “Exchange is not enabled” before changing env or code.

## Process Improvements

- **Reproduce before concluding:** When a user reports “no MEXC in logs”, fetch or simulate the log (e.g. last N lines, grep mexc) and confirm absence of both activity and “not enabled” messages before changing configuration.
- **Deploy verification:** Keep a single “sleep then verify” step but size the sleep to the longest retry/backoff (e.g. DB retries × delay) so verification runs after the app has had time to become ready.
- **One place for env parsing:** Any “comma-separated list, empty means default” logic should live in one helper and be reused everywhere that list is read, to avoid drift and subtle bugs (e.g. spaces).

## Technical Improvements

- **parseEnvExchangeList(envValue):** Trims and splits on comma, filters out empty segments; returns `[]` when value is undefined, empty, or only whitespace; used for DAY_CANDLE_FETCH_EXCHANGES, HOUR_CANDLE_FETCH_EXCHANGES, M15_CANDLE_FETCH_EXCHANGES, FETCH_EXCHANGES. Prevents a single space from being treated as an exchange name and disabling all.
- **PrismaService.onModuleInit:** Retry loop (e.g. 10 attempts, 3s apart) around `$connect()` so transient DB unavailability at startup does not crash the process.
- **main.ts:** `API_PORT = Number(process.env.API_PORT) || 14444`; bootstrap in try/catch with `console.error` and `process.exit(1)` so misconfiguration or startup errors are visible in container logs.
- **Dockerfile production stage:** `COPY --from=build /usr/app/prisma /usr/app/prisma` so the production image has the schema (and migrations) if any runtime path expects them.

## Next Steps

- Optional: add `prisma.config.ts` to the production image if any CLI or script is ever run inside the container (e.g. migrate); currently only the Node app runs and it does not need the config at runtime.
- Optional: if security scanning keeps flagging ajv, add an audit exception with a link to eslint/eslint#20508 and the “$data not used” rationale.
- Keep using empty exchange env vars for “all exchanges”; if a future deployment needs to restrict to a subset, set the corresponding env vars to a comma-separated list without spaces.
