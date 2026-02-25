# DEV-0005 Implementation Plan: Add Bitget Exchange + API Docs Audit + Full Test Coverage

**Task ID:** DEV-0005  
**Status:** pending  
**Created:** 2026-02-25  
**Complexity:** Level 3

---

## 1. Overview

**Goal:** Fully integrate the Bitget exchange into the candle-collector service, matching the existing adapter pattern (kucoin/gateio/mexc). Simultaneously audit all exchange adapter API documentation for accuracy, write complete test coverage for all exchange adapters and key DB methods, deploy and verify.

**Bitget API (v2) Key Facts:**

| Parameter | Value |
|---|---|
| Candles endpoint | `GET https://api.bitget.com/api/v2/spot/market/candles` |
| History endpoint (>90d) | `GET https://api.bitget.com/api/v2/spot/market/history-candles` |
| Symbol format | No separator — `BTCUSDT` |
| Granularity param | `1min`, `5min`, `15min`, `1H`, `4H`, `1D` |
| startTime / endTime | Unix milliseconds |
| limit | 1–1000 (default 500) |
| Max window per request | 7 days |
| Response success code | `'00000'` (string) |
| Response data array | `[ts_ms, open, high, low, close, baseVol, quoteVol]` (all strings) |
| Auth required | No (public market data) |

**Doc URL:** https://bitgetlimited.github.io/apidoc/en/spot/#get-candlestick-data

---

## 2. Architecture — New / Changed Files

### New files
```
src/exchanges/bitget.interface.ts   BITGET_TIMEFRAME enum + OHLCV_Bitget type
src/exchanges/bitget.ts             fetchCandles, bitgetFindFirstCandle, bitgetFetchCandles, mapper
src/exchanges/bitget.spec.ts        unit tests for all bitget adapter functions
memory-bank/docs/exchange-api-reference.md  canonical exchange API reference
```

### Modified files
```
src/app.service.ts                  +import bitget, +case 'bitget' in FindFirst + Fetch switch
```

> **Note:** `exchange.constant.ts` already contains `'bitget'` in `ENABLED_EXCHANGES` and `TOP_COIN_EXCHANGES`. No `BITGET_TIMEFRAME` needed there — it will live in `bitget.interface.ts` following the kucoin/gateio/mexc pattern. No changes to `exchange-dto.ts` or `interface.ts` — Bitget types stay in its own interface file.

---

## 3. Bitget Adapter Design (`src/exchanges/bitget.ts`)

### 3.1 `bitget.interface.ts`

```typescript
// [ts_ms, open, high, low, close, baseVol, quoteVol]
export type OHLCV_Bitget = [
  string, // timestamp ms
  string, // open
  string, // high
  string, // low
  string, // close
  string, // base asset volume
  string, // quote asset volume
];

export const BITGET_TIMEFRAME = {
  [TIMEFRAME.M1]:  '1min',
  [TIMEFRAME.M5]:  '5min',
  [TIMEFRAME.M15]: '15min',
  [TIMEFRAME.H1]:  '1H',
  [TIMEFRAME.D1]:  '1D',
};
```

### 3.2 `bitget.ts` — functions

| Function | Signature | Notes |
|---|---|---|
| `toBitgetSymbol` | `(synonym: string) => string` | `toExchangeSymbol.noSeparator` → BTCUSDT |
| `getCandleURI` | `(symbol, granularity, start, end, limit) => string` | builds URL with all params |
| `fetchCandles` (internal) | `(synonym, granularity, start, end, limit) => Promise<OHLCV_Bitget[] \| string>` | fetches, validates, returns raw array |
| `bitgetCandleToCandleModel` | `(candle: OHLCV_Bitget) => CandleDb` | maps string tuple to CandleDb |
| `bitgetFindFirstCandle` | `({ synonym, timeframe }) => Promise<Date \| null>` | binary walk forward from START_FETCH_TIME |
| `bitgetFetchCandles` | `({ synonym, timeframe, start, end }) => Promise<CandleDb[] \| string>` | public API, mirrors kucoin pattern |

**DTO mapper:**
```typescript
function bitgetCandleToCandleModel(candle: OHLCV_Bitget): CandleDb {
  return {
    time: new Date(+candle[0]),
    open: +candle[1],
    high: +candle[2],
    low:  +candle[3],
    close: +candle[4],
    volume: +candle[5],
    trades: 0,
  };
}
```

