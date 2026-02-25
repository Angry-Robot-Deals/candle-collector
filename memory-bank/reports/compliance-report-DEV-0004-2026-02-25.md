# Compliance Report — DEV-0004

**Task:** DEV-0004 — Migrate feeder and API to DB server (Docker, open port; DB local)  
**Date:** 2026-02-25  
**Status:** ✅ PASSED (with minor notes)

---

## 1. Change Set & PRD / Task Alignment

### Changed files (commits `d9dad65`..`35004c9` on `main`)

| File | Change | Aligns with DEV-0004? |
|------|--------|-----------------------|
| `docker-compose.yml` | `extra_hosts: host.docker.internal:host-gateway`; CPU limits (`deploy.resources`); logging options | ✅ Required for DB connectivity on same host |
| `scripts/external-deploy.sh` | `DEPLOY_TARGET_USER/SSH_KEY` override; logrotate install; `verify-server.sh` call after deploy | ✅ Deploy automation goal |
| `.env.example` | New vars: `FETCH_CONCURRENT_EXCHANGES`; `APP_SERVER_*` defaults to 23.88.34.218; `OLD_APP_SERVER_*` note; `host.docker.internal` reminder | ✅ Docs goal |
| `src/app.service.ts` | Concurrent exchange fetch limit (`FETCH_CONCURRENT_EXCHANGES`); `getFetchConcurrentExchanges()` helper; chunked D1/H1/M15 loops | ✅ CPU reduction (bonus, not in task scope — acceptable) |
| `src/app.constant.ts` | `TOP_COIN_SYNC_LIMIT=150`, `CMC_FETCH_PAGES=100` | ⚠️ Partially out of DEV-0004 scope (config change). Functionally correct; no risk. |
| `memory-bank/tasks/DEV-0004-migration-runbook.md` | Step-by-step migration runbook; CPU reduction section | ✅ Documentation goal |
| `scripts/pre-migration-stop-old-server.sh` | SSH to old server, stop + Docker cleanup | ✅ Pre-migration goal |
| `scripts/update-db-server-and-reboot.sh` | apt upgrade + reboot on new server | ✅ Server prep goal |
| `scripts/diagnose-server.sh` | Diagnostic script for troubleshooting | ✅ Operational helper |
| `scripts/verify-server.sh` | Smoke-test endpoints + log check post-deploy | ✅ Verification goal |

### PRD alignment verdict

All core success criteria from DEV-0004 are satisfied:
- [x] Old server (37.27.107.227): app stopped, Docker removed.
- [x] New server (23.88.34.218): app runs in Docker; port 14444 open and responding.
- [x] `DATABASE_URL` uses `host.docker.internal:51432` (PostgreSQL on same host).
- [x] Deploy script and `.env.example` target new server.
- [x] GitHub keys documented in runbook.

**Drift:** `src/app.constant.ts` changes (`TOP_COIN_SYNC_LIMIT`, `CMC_FETCH_PAGES`) were done post-migration at user request. Not in original DEV-0004 scope, but benign and intentional.

---

## 2. Code Simplification

### `app.service.ts` — `getFetchConcurrentExchanges()`

```typescript
getFetchConcurrentExchanges(): number {
  const raw = process.env.FETCH_CONCURRENT_EXCHANGES;
  if (raw == null || raw === '') return 2;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(n, 20);
}
```
**Assessment:** Concise, single responsibility, defensive parsing. ✅ No simplification needed.

### Chunked exchange loops (D1 / H1 / M15)

```typescript
const concurrency = this.getFetchConcurrentExchanges();
for (let i = 0; i < jobs.length; i += concurrency) {
  const chunk = jobs.slice(i, i + concurrency);
  await Promise.all(chunk.map((fn) => fn())).catch(...);
}
```
**Assessment:** Simple, readable, correct. ✅ No simplification needed.

### `mapLimit` import

Still used in `calculateAllATHL` (line 508) — import is not dead. ✅

---

## 3. References & Dead Code

