# Reflection — DEV-0007

**Task:** Structured logging — split API and APP logs with rotation
**Completed:** 2026-03-02
**Complexity:** Level 2

---

## Summary

Implemented structured logging using Winston for a NestJS app running in Docker. Split the single 110–150 MB monolithic `app.log` into 4 separate streams with daily rotation via `winston-daily-rotate-file`. Added HTTP access middleware for API-level logging. Fixed a critical deployment bug discovered during the process.

---

## What Went Well

- **Clean architecture:** `src/logging/` directory with two focused files (`winston.config.ts`, `http-access.middleware.ts`) made the integration clean and non-invasive to existing service code.
- **Zero breaking changes:** All existing `Logger.log/debug/error/warn` calls continued to work without modification — only the transport layer changed.
- **Fast verification:** 4 log files appeared within 1 minute of first container start. `api-error.log` was validated immediately by hitting a 404 endpoint.
- **Compliance sweep caught real issues:** Gate.io `INVALID_CURRENCY_PAIR` error was not mapped to `[]` for `-404` state machine transition — found and fixed during `/compliance`.
- **calculateAllATHL demotion:** The "Delay ATHL 72M ms" WARN was flooding `app-error.log` every 60 seconds. Changed to DEBUG, cleaned the error log significantly.

---

## Challenges

### 1. `docker compose restart` vs `up -d`

**Problem:** After the `Logger.warn → Logger.debug` fix, the container was restarted with `docker compose restart`. This does NOT apply the newly built image — it reuses the existing container binary. The fix was therefore invisible in production for 15+ minutes.

**Root cause:** The deploy command in `activeContext.md` used `restart`. The `external-deploy.sh` already used `up -d` (correct), but the quick "hotfix" pattern in the memory bank was wrong.

**Resolution:** Updated `activeContext.md` deploy command to `docker compose -p cc up -d candles`.

**Lesson:** `docker compose build + restart` ≠ "apply new code". Always use `up -d` after `build` to recreate the container.

### 2. TypeScript overload incompatibility for `res.write / res.end`

**Problem:** Overriding `res.write` and `res.end` in the HTTP middleware with typed `...args: Parameters<typeof res.write>` caused TS2322 errors — Express's overloaded signatures are incompatible with spread parameters.

**Resolution:** Used `(res as any).write = function(chunk, ...rest)` pattern — explicit cast to `any` for the assignment, keeping the implementation typed internally.

**Lesson:** When monkey-patching `http.ServerResponse` methods that have multiple overloads, use `as any` on the assignment side but keep the body type-safe.

---

## Lessons Learned

1. **`docker compose restart` is for config changes, not image rebuilds.** The correct post-build command is `docker compose up -d [service]` which recreates the container from the new image.

2. **Winston `level` in transport = minimum level (inclusive up).** Setting `level: 'warn'` on a transport means it gets WARN + ERROR. Setting `level: 'debug'` on another means it gets everything. This is the correct way to split streams without duplicating logger instances.

3. **Compliance sweep adds real value beyond code review.** The Gate.io `-404` gap and the ATHL WARN noise were both found during `/compliance`, not during the initial implementation.

4. **Middleware `res.end` override is the only reliable way** to capture final status code + response body in Express/NestJS after the full response lifecycle completes.

---

## Process Improvements

- Add `docker compose -p cc up -d candles` (not `restart`) to all deploy patterns in memory bank.
- During implementation of logging changes: always tail `app-error.log` and `app-process.log` after first restart to verify levels are routed correctly before declaring done.

---

## Technical Improvements (Future)

- Add `Bybit` invalid-symbol retCode handling (not observed in prod yet, but the pattern is established for all other exchanges).
- Consider demoting `-404` state machine transitions from WARN to LOG level — they are informational, not errors.
- Consider adding `app-error.log` entries to an alerting pipeline (e.g., threshold-based alert if ERROR count > N per minute).

---

## Next Step

`/archive` DEV-0007
