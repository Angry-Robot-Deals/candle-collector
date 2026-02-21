# DEV-0003: fetchTopCoins from CoinMarketCap

## Goal

Replace static top-coins source (JSON file) with live data from [CoinMarketCap](https://coinmarketcap.com/): fetch the page, extract the embedded JSON with coin listings, persist all relevant columns to a new table, and run daily updates when enabled. Ensure the existing `ENABLE_TOP_COIN_FETCH` flow uses this new table for fetching M1 candles for top coins (by volume/turnover).

---

## Current State

- **TopCoin** (Prisma): `id`, `coin`, `name`, `logo`, `price`, `volume24`, `cost24`, `volumeCap`, `costCap`, `createdAt`, `updatedAt`.
- **Source:** `data/coins-top-500.json` — array of `[symbol, name, logo, price, volumeCap, costCap, volume24, cost24]`.
- **updateTopCoins()** in `app.service.ts`: reads that JSON, maps to TopCoin fields, upserts by `coin` (symbol).
- **ENABLE_TOP_COIN_FETCH:** when `true`, runs `fetchTopCoinsM1Candles()` which calls `prisma.getTopCoinFirstExchange()` — returns rows from TopCoin joined with Symbol (`s.name = tc.coin || '/USDT'`), Market, Exchange, ordered by `tc.cost24` desc.
- **getTopCoins()**, **getTopCoinMarkets()**, **getTopTradeCoins()** also rely on TopCoin (e.g. `cost24` for ordering).

---

## CMC Data Format (from page JSON)

Example coin object (subset of fields; full object has more):

```json
{
  "id": 1,
  "name": "Bitcoin",
  "symbol": "BTC",
  "slug": "bitcoin",
  "cmcRank": 1,
  "marketPairCount": 12563,
  "circulatingSupply": 19992743,
  "totalSupply": 19992743,
  "maxSupply": 21000000,
  "ath": 126198.07,
  "atl": 0.04864654,
  "high24h": 68657.69,
  "low24h": 66972.53,
  "isActive": 1,
  "lastUpdated": "2026-02-21T16:53:00.000Z",
  "dateAdded": "2010-07-13T00:00:00.000Z",
  "quotes": [
    { "name": "USD", "price": 68339.56, "volume24h": 29181692588.38, "marketCap": 1366295362815.13, "percentChange24h": 1.02, ... },
    { "name": "BTC", ... },
    { "name": "ETH", ... }
  ],
  "isAudited": false,
  "auditInfoList": [],
  "badges": [1, 5]
}
```

USD quote in `quotes` contains: `price`, `volume24h`, `marketCap`, `percentChange1h`, `percentChange24h`, `percentChange7d`, `lastUpdated`, etc.

---

## Requirements

### 1. Fetch CMC page and extract JSON

- Use HTTP client (e.g. `curl`-style request via `axios`/`fetch`) to load `https://coinmarketcap.com/`.
- Parse HTML and locate the embedded JSON that contains the coin listing (e.g. in a `<script>` tag — exact selector to be determined from page structure).
- Parse the JSON and obtain the array of coin objects in the format above.

### 2. New table for CMC data

- **Create a new table** (e.g. `TopCoinFromCmc` or extend/rename design as appropriate) that stores:
  - CMC `id` (unique, for upsert).
  - Core fields: `symbol`, `name`, `slug`, `cmcRank`, `logo` (if available in JSON or derivable).
  - Supply/market: `circulatingSupply`, `totalSupply`, `maxSupply`, `ath`, `atl`, `high24h`, `low24h`.
  - From USD quote: `price`, `volume24h`, `marketCap`, `percentChange1h`, `percentChange24h`, `percentChange7d`, `lastUpdated` (quote time).
  - Metadata: `dateAdded`, `isActive`, `lastUpdated` (coin-level).
- Persist **all columns** that are needed for ranking and API responses (exact column set to be defined in implementation; prefer storing all useful CMC fields rather than dropping them).
- **Upsert by CMC `id`** (or by symbol if id is not stable): update existing rows, insert new ones on each run.

### 3. Environment variable and daily update

- Add to `.env.example` and code:
  - **`ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`**
- When `ENABLE_UPDATE_TOP_COIN_FROM_CMC` is `true`:
  - Run the “fetch CMC page → parse JSON → upsert into new table” job **once per day** (e.g. scheduled task or cron-style check using `GlobalVar` or similar to remember last run date).
- When `false`, do not run this update job.

### 4. Wire existing “top coins” flow to the new table

- **ENABLE_TOP_COIN_FETCH** already enables `fetchTopCoinsM1Candles()`, which uses `getTopCoinFirstExchange()`.
- **Ensure** that the source for “top coins” (by volume/turnover) is the **new CMC table** (or a view/query that reads from it), not the old static JSON or the old TopCoin populated from it.
- **Verify** that:
  - `getTopCoinFirstExchange()` returns rows from the new table (e.g. join by symbol: `Symbol.name = tc.symbol || '/USDT'`), ordered by the appropriate volume/market-cap field (e.g. `volume24h` or `marketCap` from CMC).
  - `getTopCoins()`, `getTopCoinMarkets()`, `getTopTradeCoins()` (if they should reflect CMC data) use the new table as well.
- Decision: either **migrate TopCoin** to be filled from the new CMC table (and keep existing API contracts) or **introduce the new table** and switch Prisma queries to it; in both cases, **ENABLE_TOP_COIN_FETCH** must pull top coins from the CMC-sourced data.

### 5. Backward compatibility and cleanup

- Document whether `updateTopCoins()` (and static `coins-top-500.json`) are deprecated or still used when CMC update is disabled.
- If TopCoin remains, define whether it is populated from the new CMC table when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true` (so existing APIs keep working) or whether all call sites are switched to the new table only.

---

## Acceptance Criteria

- [ ] CMC page is fetched via HTTP; JSON with coin list is extracted and parsed.
- [ ] New Prisma model and migration: table holds CMC id and all required columns (symbol, name, price, volume24h, marketCap, etc.), upsert by id (or symbol).
- [ ] `ENABLE_UPDATE_TOP_COIN_FROM_CMC` added to `.env.example`; when `true`, CMC update job runs once per day.
- [ ] `getTopCoinFirstExchange()` (and related methods) use the new CMC-backed source; ordering by volume/market cap is correct.
- [ ] With `ENABLE_TOP_COIN_FETCH=true`, `fetchTopCoinsM1Candles()` correctly uses data from the new table (right symbols, exchanges, ordering).

---

## Notes

- CMC may embed the listing in `__NEXT_DATA__`, or in another script tag; implementation must locate the correct script and parse the array of coins.
- Consider rate limiting and User-Agent to avoid blocking when fetching CMC.
- Keep STABLES filter where applicable so stablecoins are excluded from “top coins” for candle fetch.