**Response validation:**
```typescript
// Success: { code: '00000', data: OHLCV_Bitget[] }
if (res?.code !== '00000' || !Array.isArray(res?.data)) { return error string }
```

**Pagination note:** Bitget returns up to 1000 candles per call; max window = 7 days. `FindFirstCandle` steps by `limit * timeframeMSeconds` like other adapters.

---

## 4. Wiring in `app.service.ts`

### 4.1 Imports (top of file)
```typescript
import { bitgetFetchCandles, bitgetFindFirstCandle } from './exchanges/bitget';
import { BITGET_TIMEFRAME } from './exchanges/bitget.interface';
```

### 4.2 FindFirstCandle switch — add before `default`:
```typescript
case 'bitget': {
  const firstRes = await bitgetFindFirstCandle({ synonym, timeframe });
  if (!firstRes) {
    Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
    await this.disableMarket({ exchangeId, symbolId });
    return [];
  }
  maxTimestamp = firstRes;
  break;
}
```
> Add in **both** switch statements (the `maxTimestamp === null` branch and the `else` branch) — same pattern as mexc/gateio.

### 4.3 FetchCandles switch — add before `default`:
```typescript
case 'bitget':
  startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
  endTime = Math.min(startTime + (limit || 1000) * timeframeMSeconds(timeframe), getCandleTime(timeframe));
  if (startTime >= endTime) {
    startTime = getCandleTimeByShift(timeframe, 1);
  }
  candles = await bitgetFetchCandles({ synonym, timeframe, start: startTime, end: endTime });
  break;
```

---

## 5. Test Plan (`src/exchanges/bitget.spec.ts`)

### Pattern (from `cmc.service.spec.ts`)
- No NestJS TestingModule needed — pure unit tests
- Mock `fetchJsonSafe` via `jest.mock('../fetch-json-safe')`
- Each test: setup mock return → call function → assert result

### Test cases

| Group | Test | Mock | Assert |
|---|---|---|---|
| `bitgetCandleToCandleModel` | maps all fields | — | time=new Date(+ts), open/high/low/close/volume parsed, trades=0 |
| `bitgetFetchCandles` | success path | returns `{code:'00000', data:[candle1,candle2]}` | returns `CandleDb[]` length 2 with correct values |
| `bitgetFetchCandles` | empty data | returns `{code:'00000', data:[]}` | returns `[]` |
| `bitgetFetchCandles` | network error | returns `{error:'timeout'}` | returns string error |
| `bitgetFetchCandles` | bad code | returns `{code:'40001', msg:'symbol error'}` | returns string error |
| `bitgetFindFirstCandle` | found first candle | first batch returns 1 candle | returns `Date` matching candle time |
| `bitgetFindFirstCandle` | not found | all batches return `[]` | returns `null` |
| `bitgetFindFirstCandle` | error on first call | returns error string | returns `null` |

### Additional spec files for existing adapters
Create `src/exchanges/kucoin.spec.ts`, `src/exchanges/gateio.spec.ts`, `src/exchanges/mexc.spec.ts` — same pattern. Verify mappers and fetch functions with mocked HTTP.

---

## 6. Exchange API Reference Document

Create `memory-bank/docs/exchange-api-reference.md`:

