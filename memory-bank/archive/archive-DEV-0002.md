# TASK ARCHIVE: DEV-0002 — Fix Prisma deprecation, ESLint/ajv, container stability, exchange env

**Task ID:** DEV-0002  
**Archived:** 2026-02-21  
**Complexity:** Level 2  
**Type:** infrastructure / fix  
**Repository:** candles (angry/candles)  
**Branch:** main  

---

## METADATA

| Field | Value |
|-------|--------|
| Task ID | DEV-0002 |
| Title | Fix Prisma deprecation, ESLint/ajv, container stability, exchange env |
| Started | 2026-02-21 |
| Status | completed |
| Priority | high |

---

## SUMMARY

Four fix areas were completed: (1) Prisma — config moved from `package.json#prisma` to `prisma.config.ts` (no deprecation warning in build/deploy). (2) ESLint — flat config without `@eslint/eslintrc`; ajv override removed so lint runs (CVE not applicable per upstream). (3) Container — default `API_PORT`, bootstrap try/catch, `prisma/` in production image, Prisma DB connect retries (10×3s), deploy verify sleep 35s. (4) Exchange env — `parseEnvExchangeList()` so empty/unset = all exchanges; `.env.example` updated; MEXC confirmed in logs when env lists are empty.

---

## REQUIREMENTS

- Remove Prisma deprecation warning (migrate off `package.json#prisma`).
- Fix ESLint failure (ajv/ESLint conflict); no suppression, fix root cause.
- Ensure container stays up after deploy; no warnings/errors from app or tooling.
- Clarify exchange env semantics (empty = all) and document; verify MEXC appears in logs when appropriate.

---

## IMPLEMENTATION

### Prisma

- **prisma.config.ts** (root): `defineConfig` from `prisma/config`, `import 'dotenv/config'`; `schema: 'prisma/schema.prisma'`, `migrations.path`, `migrations.seed: 'ts-node prisma/seed.ts'`.
- **package.json:** Removed block `"prisma": { "seed": "..." }`.

### ESLint

- **eslint.config.js:** Flat config using `@typescript-eslint/eslint-plugin/use-at-your-own-risk/raw-plugin` (`flat/recommended`), `languageOptions.parserOptions.project`, custom rules (interface-name-prefix off, etc.), `eslint-config-prettier/flat` last. No `FlatCompat` / `@eslint/eslintrc`.
- **.eslintrc.js:** Deleted.
- **package.json:** Removed pnpm override `ajv@<8.18.0: ">=8.18.0"` (incompatible with eslintrc; CVE not applicable for ESLint).

### Container

- **src/main.ts:** `API_PORT = Number(process.env.API_PORT) || 14444`; bootstrap in try/catch with `console.error` and `process.exit(1)`.
- **Dockerfile (production):** `COPY --from=build /usr/app/prisma /usr/app/prisma`.
- **src/prisma.service.ts:** `onModuleInit` retries `$connect()` up to 10 times with 3s delay.
- **scripts/external-deploy.sh:** Sleep before verify increased from 5s to 35s.

### Exchange env

- **src/app.service.ts:** `parseEnvExchangeList(envValue)` — trim, split on comma, filter empty; empty/whitespace/undefined → `[]` (all exchanges). Used for `DAY_CANDLE_FETCH_EXCHANGES`, `HOUR_CANDLE_FETCH_EXCHANGES`, `M15_CANDLE_FETCH_EXCHANGES`, `FETCH_EXCHANGES`.
- **.env.example:** Comment that empty/unset = all enabled exchanges; listed exchange names; example vars with empty values.

---

## TESTING

- Local: `pnpm run build`, `pnpm run lint`, `pnpm run test` — all pass; no Prisma deprecation in build output.
- Deploy: `scripts/external-deploy.sh` run after push; server build uses `prisma.config.ts`; verification passed (endpoints 200, no critical errors in app log).
- Container: Confirmed app stays up; DB connect retries and longer verify sleep used; MEXC seen in log tail (`[mexc] find first candle`, `mexc ACA/USDT 1d continue`).

---

## LESSONS LEARNED

- Prisma 6: Prefer `prisma.config.ts` early to avoid deprecation noise and prepare for Prisma 7.
- Security overrides (e.g. ajv) can break other deps (eslintrc); prefer fixing usage (flat config) or documenting CVE as not applicable.
- Container startup: DB retries and post-deploy sleep improve resilience; copy required paths (e.g. `prisma/`) into production image unless docs say otherwise.
- Env semantics: Centralise “empty = default” parsing in one helper and document in `.env.example`.
- Log investigation: Confirm actual log content (e.g. grep for exchange name) before attributing “no activity” to env or code.

---

## REFERENCES

- **Reflection:** [memory-bank/reflection/reflection-DEV-0002.md](../reflection/reflection-DEV-0002.md)
- **Tasks:** memory-bank/tasks.md (DEV-0002)
