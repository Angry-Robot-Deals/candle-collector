# Server check 2026-03-06 — app-error.log

## 1. INT4 overflow (fixed in code)

**Error:** `Unable to fit integer value '2581645359' into an INT4 (32-bit signed integer)` in `candleD1.createMany()`.

**Cause:** Some exchange returns a very large value for `trades` (e.g. 2581645359). PostgreSQL `Int` is 32-bit signed (max 2,147,483,647).

**Fix:** Clamp `trades` to `[0, MAX_SAFE_TRADES]` in all four save methods: `saveExchangeCandles`, `saveExchangeCandlesH1`, `saveExchangeCandlesM15`, `saveExchangeCandlesD1`. Constant `MAX_SAFE_TRADES = 2_147_483_647` in `app.constant.ts`.

---

## 2. No space left on device (server action required)

**Errors:** `could not extend file "base/16385/147631.20": No space left on device`, `could not write to file "pg_wal/xlogtemp.411944": No space left on device`, `Server has closed the connection`.

**Cause:** Disk full on the server where PostgreSQL stores data.

**Action (on server):**
- Check: `df -h`
- Free space: remove old logs, `docker system prune -a`, truncate/rotate app logs, or extend disk/volume.
- Restart PostgreSQL after freeing space if it crashed.

---

## 3. Bybit retCode 10016 (optional)

**Error:** `[bybit] bad response: XIONUSDT 1 {"retCode":10016,"retMsg":"internal error",...}`

**Cause:** Transient Bybit API error. Not a bug in our code.

**Optional:** Treat 10016 like 429 (skip this cycle, do not disable market). Low priority.
