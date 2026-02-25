# Exchange API Reference — Candles / Klines

**Purpose:** Canonical reference for all exchange candle endpoints used in the candle-collector service.  
**Last updated:** 2026-02-25 (DEV-0005 audit)

---

## Quick Summary Table

| Exchange | Base URL | Candles Endpoint | Symbol Format | Auth Required |
|---|---|---|---|---|
| Binance | `api4.binance.com` | `GET /api/v3/uiKlines` | BTCUSDT (no sep) | No |
| OKX | `www.okx.com` | `GET /api/v5/market/history-candles` | BTC-USDT (hyphen) | No |
| Bybit | `api.bybit.com` | `GET /v5/market/kline` | BTCUSDT (no sep) | No |
| HTX (Huobi) | `api.huobi.pro` | `GET /market/history/kline` | btcusdt (lowercase) | No |
| Poloniex | `api.poloniex.com` | `GET /markets/{symbol}/candles` | BTC_USDT (underscore) | No |
| KuCoin | `api.kucoin.com` | `GET /api/v1/market/candles` | BTC-USDT (hyphen) | No |
| Gate.io | `api.gateio.ws` | `GET /api/v4/spot/candlesticks` | BTC_USDT (underscore) | No |
| MEXC | `api.mexc.com` | `GET /api/v3/klines` | BTCUSDT (no sep) | No |
| **Bitget** | `api.bitget.com` | `GET /api/v2/spot/market/candles` | BTCUSDT (no sep) | No |

---

## Per-Exchange Details

### Binance

- **Full URL pattern:** `https://api4.binance.com/api/v3/uiKlines?symbol={symbol}&interval={interval}&limit={limit}&startTime={startMs}`
- **Symbol:** no separator — `BTCUSDT`
- **Time params:** `startTime` in ms; no endTime needed (limit from start)
- **Timeframe values (our map):** `1m` / `15m` / `1h` / `1d`
- **Limit:** 1–1000 candles per request
- **Response:** `[[openTime_ms, open, high, low, close, volume, closeTime_ms, quoteVol, trades, ...], ...]`
- **Notes:** Use `api4.binance.com` (not `api.binance.com`) — more stable for international access
- **API Docs:** https://binance-docs.github.io/apidocs/spot/en/#uiklines

---

### OKX

- **Full URL pattern:** `https://www.okx.com/api/v5/market/history-candles?instId={instId}&bar={bar}&before={beforeMs-1}&after={afterMs+1}&limit={limit}`
- **Symbol:** hyphen — `BTC-USDT`
- **Time params:** `before` (exclusive lower bound, ms), `after` (exclusive upper bound, ms); range is `(before, after)`
- **Timeframe values (our map):** `1m` / `15m` / `1H` / `1Dutc`
- **Limit:** 1–100 candles per request (max 100)
- **Response:** `{"code":"0","data":[["timestamp_ms","open","high","low","close","vol","volCcy","volCcyQuote","confirm"],...]}`
- **Notes:** `1Dutc` for daily UTC-aligned; `history-candles` has deeper history than `candles`
- **API Docs:** https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks-history

---

### Bybit

- **Full URL pattern:** `https://api.bybit.com/v5/market/kline?category=spot&symbol={symbol}&interval={interval}&start={startMs}&limit={limit}`
- **Symbol:** no separator — `BTCUSDT`
- **Time params:** `start` in ms
- **Timeframe values (our map):** `1` / `15` / `60` / `D`
- **Limit:** 1–1000 candles per request (recommended ≤999)
- **Response:** `{"retCode":0,"result":{"list":[["ts_ms","open","high","low","close","vol","turnover"],...]}}` — sorted newest-first
- **Notes:** `retCode === 0` = success; list is reverse-chronological
- **API Docs:** https://bybit-exchange.github.io/docs/v5/market/kline

---

### HTX (Huobi)

- **Full URL pattern:** `https://api.huobi.pro/market/history/kline?symbol={symbol}&period={period}&size={size}`
- **Symbol:** lowercase, no separator — `btcusdt`
- **Time params:** none — returns most recent `size` candles (cannot paginate by time!)
- **Timeframe values (our map):** `1min` / `15min` / `60min` / `1day`
- **Limit (size):** 1–2000 most recent candles
- **Response:** `{"status":"ok","data":[{"id":seconds_ts,"open":...,"close":...,"low":...,"high":...,"amount":baseVol,"vol":quoteVol,"count":trades},...]}`
- **Notes:** No start/end time — only size. `id` is Unix seconds. Use for recent data or D1 snapshots
- **API Docs:** https://huobiapi.github.io/docs/spot/v1/en/#get-klines-candlestick-data

---

### Poloniex

- **Full URL pattern:** `https://api.poloniex.com/markets/{symbol}/candles?interval={interval}&startTime={startMs}&endTime={endMs}&limit={limit}`
- **Symbol:** underscore — `BTC_USDT`
- **Time params:** `startTime` / `endTime` in ms
- **Timeframe values (our map):** `MINUTE_1` / `MINUTE_15` / `HOUR_1` / `DAY_1`
- **Limit:** 1–500 candles per request
- **Response:** `[[low,high,open,close,amount,quantity,buyTakerAmount,buyTakerQuantity,tradeCount,ts,weightedAvg,interval,startTime,closeTime],...]`
- **Notes:** Array format with named fields by index; `startTime` at index 12
- **API Docs:** https://docs.poloniex.com/#public-endpoints-market-data-candles