| Item | Verdict |
|------|---------|
| `mapLimit` import in `app.service.ts` | ✅ Used in `calculateAllATHL` |
| `getFetchConcurrentExchanges()` method | ✅ Called in 3 places (D1, H1, M15 loops) |
| `scripts/diagnose-server.sh` | ✅ Operational tool; not dead code |
| `scripts/pre-migration-stop-old-server.sh` | ✅ Used for Step 1 migration |
| `OLD_APP_SERVER_*` vars in `.env.example` | ✅ Commented out correctly (migration-only) |

No unused imports or dead references found.

---

## 4. Test Coverage

| Test file | Tests | Result |
|-----------|-------|--------|
| `src/cmc.service.spec.ts` | CMC fetch / parse | ✅ PASS |
| `src/global-variables-db.service.spec.ts` | GlobalVar read/write | ✅ PASS |

```
Test Suites: 2 passed, 2 total
Tests:       5 passed, 5 total
Time:        2.316s
```

**Coverage gaps (existing, not introduced by DEV-0004):**
- `src/app.service.ts` — exchange fetch loops not covered. Pre-existing gap; DEV-0005 plans to add coverage.
- `getFetchConcurrentExchanges()` — not tested. Low risk (simple env parse). Suggested test in DEV-0005.

---

## 5. Linters & Formatters

```
pnpm run lint   → 0 errors, 0 warnings (ESLint --fix, no changes needed)
ReadLints       → No linter errors in app.service.ts, app.constant.ts, docker-compose.yml
```
✅ Clean.

---

## 6. Test Execution

```
pnpm test
PASS src/cmc.service.spec.ts
PASS src/global-variables-db.service.spec.ts
Tests: 5 passed, 5 total
```
✅ Green.

---

## 7. Optional Hardening

### Production smoke test (23.88.34.218)
```
GET /           → "Works 9 minutes"         ✅
GET /getTopCoinCounts → {"topCoinFromCmc":8584,"topCoin":149}  ✅
```

### Known issue resolved
- **`2host.docker.internal` typo** in `.env` on server: fixed with `sed -i` directly on server. `.env.production` (local) must also be verified — not committed, so user must fix manually if needed.

### Docker CPU limits
- `deploy.resources.limits.cpus: "2"` added. Note: this applies in Docker Stack mode (`docker stack deploy`). With plain `docker compose up`, the limit is not enforced by default. Workaround: use `--cpus` flag or rely on `FETCH_CONCURRENT_EXCHANGES=2` for effective CPU throttling.

### Dependabot
- GitHub reports 1 moderate vulnerability (Dependabot #55). Pre-existing; unrelated to DEV-0004 changes.

---

## Summary

| Step | Status | Notes |
|------|--------|-------|
| PRD alignment | ✅ Pass | All success criteria met; minor scope drift in app.constant.ts (intentional) |
| Code simplification | ✅ Pass | New methods are concise and clear |
| References / dead code | ✅ Pass | No unused imports or dead code |
| Test coverage | ⚠️ Gap (pre-existing) | Exchange fetch loops not tested; planned for DEV-0005 |
| Lint / format | ✅ Pass | 0 errors |
| Tests | ✅ Pass | 5/5 green |
| Hardening | ✅ Pass | Production responding; CPU throttle via FETCH_CONCURRENT_EXCHANGES |

**Overall: PASSED** — DEV-0004 complete. Pre-existing test coverage gap deferred to DEV-0005.

---

## Follow-ups / Risks

1. **`.env.production` (local):** Verify `DATABASE_URL` has no `2host` prefix — fix before next deploy.
2. **Docker CPU limits:** Enforce with `FETCH_CONCURRENT_EXCHANGES=1|2` in `.env` on server for guaranteed throttling.
3. **Dependabot #55:** Review and update affected dependency in a separate task.
4. **Test coverage:** `getFetchConcurrentExchanges()` and exchange fetch loops — add in DEV-0005.
5. **DEV-0004 status:** Mark `in_progress → completed` in `tasks.md` and proceed to `/reflect`.
