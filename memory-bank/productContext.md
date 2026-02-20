# Product Context: Candles

## Product Type

Backend-сервис для сбора и хранения рыночных данных криптобирж (свечи, рынки, топ-монеты, ATH/ATL).

## Users / Consumers

- Внутренние системы и аналитика.
- API используется для получения свечей, списков рынков, топ-монет по объёму, ATHL по символам.

## Main Features

1. **Рынки:** загрузка и хранение пар (Symbol/Market) по биржам; API `GET /market`, `GET /market/fetch-all`, `GET /market/fetch/:exchange`.
2. **Свечи:** M1 (Candle), M15 (CandleM15), H1 (CandleH1), D1 (CandleD1); загрузка по биржам и таймфреймам; API `POST /candle/list`, `POST /candle/download`.
3. **Топ-монеты:** обновление из статики (coins-top-500), API `GET /getTopCoins`, `GET /getTopCoinMarkets`, `GET /getTopCoinFirstExchange`, `GET /getTopTradeCoins`, `GET /updateTopCoins`.
4. **ATHL:** расчёт ATH/ATL и квантилей по D1; API `GET /getATHL`, `GET /getATHL/:symbol`.

## Constraints

- Зависимость от API бирж и лимитов (rate limit, задержки).
- Конфигурация бирж через env (DAY_CANDLE_FETCH_EXCHANGES и др.).