---

### KuCoin

- **Full URL pattern:** `https://api.kucoin.com/api/v1/market/candles?type={type}&symbol={symbol}&startAt={startSec}&endAt={endSec}`
- **Symbol:** hyphen — `BTC-USDT`
- **Time params:** `startAt` / `endAt` in **Unix seconds** (not ms!)
- **Timeframe values (our map):** `1min` / `15min` / `1hour` / `1day`
- **Limit:** up to ~1500 candles per request (inferred from window size)
- **Response:** `{"code":"200000","data":[["startSec","open","close","high","low","vol","amount"],...]}`
- **Notes:** Code `200000` = success; response array is `[startSec, open, close, high, low, vol, amount]` — note close is index 2, high is index 3, low is index 4
- **API Docs:** https://docs.kucoin.com/#get-klines

---

### Gate.io

- **Full URL pattern:** `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={pair}&interval={interval}&from={fromSec}&to={toSec}`
- **Symbol:** underscore — `BTC_USDT`
- **Time params:** `from` / `to` in **Unix seconds** (not ms!)
- **Timeframe values (our map):** `1m` / `15m` / `1h` / `1d`
- **Limit:** max 999 candles per request (inferred)
- **Response:** `[["sec_ts","quoteVol","close","high","low","open","baseVol"],...]`
- **Notes:** Array format — `[ts_sec, quoteVol, close, high, low, open, baseVol]`; older data may return error "Candlestick too long ago" (max ~9998 candles back)
- **API Docs:** https://www.gate.io/docs/developers/apiv4/#market-candlesticks

---

### MEXC

- **Full URL pattern:** `https://api.mexc.com/api/v3/klines?symbol={symbol}&interval={interval}&startTime={startMs}&endTime={endMs}&limit={limit}`
- **Symbol:** no separator — `BTCUSDT`
- **Time params:** `startTime` / `endTime` in ms
- **Timeframe values (our map):** `1m` / `15m` / `60m` / `1d`
- **Limit:** 1–999 candles per request
- **Response:** `[[openTime_ms,"open","high","low","close","vol",closeTime_ms,"quoteVol"],...]`
- **Notes:** Same structure as Binance v3 klines. `60m` for 1-hour (not `1h`)
- **API Docs:** https://mexcdevelop.github.io/apidocs/spot_v3_en/#kline-candlestick-data

---

### Bitget *(NEW — DEV-0005)*

- **Candles URL (recent ≤90d):** `https://api.bitget.com/api/v2/spot/market/candles?symbol={symbol}&granularity={granularity}&startTime={startMs}&endTime={endMs}&limit={limit}`
- **History URL (>90d ago):** `https://api.bitget.com/api/v2/spot/market/history-candles?symbol={symbol}&granularity={granularity}&startTime={startMs}&endTime={endMs}&limit={limit}`
- **Symbol:** no separator — `BTCUSDT`
- **Time params:** `startTime` / `endTime` in ms; max window = 7 days per request
- **Timeframe values (our map):** `1min` / `5min` / `15min` / `1H` / `4H` / `1D`
- **Limit:** 1–1000 candles per request (default 500)
- **Response:** `{"code":"00000","msg":"success","data":[["ts_ms","open","high","low","close","baseVol","quoteVol"],...]}`
- **Notes:** Code `'00000'` (string) = success; adapter automatically selects `/candles` vs `/history-candles` based on 90-day threshold
- **API Docs:** https://bitgetlimited.github.io/apidoc/en/spot/#get-candlestick-data

---

## Timeframe Mapping Reference

| Our TIMEFRAME | Binance | OKX | Bybit | HTX | Poloniex | KuCoin | Gate.io | MEXC | Bitget |
|---|---|---|---|---|---|---|---|---|---|
| M1 | `1m` | `1m` | `1` | `1min` | `MINUTE_1` | `1min` | `1m` | `1m` | `1min` |
| M5 | — | — | `5` | — | `MINUTE_5` | `5min` | `5m` | `5m` | `5min` |
| M15 | `15m` | `15m` | `15` | `15min` | `MINUTE_15` | `15min` | `15m` | `15m` | `15min` |
| H1 | `1h` | `1H` | `60` | `60min` | `HOUR_1` | `1hour` | `1h` | `60m` | `1H` |
| D1 | `1d` | `1Dutc` | `D` | `1day` | `DAY_1` | `1day` | `1d` | `1d` | `1D` |

---

## Notes for Future Reference

- Always use public (no-auth) candle endpoints; no API keys are needed for historical OHLCV data.
- Pagination strategy: most exchanges use `startTime` + `limit`; OKX uses `before`/`after` (exclusive); HTX only supports `size` (most recent N candles, no start/end).
- When re-auditing: check the `code` / `retCode` field for each exchange to ensure error detection is still correct.
- For exchanges with seconds-based timestamps (KuCoin, Gate.io), always divide/multiply by 1000 when converting to/from JS Date ms.
