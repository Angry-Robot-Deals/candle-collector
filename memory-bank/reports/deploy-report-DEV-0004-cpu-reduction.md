# Deploy report: DEV-0004 CPU reduction

**Task:** DEV-0004 (migration + CPU tuning)  
**Date:** 2026-02-25  
**Scope:** Commit “perf: reduce CPU load” — deploy and smoke test.

---

## 1. Commit

- **Hash:** `5199150`
- **Message:** `perf: reduce CPU load — Docker limits, limit concurrent exchange fetches`
- **Files:** `.env.example`, `docker-compose.yml`, `src/app.service.ts`, `memory-bank/tasks/DEV-0004-migration-runbook.md`
- **Result:** Committed successfully.

---

## 2. Push

- **Target:** `github-ard:Angry-Robot-Deals/candle-collector.git` (branch `main`)
- **Result:** Pushed successfully (`225cf7e..5199150 main -> main`).
- **Note:** GitHub reported 1 moderate vulnerability (Dependabot #55); unrelated to this deploy.

---

## 3. Deploy

- **Script:** `pnpm run deploy` → `scripts/external-deploy.sh`
- **Target host:** 23.88.34.218 (from `.env` / `APP_SERVER_USER`)
- **Actions on server:**
  - Stop/remove previous container and network
  - `git pull` (fast-forward to 5199150)
  - `docker compose -p cc build` (image built)
  - `docker compose -p cc up -d` (container started)
- **Result:** Success. Container `cc-candles-1` created and started.

---

## 4. Test

- **From automation host:** `curl http://23.88.34.218:14444/` → connection failed (exit 7). Likely network/firewall between test runner and server.
- **Recommendation:** Verify from your environment:
  ```bash
  curl -s http://23.88.34.218:14444/
  # expect: "Works X days Y hours Z minutes"
  curl -s http://23.88.34.218:14444/getTopCoinCounts
  ```

---

## 5. Summary

| Step   | Status   | Note |
|--------|----------|------|
| Commit | Done     | 5199150 |
| Push   | Done     | main |
| Deploy | Done     | Container started on 23.88.34.218 |
| Test   | Skipped* | *Run curl from your machine/VPN |

CPU-related behaviour on server after deploy:

- **Docker:** `deploy.resources.limits.cpus: "2"` in `docker-compose.yml` (applies when using Stack; for `docker compose up` behaviour see runbook).
- **App:** `FETCH_CONCURRENT_EXCHANGES` default **2** — D1/H1/M15 fetches run at most 2 exchanges in parallel. Set in `.env` on server if you want 1 (min CPU) or 4–6 (faster cycles).

Runbook section **“Reducing CPU load”**: `memory-bank/tasks/DEV-0004-migration-runbook.md`.