| Exchange | Candles Endpoint | Symbol Format | Timeframe values (M1/M15/H1/D1) | Pagination | Doc Link |
|---|---|---|---|---|---|
| Binance | `GET /api/v3/uiKlines` @ api4.binance.com | BTCUSDT (no sep) | 1m / 15m / 1h / 1d | limit 1-1000, startTime ms | https://binance-docs.github.io/apidocs/spot/en/ |
| OKX | `GET /api/v5/market/history-candles` @ okx.com | BTC-USDT (hyphen) | 1m / 15m / 1H / 1Dutc | before/after ms, limit 1-100 | https://www.okx.com/docs-v5/en/ |
| Bybit | `GET /v5/market/kline` @ api.bybit.com | BTCUSDT (no sep) | 1 / 15 / 60 / D | start ms + limit 1-999 | https://bybit-exchange.github.io/docs/ |
| HTX | `GET /market/history/kline` @ api.huobi.pro | btcusdt (lowercase) | 1min / 15min / 60min / 1day | size 1-2000 (most recent) | https://huobiapi.github.io/docs/ |
| Poloniex | `GET /markets/{symbol}/candles` @ api.poloniex.com | BTC_USDT (underscore) | MINUTE_1 / MINUTE_15 / HOUR_1 / DAY_1 | startTime+endTime ms, limit 1-500 | https://docs.poloniex.com/ |
| KuCoin | `GET /api/v1/market/candles` @ api.kucoin.com | BTC-USDT (hyphen) | 1min / 15min / 1hour / 1day | startAt+endAt seconds | https://docs.kucoin.com/ |
| Gate.io | `GET /api/v4/spot/candlesticks` @ api.gateio.ws | BTC_USDT (underscore) | 1m / 15m / 1h / 1d | from+to seconds, max 999 | https://www.gate.io/docs/developers/apiv4/ |
| MEXC | `GET /api/v3/klines` @ api.mexc.com | BTCUSDT (no sep) | 1m / 15m / 60m / 1d | startTime+endTime ms, limit 1-999 | https://mexcdevelop.github.io/apidocs/ |
| **Bitget** | `GET /api/v2/spot/market/candles` @ api.bitget.com | BTCUSDT (no sep) | 1min / 15min / 1H / 1D | startTime+endTime ms, limit 1-1000 | https://bitgetlimited.github.io/apidoc/en/spot/ |

---

## 7. Implementation Steps (Ordered)

| # | Step | Files | Notes |
|---|---|---|---|
| 1 | Create `bitget.interface.ts` | `src/exchanges/bitget.interface.ts` | BITGET_TIMEFRAME, OHLCV_Bitget |
| 2 | Create `bitget.ts` adapter | `src/exchanges/bitget.ts` | all functions + mapper |
| 3 | Wire into `app.service.ts` | `src/app.service.ts` | import + 2×switch case |
| 4 | Create `exchange-api-reference.md` | `memory-bank/docs/exchange-api-reference.md` | doc for all 9 exchanges |
| 5 | Audit existing adapters vs docs | — | compare URL params vs live API; note discrepancies |
| 6 | Fix discrepancies (if any) | exchange adapters | only if mismatches found |
| 7 | Write `bitget.spec.ts` | `src/exchanges/bitget.spec.ts` | 8+ test cases |
| 8 | Write adapter tests for kucoin/gateio/mexc | `src/exchanges/*.spec.ts` | mapper + fetch + findFirst |
| 9 | Run `pnpm test`, fix failures | — | iterate |
| 10 | Update `.env.example`, `techContext.md` | config/docs | Bitget, test docs link |
| 11 | Push, deploy, smoke-test, report | git + scripts | verify Bitget candles in DB |

---

## 8. Security

- No auth required for candle endpoints (public data)
- Bitget `symbol` param is derived from DB, not user input — no injection risk
- Follow same `fetchJsonSafe` wrapper pattern; no direct `fetch` calls

---

## 9. Rollback

- Feature flag: remove `'bitget'` from the fetch dispatch `switch` (not from `ENABLED_EXCHANGES`) to disable without code revert
- No DB schema changes; no migration needed

---

## 10. Validation Checklist

- [ ] `bitget.interface.ts` created with BITGET_TIMEFRAME and OHLCV_Bitget
- [ ] `bitget.ts` created: all 5 functions + mapper
- [ ] `app.service.ts` wired: imports + case 'bitget' in both FindFirst and Fetch switches
- [ ] `exchange-api-reference.md` created with all 9 exchanges
- [ ] Existing adapter audit complete; discrepancies noted
- [ ] `bitget.spec.ts`: 8+ tests green
- [ ] kucoin/gateio/mexc spec files: mapper + fetch + findFirst tests green
- [ ] `pnpm test` all green
- [ ] Push to main
- [ ] Deploy to 23.88.34.218 via `pnpm run deploy`
- [ ] Smoke test: Bitget candles in DB (`SELECT COUNT(*) FROM "Candle" WHERE "exchangeId" = <bitget_id>`)
- [ ] Health endpoint green
- [ ] Report in memory-bank/reports/
