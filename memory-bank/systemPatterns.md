# System Patterns: Candles

## Architecture

- **Monolith:** один NestJS-сервис, один процесс.
- **Background jobs:** запуск через `OnApplicationBootstrap` в `AppService` с задержками (setTimeout); циклы M1/M15/H1/D1 и ATHL перезапускают себя по таймеру.
- **State:** глобальные переменные в БД (`GlobalVar`, `GlobalVariablesDBService`) для последних запусков (например, LastFetchAllSymbolD1Candles_*, LastCalculateAllATHL).

## Data Flow

1. Загрузка рынков: ccxt → Symbol/Market (Prisma).
2. Свечи: биржевой API (ccxt или кастомные fetch) → нормализация времени → Candle/CandleM15/CandleH1/CandleD1.
3. ATHL: агрегация CandleD1 → расчёт high/low/quantiles → ATHL.
4. Top coins: статический JSON → TopCoin.

## Conventions

- Символы в виде BASE/QUOTE (например BTC/USDT).
- Таймфреймы: M1, M15, H1, D1 (и при необходимости MN1 для HTX).
- Exchange-адаптеры в `src/exchanges/` с общим контрактом (fetchCandles, findFirstCandle и т.д.).
