# TASK ARCHIVE: DEV-0005

## METADATA

| Field | Value |
|-------|-------|
| **Task ID** | DEV-0005 |
| **Title** | Add Bitget exchange — candle fetching, API docs audit, full test coverage, deploy |
| **Type** | feature + quality |
| **Complexity** | Level 3 |
| **Priority** | high |
| **Started** | 2026-02-25 |
| **Completed** | 2026-02-25 |
| **Archived** | 2026-02-26 |
| **Repository** | candles (angry/candles) |
| **Branch** | main |
| **Status** | ✅ COMPLETE & ARCHIVED |

---

## SUMMARY

Bitget exchange was fully integrated into the candle-collector: new adapter (`bitget.ts`, `bitget.interface.ts`) following the kucoin/gateio/mexc pattern, wiring in `app.service.ts`, canonical API reference for all 9 exchanges (`memory-bank/docs/exchange-api-reference.md`), audit of existing adapters vs live docs, and full test coverage for Bitget/KuCoin/Gate.io/MEXC adapters plus PrismaService DB methods.

**Post-deploy fixes (production bugs):** (1) Early `return` in D1/H1/M15 exchange loops → changed to `continue` so bitget (and other later exchanges) are queued. (2) Bitget `history-candles` endpoint max limit 200 → capped in adapter. (3) Granularity strings `1H`/`1D` → `1h`/`1day` per Bitget API spec.

**Final state:** Production (23.88.34.218) feeder running; Bitget candles saved (e.g. `Saved [bitget] APE/USDT.D1: 200`); 54 tests pass; health endpoint green.

---

## REQUIREMENTS (KEY GOALS MET)

1. **Bitget adapter** — `bitgetFetchCandles`, `bitgetFindFirstCandle`, `bitgetCandleToCandleModel`; two endpoints (candles vs history-candles) with 90-day threshold and limit 200 for history.
2. **Wire into feeder** — Bitget in `ENABLED_EXCHANGES` and `TOP_COIN_EXCHANGES`; three `case 'bitget'` blocks in `app.service.ts` (findFirst ×2, fetchCandles ×1).
3. **Exchange docs audit** — `memory-bank/docs/exchange-api-reference.md` created with endpoint URLs, symbol formats, timeframe maps, doc links for all 9 exchanges.
4. **Code compliance** — All adapters verified against current API docs; no discrepancies in existing 8; Bitget aligned after fixes.
5. **Test coverage** — `bitget.spec.ts`, `kucoin.spec.ts`, `gateio.spec.ts`, `mexc.spec.ts`, `prisma.service.spec.ts`; 54 tests total, all passing.
6. **Deploy & verify** — Pushed to main; deployed to 23.88.34.218; Bitget candles in DB; health and endpoints OK.

---

## IMPLEMENTATION

### New files

| File | Purpose |
|------|---------|
| `src/exchanges/bitget.interface.ts` | `OHLCV_Bitget` type, `BITGET_TIMEFRAME` (1min, 5min, 15min, 1h, 1day) |
| `src/exchanges/bitget.ts` | `toBitgetSymbol`, `getCandleURI`, `fetchCandles`, `bitgetFindFirstCandle`, `bitgetFetchCandles`, `bitgetCandleToCandleModel`; history-candles limit 200 |
| `src/exchanges/bitget.spec.ts` | Unit tests for mapper, fetch, findFirst, endpoint selection, limit cap |
| `memory-bank/docs/exchange-api-reference.md` | Canonical reference for all 9 exchanges |
| `src/prisma.service.spec.ts` | 10 tests for hasTopCoinFromCmcData, getTopCoinCounts, getTopCoins, getTopCoinMarkets, getTopCoinFirstExchange |

### Modified files

| File | Change |
|------|--------|
| `src/app.service.ts` | Import bitget; `case 'bitget'` in findFirstCandle (×2) and fetchCandles; **fix:** `return` → `continue` in D1/H1/M15 exchange loops |
| `src/exchange.constant.ts` | `bitget` in ENABLED_EXCHANGES and TOP_COIN_EXCHANGES |
| `.env.example` | bitget in FETCH_EXCHANGES lists |
| `prisma/seed.ts` | bitget in exchangeData |
| `memory-bank/techContext.md` | Bitget in adapters list |
| `Dockerfile` | Copy corepack cache from deps to build stage (fix pnpm build when DNS unavailable) |

### Key technical decisions

- **Bitget types in `bitget.interface.ts` only** — No changes to shared `exchange-dto.ts` or `interface.ts`; matches kucoin/gateio/mexc pattern.
- **Two endpoints** — `candles` for data ≤90 days, `history-candles` for older; `history-candles` max limit 200.
- **Granularity** — API expects lowercase `1h`, `1day` (not `1H`, `1D`).

---

## TESTING

- **Strategy:** Unit tests with mocked `fetchJsonSafe` for Bitget, KuCoin, Gate.io, MEXC; PrismaService with mocked Prisma client.
- **Outcome:** 54 tests in 7 suites, all passing. Compliance added missing `prisma.service.spec.ts`. No integration/E2E against live Bitget.
- **Gap (deferred):** Binance, OKX, Bybit, HTX, Poloniex adapters in `exchange-fetch-candles.ts` have no spec files; optional for future.

---

## LESSONS LEARNED & REFLECTION

- **Reflection:** [memory-bank/reflection/reflection-DEV-0005.md](../reflection/reflection-DEV-0005.md)
- **Critical lessons:** (1) Use `continue` not `return` when skipping one exchange in a loop. (2) Verify per-endpoint limits and exact granularity strings from API docs before coding. (3) Compliance run caught missing PrismaService tests.

---

## KNOWN ISSUES / FUTURE CONSIDERATIONS

- Add Bitget error string (e.g. "symbol not exists") to `app.service.ts` disable-market error list (optional hardening).
- Consider deploy check: “within N minutes, logs contain at least one line per enabled exchange.”
- `pnpm test --coverage` fails (babel-plugin-istanbul); pre-existing, unrelated to DEV-0005.

---

## REFERENCES

- **Reflection:** [memory-bank/reflection/reflection-DEV-0005.md](../reflection/reflection-DEV-0005.md)
- **Implementation plan:** [memory-bank/tasks/DEV-0005-implementation-plan.md](../tasks/DEV-0005-implementation-plan.md)
- **Compliance report:** [memory-bank/reports/compliance-report-DEV-0005-2026-02-25.md](../reports/compliance-report-DEV-0005-2026-02-25.md)
- **Exchange API reference:** [memory-bank/docs/exchange-api-reference.md](../docs/exchange-api-reference.md)
