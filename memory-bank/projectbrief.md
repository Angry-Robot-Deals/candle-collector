# Project Brief: Candles

## Overview

**candles** (angry/candles) — сервис для загрузки свечей (K-line) с криптобирж и сохранения в PostgreSQL.

- **Версия:** 0.3.0  
- **Автор:** Pavel Valentov  
- **Лицензия:** MIT  
- **Репозиторий:** main branch, актуален с origin  

## Purpose

- Сбор OHLCV-свечей с бирж (Binance, Bybit, Gateio, HTX, Kucoin, Mexc, Okx, Poloniex).
- Хранение в БД: M1, M15, H1, D1, агрегаты и экспорт.
- Расчёт ATH/ATL и квантилей для анализа.
- API для получения свечей, рынков, топ-монет, ATHL.

## Key Deliverables

- NestJS API (порт из `API_PORT`, по умолчанию 14444).
- Prisma + PostgreSQL (модели: Symbol, Exchange, Market, Candle, CandleM15, CandleH1, CandleD1, ATHL, TopCoin, GlobalVar).
- Фоновые задачи: загрузка рынков, свечей M1/M15/H1/D1, расчёт ATHL, обновление топ-монет.
- Docker Compose для запуска (`docker compose -p cc -f docker-compose.yml`).

## Success Criteria

- Сервис поднимается по Docker или `pnpm run start:dev`.
- Конфигурация через `.env` (см. `.env.example`); секреты не коммитятся (репозиторий публичный).
- Memory Bank инициализирован; документация обновлена.
