# QA Report: DEV-0003 — Deploy & Route Check

**Task:** DEV-0003 (fetchTopCoins from CMC)  
**Date:** 2026-02-21  
**Type:** QA, TEST, PUSH, DEPLOY, VIEW, OPEN route, check data, TEST, report  

---

## 1. QA & TEST (pre-push)

| Step | Command | Result |
|------|---------|--------|
| Lint | `pnpm run lint` | Pass (exit 0) |
| Unit tests | `pnpm test` | Pass — 2 suites, 5 tests |
| Build | `pnpm run build` | Pass |

No fixes required.

---

## 2. PUSH

- **Commit:** `03b67a6` — feat(DEV-0003): CMC top coins - fetch from coinmarketcap.com, TopCoinFromCmc table, daily job, TopCoin sync (max 500, delete tail)
- **Branch:** main
- **Remote:** github-ard:Angry-Robot-Deals/candle-collector.git
- **Result:** Pushed successfully (3045350..03b67a6).  
- **Note:** GitHub reported 1 moderate Dependabot vulnerability (see repo security tab).

---

## 3. DEPLOY

- **Script:** `scripts/external-deploy.sh`
- **Server:** 37.27.107.227 (Ubuntu 24.04)
- **Actions:** git pull, docker compose down, build image cc-candles, up -d, verify-server.sh after 35s
- **Result:** Deploy completed. Verification passed (GET /, /exchange, /market, /getTopCoins, /getATHL, /getTopTradeCoins — all HTTP 200). No critical errors in logs.

---

## 4. VIEW Docker & Logs

- **Containers:** cc-candles-1 started after deploy.
- **Logs (last 5):** DB init OK, app running; fetchCandles/fetchExchange* activity visible. No critical errors.

---

## 5. OPEN New Route & Check Data

| Endpoint | Method | Result |
|----------|--------|--------|
| **GET /updateTopCoinsFromCmc** | Trigger CMC update | HTTP 200, `{"ok":true,"message":"CMC top coins updated"}` (run ~7s) |
| **GET /getTopCoins** | Top coins list | HTTP 200, JSON array with coin, name, price, volume24, cost24, etc. (e.g. BTC, ETH, SOL). Data present; timestamps 2026-02-21. |
| **GET /getTopCoinFirstExchange** | Top coins + first exchange | HTTP 200, `{"count":91,"data":[...]}` — coin, symbolId, symbol, exchangeId, exchange. |

New route works; CMC update completes; getTopCoins and getTopCoinFirstExchange return expected structure and data (91 top coins with first exchange).

---

## 6. Final TEST

- **pnpm test:** Pass — 2 suites, 5 tests.

---

## Summary

- **QA:** Lint, test, build passed.  
- **PUSH:** Success to main.  
- **DEPLOY:** Success on 37.27.107.227; verify-server passed.  
- **New route:** GET /updateTopCoinsFromCmc returns 200 and triggers CMC update.  
- **Data:** getTopCoins and getTopCoinFirstExchange return CMC-backed top coins (91 with first exchange).  
- **Fix:** None required.  
- **Final test:** Pass.

**Status:** DEV-0003 deploy and new route verified. Ready for /reflect or production use.
