# TASK ARCHIVE: DEV-0004

## METADATA

| Field | Value |
|-------|-------|
| **Task ID** | DEV-0004 |
| **Title** | Migrate feeder and API to DB server (Docker, open port; DB local) |
| **Type** | infrastructure / migration |
| **Complexity** | Level 2 |
| **Priority** | high |
| **Started** | 2026-02-24 |
| **Completed** | 2026-02-25 |
| **Repository** | candles (angry/candles) |
| **Branch** | main |
| **Commits** | `d9dad65` → `35004c9` |
| **Status** | ✅ COMPLETE |

---

## SUMMARY

Migrated the candle-collector application (NestJS API + background feeder) from the old server **37.27.107.227** to the DB server **23.88.34.218**, where it runs in Docker alongside a local PostgreSQL instance. The migration was completed in a single session with zero data loss.

Key additional work done beyond original scope (at user request):
- CPU throttling (`FETCH_CONCURRENT_EXCHANGES`, Docker resource limits)
- Logrotate configuration for persistent log rotation
- Diagnostic and verification scripts embedded in the deploy pipeline
- Top coin sync limit reduced to 150 (`TOP_COIN_SYNC_LIMIT=150`)

**Final state:** API at `http://23.88.34.218:14444/` — responding `Works N minutes`; DB connected; `topCoin=149`, all endpoints HTTP 200.

---

## REQUIREMENTS

### Original success criteria (all met ✅)

1. **Old server (37.27.107.227):** app stopped, Docker containers/images removed.
2. **New server (23.88.34.218):** app (API + feeder) runs in Docker; port 14444 open and reachable; `DATABASE_URL` uses local DB on the same host.
3. **Automation:** deploy script and `.env.example` target new server; GitHub key setup documented.

---

## IMPLEMENTATION

### Changed files (commits involved)

| File | Change |
|------|--------|
| `docker-compose.yml` | `extra_hosts: host.docker.internal:host-gateway`; CPU resource limits; json-file logging |
| `scripts/external-deploy.sh` | `DEPLOY_TARGET_USER/SSH_KEY` env override; logrotate install on server; `verify-server.sh` call after 35s wait |
| `scripts/pre-migration-stop-old-server.sh` | SSH to old server, `docker compose down`, image prune, optional Docker uninstall |
| `scripts/update-db-server-and-reboot.sh` | `apt upgrade` + reboot on new server (Step 0 of runbook) |
| `scripts/verify-server.sh` | Smoke-test: check 6 endpoints + critical log scan; exit 1 on failure |
| `scripts/diagnose-server.sh` | Diagnostic: container status, port check, last 40 log lines, curl localhost, .env check |
| `scripts/logrotate-candles.conf` | Logrotate: daily, rotate 14, copytruncate |
| `.env.example` | New vars: `APP_SERVER_*` defaults to 23.88.34.218; `OLD_APP_SERVER_*` (commented); `FETCH_CONCURRENT_EXCHANGES`; `host.docker.internal` reminder |
| `src/app.service.ts` | `getFetchConcurrentExchanges()` helper; chunked D1/H1/M15 exchange loops (batch by concurrency instead of `Promise.all`) |
| `src/app.constant.ts` | `TOP_COIN_SYNC_LIMIT=150`; `CMC_FETCH_PAGES=100` |
| `memory-bank/tasks/DEV-0004-migration-runbook.md` | Full step-by-step runbook: pre-migration, new server prep, deploy, validation, GitHub key setup, CPU reduction section |
| `README.md` | Deploy target updated to 23.88.34.218; new server prerequisites checklist |
| `memory-bank/techContext.md` | Production server updated to 23.88.34.218; deploy notes |

### Key technical decisions

**`host.docker.internal` for DB access**  
Docker container → host PostgreSQL via `extra_hosts: host.docker.internal:host-gateway` in `docker-compose.yml`. No need for hardcoded IPs or separate Docker network.

**`FETCH_CONCURRENT_EXCHANGES`**  
Application-level CPU throttle. Max N exchanges fetch D1/H1/M15 in parallel (default 2, configurable via env). Chunked `for` loop + `Promise.all` per chunk. More reliable than Docker CPU limits which only apply in Swarm/Stack mode.

**Embedded verification in deploy**  
`external-deploy.sh` sleeps 35 seconds post-startup, then runs `verify-server.sh`. Deploy fails loudly if API does not respond or if critical errors appear in log.

---

## TESTING

### Verification method

1. **Automated (in deploy script):** `scripts/verify-server.sh` checks 6 endpoints + log scan after every deploy.
2. **Manual smoke test:** `curl http://23.88.34.218:14444/` → `Works N minutes`
3. **DB connectivity:** `curl http://localhost:14444/getTopCoinCounts` → `{"topCoinFromCmc":8584,"topCoin":149}`
4. **Compliance:** `pnpm test` → 5/5 green; `pnpm run lint` → 0 errors

### Issues encountered and resolved

| Issue | Cause | Fix |
|-------|-------|-----|
| API not responding | `2host.docker.internal` typo in `.env.production` (carried over from earlier session) | `sed -i` on server + container recreate |
| Deploy went to old server | `.env` still had `APP_SERVER_USER=root@37.27.107.227` | Updated `.env`; reran deploy |
| `updateTopCoinsFromCmc` timeout | 100 pages × 1500ms delay = ~2.5min delays alone | Used `curl --max-time 300`; async redesign deferred to future task |

---

## LESSONS LEARNED

1. **Validate `DATABASE_URL` before deploy** — add `grep`/regex check in `external-deploy.sh` before `scp`; catches typos like `2host` early.
2. **Application-level CPU throttle > Docker limits** — `FETCH_CONCURRENT_EXCHANGES` works with any Docker run mode; Docker `deploy.resources` requires Swarm.
3. **Long-running API endpoints should be async** — operations >30s (CMC bulk fetch) should return `202 Accepted` + poll endpoint rather than blocking the HTTP connection.
4. **Always print deploy target before running** — `grep APP_SERVER_USER .env` before `pnpm run deploy` prevents accidental wrong-server deploys.
5. **Diagnostic script pays off immediately** — `diagnose-server.sh` (container status + port + logs + curl) resolved the `2host` issue in one SSH command.

---

## REFERENCES

| Document | Path |
|----------|------|
| Reflection | `memory-bank/reflection/reflection-DEV-0004.md` |
| Runbook | `memory-bank/tasks/DEV-0004-migration-runbook.md` |
| Compliance report | `memory-bank/reports/compliance-report-DEV-0004-2026-02-25.md` |
| Deploy report | `memory-bank/reports/deploy-report-DEV-0004-cpu-reduction.md` |
| Previous task | `memory-bank/archive/archive-DEV-0003.md` |
| Next task | DEV-0005 — Add Bitget exchange, full test coverage, deploy |
