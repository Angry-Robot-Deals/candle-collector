# Tasks

## Task ID: DEV-0007

**Title:** Structured logging — split API and APP logs with rotation

**Status:** completed
**Complexity:** Level 2
**Started:** 2026-03-02
**Type:** infrastructure
**Priority:** medium
**Repository:** candles
**Branch:** main

---

### 1. Overview

**Problem:**
- Все логи пишутся в единый `app.log` (110 MB сегодня, 150 MB вчера).
- Смешаны HTTP-запросы, бизнес-логика, ошибки — разбирать крайне сложно.
- Ротация управляется только через `docker-entrypoint` + `logrotate` вне контейнера.

**Цель:**
Разделить на 4 потока с автоматической ротацией внутри NestJS (Winston):

| Файл | Содержимое | Уровень | Ротация |
|------|------------|---------|---------|
| `logs/api-access.log` | HTTP-запросы: method, url, status, ms | INFO | 7 дней / 20 MB |
| `logs/api-error.log` | HTTP 4xx/5xx с body | WARN/ERROR | 14 дней / 20 MB |
| `logs/app-process.log` | NestJS LOG/DEBUG — бизнес-логика | INFO/DEBUG | 7 дней / 50 MB |
| `logs/app-error.log` | NestJS ERROR/WARN — исключения | ERROR/WARN | 14 дней / 20 MB |

**Что НЕ меняем:**
- Существующие `Logger.log/debug/error` вызовы в сервисах.
- Prisma schema / DB.
- Тестовые файлы.

---

### 2. Architecture Impact

**Компоненты:**
- `src/main.ts` — инициализация Winston logger + `app.useLogger()`
- `src/logging/` — новая директория:
  - `winston.config.ts` — конфигурация транспортов
  - `http-access.middleware.ts` — HTTP access/error логгер
- `src/app.module.ts` — регистрация middleware
- `docker-compose.yml` — убрать `tee -a app.log` из command (Winston пишет сам)
- `package.json` — добавить `winston`, `nest-winston`, `winston-daily-rotate-file`

---

### 3. Detailed Design

#### 3.1 Зависимости

```bash
pnpm add winston nest-winston winston-daily-rotate-file
pnpm add -D @types/winston
```

#### 3.2 `src/logging/winston.config.ts`

Два логгера через `createLogger`:
- **appLogger** — транспорты `app-process.log` (INFO/DEBUG) + `app-error.log` (ERROR/WARN)
- **apiLogger** — транспорты `api-access.log` + `api-error.log`

Общий формат: `timestamp | level | context | message`

Ротация (`winston-daily-rotate-file`):
- `datePattern: 'YYYY-MM-DD'` — ежедневно
- `maxSize: '50m'` для process, `'20m'` для остальных
- `maxFiles: '7d'` / `'14d'` для error-логов
- `zippedArchive: true`

#### 3.3 `src/logging/http-access.middleware.ts`

NestJS `NestMiddleware` + `express` — перехватывает каждый запрос:
- **access**: `{method, url, statusCode, responseTime, userAgent, ip}` → `api-access.log`
- **error** (status ≥ 400): то же + `responseBody` (обрезан до 500 символов) → `api-error.log`

Использует override `res.end()` для захвата статус-кода ПОСЛЕ отправки ответа.

#### 3.4 `src/app.module.ts`

```typescript
implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpAccessMiddleware).forRoutes('*');
  }
}
```

#### 3.5 `src/main.ts`

```typescript
import { WinstonModule } from 'nest-winston';
import { appWinstonConfig } from './logging/winston.config';

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger(appWinstonConfig),
});
```

#### 3.6 `docker-compose.yml`

**Было:**
```yaml
command: ["sh", "-c", "mkdir -p /usr/app/logs && exec node dist/src/main 2>&1 | tee -a /usr/app/logs/app.log"]
```

**Станет:**
```yaml
command: ["node", "dist/src/main"]
```

Логи пишет Winston напрямую в `/usr/app/logs/`.

---

### 4. Implementation Steps

#### Step 1 — Зависимости
- Добавить `winston`, `nest-winston`, `winston-daily-rotate-file` в `package.json`

#### Step 2 — `src/logging/winston.config.ts`
- Создать конфигурацию 4 транспортов
- Экспортировать `appWinstonConfig` (для NestJS) и `apiLogger` (для middleware)

#### Step 3 — `src/logging/http-access.middleware.ts`
- Создать middleware с логированием access/error в `apiLogger`

#### Step 4 — `src/app.module.ts`
- Добавить `implements NestModule` + `configure()` с регистрацией middleware

#### Step 5 — `src/main.ts`
- Заменить стандартный логгер на `WinstonModule.createLogger()`

#### Step 6 — `docker-compose.yml`
- Убрать `tee -a app.log` — Winston пишет сам

#### Step 7 — Build, deploy, verify
- `pnpm build` — убедиться что компилируется
- Deploy: `git pull && docker compose -p cc build candles && docker compose -p cc restart candles`
- Проверить что все 4 файла появились в `logs/`
- Вызвать endpoints:
  - `GET /` → должно попасть в `api-access.log`
  - `GET /exchange` → `api-access.log`
  - `GET /nonexistent` → `api-error.log` (404)
  - Посмотреть `app-process.log` и `app-error.log`

---

### 5. Validation Checklist

- [ ] `pnpm build` проходит без ошибок
- [ ] `pnpm test` — 95/95 тестов проходят
- [ ] После деплоя появились все 4 log-файла в `logs/`
- [ ] `api-access.log` — содержит HTTP GET запросы
- [ ] `api-error.log` — содержит 404 ответ на несуществующий endpoint
- [ ] `app-process.log` — содержит NestJS LOG строки (fetch cycles)
- [ ] `app-error.log` — содержит ERROR строки (exchange errors)
- [ ] `docker-compose.yml` не использует `tee app.log`
- [ ] Ротация настроена (проверить конфигурацию в `winston.config.ts`)

---

## Task ID: DEV-0006

**Title:** Candle fetch order: Market status machine + archive-first strategy

**Status:** completed
**Complexity:** Level 3
**Started:** 2026-03-02
**Type:** feature / refactor
**Priority:** high
**Repository:** candles
**Branch:** main

---

### 1. Overview

**Problem:** Текущая логика поиска первой свечи (`FindFirstCandle`) сканирует историю с очень далёкого прошлого (`getStartFetchTime()`) вперёд, итерируя батч за батчем пока не появятся данные. Это медленно (могут быть сотни итераций) и неэффективно — для новых маркетов первая свеча может быть совсем недавно, а для делистинговых мы это не знаем заранее.

**Новый подход:**
1. Добавить три поля в `Market`: `candleFirstTime`, `candleLastTime`, `candleUpdateStatus`.
2. Реализовать конечный автомат (state machine) на основе `candleUpdateStatus`:
   - **0 (pending)** — начинаем с запроса ПОСЛЕДНИХ свечей (ближайших к текущему моменту). По результату первого батча определяем статус маркета.
   - **2 (find first fringe)** — маркет активен, ищем архивное начало, двигаясь назад от `candleFirstTime`.
   - **4 (process)** — штатный режим: получаем только новые свечи.
   - **-100 (disabled)** — биржа перестала предоставлять свечи по этому символу (последняя свеча не совпадает с текущим таймфреймом).
   - **-200 (paused)** — приостановлено вручную пользователем.
   - **-404 (not-found)** — биржа не знает этот символ (первый батч пуст).
   - **< 0** — любой отрицательный статус: пропускаем маркет.

---

### 2. Решения по открытым вопросам

| # | Вопрос | Решение |
|---|--------|---------|
| Q1 | Таймфрейм привязки | Отдельная модель `CandleUpdateStatus` с полем `tf` (timeframe в минутах). Модель `Market` не меняем. |
| Q2 | Тип timestamp | `Int` (Unix-секунды), достаточно до 2038 г. |
| Q3 | Обновление `candleLastTime` в status=4 | Да, обновлять при каждом батче. |
| Q4 | Ошибка запроса | Не менять `candleUpdateStatus`, повторить в следующей итерации. |
| Q5 | Старые `FindFirstCandle` | Оставить, почистить при будущем рефакторинге. |
| Q6 | Статус -200 (paused) | Добавить API endpoint для паузы/возобновления. |
| Q7 | Унификация "fetch last candles" | Разработать и применить единый интерфейс по всем 9 биржам. Полное тестовое покрытие. |
| Q8 | "Свеча текущего таймфрейма" | `getCandleTime(timeframe, candle.time) === getCandleTime(timeframe)` |

---

### 3. Schema Changes — новая модель

Вместо изменения `Market` создаём новую модель:

```prisma
model CandleUpdateStatus {
  id               Int      @id @default(autoincrement())
  marketId         Int
  tf               Int      // timeframe in minutes (e.g. 1, 15, 60, 1440)
  symbolId         Int
  exchangeId       Int
  candleFirstTime  Int?     // Unix timestamp (seconds), aligned to tf
  candleLastTime   Int?     // Unix timestamp (seconds), aligned to tf
  status           Int      @default(0)

  market   Market   @relation(fields: [marketId], references: [id])
  exchange Exchange @relation(fields: [exchangeId], references: [id])
  symbol   Symbol   @relation(fields: [symbolId], references: [id])

  @@unique([marketId, tf])
  @@index([exchangeId, tf, status])
  @@index([symbolId, exchangeId, tf])
}
```

Реляция в `Market`:
```prisma
CandleUpdateStatus CandleUpdateStatus[]
```

Нужна Prisma-миграция: `add_candle_update_status`.

---

### 4. Статусы (CandleUpdateStatus.status)

| Значение | Название | Описание |
|----------|----------|----------|
| `0` | pending | Ожидает первичной проверки |
| `2` | find_first_fringe | Маркет активен, ищем архивную границу назад |
| `4` | process | Штатный режим: только новые свечи |
| `-100` | disabled | Биржа больше не даёт свечи по символу |
| `-200` | paused | Приостановлено пользователем через API |
| `-404` | not_found | Символ не найден на бирже (первый батч пуст) |

---

### 5. State Machine — переходы

```
0 (pending) — запрашиваем последние limit свечей
  ├─ батч пуст                             → -404 (not-found)
  ├─ батч непуст, нет текущей свечи        → -100 (disabled)
  │                                           candleLastTime = max(batch times)
  └─ батч непуст, есть текущая свеча       → 2 (find_first_fringe)
                                              candleLastTime = getCandleTime(tf)
                                              candleFirstTime = min(batch times)
                                              [сохраняем свечи]

2 (find_first_fringe) — батч от [candleFirstTime - limit*tfSec, candleFirstTime)
  ├─ батч < limit или пуст                 → 4 (process)
  │                                           candleFirstTime = min(current, batch min)
  └─ батч = limit                          → остаёмся в 2
                                              candleFirstTime = min(current, batch min)
  [сохраняем свечи в обоих случаях]

4 (process) — стандартное получение новых свечей
  └─ после батча                           → остаёмся в 4
                                              candleLastTime = max(batch times)

< 0 → пропускаем маркет (запросов не делаем)

Ошибка запроса (любой статус) → статус не меняем, повторяем в следующей итерации
```

---

### 6. Unified "fetch last candles" Interface

Единая функция для получения последних N свечей по всем биржам (для status=0):

```typescript
// src/exchange-fetch-last-candles.ts
export async function fetchLastCandles(params: {
  exchange: string;    // exchange name
  synonym: string;     // market synonym on the exchange
  timeframe: TIMEFRAME;
  limit: number;       // number of candles to fetch
}): Promise<CandleDb[] | string>
```

Реализуется как диспетчер по `exchange`, вызывает адаптер каждой биржи.
Каждый адаптер запрашивает последние `limit` свечей до `getCandleTime(timeframe)`.

Биржи: Binance, OKX, KuCoin, HTX, Poloniex, Gate.io, MEXC, Bitget, Bybit — **все 9**.
Тесты: полное покрытие по каждой бирже (unit + mock HTTP).

---

### 7. Affected Components

| Файл | Изменения |
|------|-----------|
| `prisma/schema.prisma` | Новая модель `CandleUpdateStatus`; relation в `Market`, `Exchange`, `Symbol` |
| `prisma/migrations/` | `add_candle_update_status` |
| `src/exchange-fetch-last-candles.ts` | **новый файл** — единый `fetchLastCandles` для всех 9 бирж |
| `src/exchange-fetch-last-candles.spec.ts` | **новый файл** — полное тестовое покрытие |
| `src/prisma.service.ts` | Методы: `getCandleUpdateStatus`, `upsertCandleUpdateStatus`, `updateCandleStatusFields` |
| `src/app.service.ts` | Ветвление по `status` перед `fetchCandles` в каждом цикле (M1, M15, H1, D1) |
| `src/app.controller.ts` | Новый endpoint: `PATCH /market/:marketId/candle-status/:tf/pause` и `/resume` |
| `src/exchanges/*.ts` | `FindFirstCandle`-функции **оставляем** (рефакторинг позже) |

---

### 8. API Endpoint — Pause / Resume

```
PATCH /market/:marketId/candle-status/:tf/pause
PATCH /market/:marketId/candle-status/:tf/resume
```

- `pause` → устанавливает `status = -200`
- `resume` → устанавливает `status = 0` (возврат в pending для переопределения)
- Параметры: `marketId: number`, `tf: number` (минуты: 1, 15, 60, 1440)

---

### 9. Algorithm Details

#### Status = 0: определение актуальности маркета

```
1. candles = await fetchLastCandles({ exchange, synonym, timeframe, limit })
2. if error(candles) → skip (повторим в следующей итерации)
3. if candles.length === 0 → status = -404, save, skip
4. hasCurrentCandle = candles.some(c => getCandleTime(tf, c.time) === getCandleTime(tf))
5. if !hasCurrentCandle:
     status = -100
     candleLastTime = max(candles, c.time) in seconds, aligned to tf
     save, skip
6. if hasCurrentCandle:
     status = 2
     candleLastTime = getCandleTime(tf) in seconds
     candleFirstTime = min(candles, c.time) in seconds, aligned to tf
     save candles to DB (как обычно)
     save status
```

#### Status = 2: поиск архивной границы

```
1. endTime = candleFirstTime (seconds) → ms для запроса
   startTime = endTime - limit * tfSeconds
2. candles = await fetchCandles({ ..., start: startTime, end: endTime, limit })
3. if error(candles) → skip
4. if candles.length > 0:
     newFirstTime = min(candles, c.time) in seconds, aligned to tf
     candleFirstTime = min(candleFirstTime, newFirstTime)
     save candles to DB
5. if candles.length < limit:
     status = 4
6. save CandleUpdateStatus (candleFirstTime + status)
```

#### Status = 4: штатное получение новых свечей

```
1. Поведение как сейчас (от последней свечи в DB до now)
2. После успешного батча: candleLastTime = max(batch times), save
```

#### Status < 0: пропуск

```
continue // никаких запросов
```

---

### 10. Success Criteria

- [ ] Модель `CandleUpdateStatus` добавлена, миграция применена.
- [ ] `fetchLastCandles` реализован для всех 9 бирж с полным тестовым покрытием.
- [ ] Status=0: первый батч → правильный переход (2, -100, -404).
- [ ] Status=2: архив собирается назад, `candleFirstTime` обновляется; при неполном батче → status=4.
- [ ] Status=4: штатная работа + обновление `candleLastTime`.
- [ ] Status<0: маркет пропускается, запросов нет.
- [ ] Ошибка запроса: статус не меняется, следующая итерация.
- [ ] API endpoints `pause`/`resume` работают.
- [ ] Нет регрессий по всем 9 биржам.

---

## DEV-0006 Implementation Plan

### 1. Overview

**Problem:** `FindFirstCandle`-функции сканируют с `getStartFetchTime()` вперёд — сотни батч-итераций на каждый новый маркет. Неприемлемо медленно для нарастающего числа торговых пар.

**Goals:**
1. Новая таблица `CandleUpdateStatus` (marketId + tf) как персистентный конечный автомат.
2. Единая функция `fetchLastCandles` — запрос последних N свечей по всем 9 биржам.
3. Интегрировать state machine в 4 цикла: M1, M15, H1, D1.
4. API endpoint для ручной паузы/возобновления маркета.

**Success criteria:** Новые маркеты получают статус за 1–2 батча; делистинговые — помечаются -100 или -404; архив собирается назад без блокировки основного цикла.

---

### 2. Security Summary

- **Attack surface:** Unchanged (no new public APIs beyond pause/resume; no user data).
- **New permissions:** None. `PATCH /market/...` — internal operation, no auth change.
- **Sensitive data:** No PII. Only integer timestamps and status codes.
- **Risks:** (1) Race condition: статус пишется между двумя итерациями — mitigate через Prisma `upsert`. (2) Некорректный `marketId`/`tf` в pause endpoint — mitigate через валидацию и 404-ответ.

---

### 3. Architecture Impact

- **Components:** `prisma/schema.prisma`, `prisma/migrations/`, `src/prisma.service.ts`, `src/app.service.ts`, `src/app.controller.ts`, новый `src/exchange-fetch-last-candles.ts` + `.spec.ts`.
- **Integration:** Все 4 цикла (`fetchExchangeAllSymbol*Candles`) читают `CandleUpdateStatus` перед вызовом `fetchCandles`. `fetchLastCandles` используется только в status=0. Для status=2 вызывается существующий `fetchCandles` с явными `start`/`end`.

---

### 4. Detailed Design

#### 4.1 Component Changes

| Файл | Изменения | Причина |
|------|-----------|---------|
| `prisma/schema.prisma` | Новая модель `CandleUpdateStatus`; добавить relation в `Market`, `Exchange`, `Symbol` | Персистентный статус per market+tf |
| `src/prisma.service.ts` | 3 новых метода: `getCandleUpdateStatus`, `upsertCandleUpdateStatus`, `updateCandleStatusFields` | Инкапсуляция CRUD статуса |
| `src/app.service.ts` | В каждом цикле: добавить `id: true` в `market.findMany`, добавить state machine перед `fetchCandles` | Интеграция автомата |
| `src/app.controller.ts` | Два `@Patch` endpoints: `pause` и `resume` | Ручное управление |

#### 4.2 New Components

| Файл | Назначение | Зависимости |
|------|-----------|-------------|
| `src/exchange-fetch-last-candles.ts` | Диспетчер `fetchLastCandles` + 9 per-exchange функций | `fetchJsonSafe`, `getCandleTime`, timeframe constants |
| `src/exchange-fetch-last-candles.spec.ts` | Unit-тесты с mock для всех 9 бирж + диспетчера | Jest, `fetchJsonSafe` mock |
| `prisma/migrations/YYYYMMDD_add_candle_update_status/` | Миграция новой таблицы | Prisma |

#### 4.3 API Changes

```
PATCH /market/:marketId/candle-status/:tf/pause
  Params: marketId: number, tf: number (1 | 15 | 60 | 1440)
  Response: { ok: boolean, status: -200 }
  Effect: CandleUpdateStatus.status = -200

PATCH /market/:marketId/candle-status/:tf/resume
  Params: marketId: number, tf: number
  Response: { ok: boolean, status: 0 }
  Effect: CandleUpdateStatus.status = 0 (возврат в pending)
```

Валидация: `marketId` должен существовать в `Market`; `tf` в допустимых значениях (1, 15, 60, 1440, 10080, 43200).

#### 4.4 Database Changes

**Новая таблица `CandleUpdateStatus`:**

```prisma
model CandleUpdateStatus {
  id               Int      @id @default(autoincrement())
  marketId         Int
  tf               Int      // timeframe minutes: 1, 15, 60, 1440, ...
  symbolId         Int
  exchangeId       Int
  candleFirstTime  Int?     // Unix seconds, tf-aligned; oldest known candle
  candleLastTime   Int?     // Unix seconds, tf-aligned; newest known candle
  status           Int      @default(0)
  // 0=pending, 2=find_first_fringe, 4=process, -100=disabled, -200=paused, -404=not_found

  market   Market   @relation(fields: [marketId], references: [id])
  exchange Exchange @relation(fields: [exchangeId], references: [id])
  symbol   Symbol   @relation(fields: [symbolId], references: [id])

  @@unique([marketId, tf])
  @@index([exchangeId, tf, status])
  @@index([symbolId, exchangeId, tf])
}
```

**Изменения в существующих моделях:**
```prisma
model Market {
  // ... existing fields ...
  CandleUpdateStatus CandleUpdateStatus[]
}
model Exchange {
  // ... existing fields ...
  CandleUpdateStatus CandleUpdateStatus[]
}
model Symbol {
  // ... existing fields ...
  CandleUpdateStatus CandleUpdateStatus[]
}
```

---

### 5. Security Design (Appendix A)

#### 5.1 Threat Model

- **Assets:** Целостность статуса маркета; доступность цикла свечей.
- **Threats:** Ввод некорректного `marketId`/`tf` в pause endpoint; гонка при конкурентной записи статуса.
- **Mitigations:** Prisma `upsert` — атомарен; валидация параметров на уровне контроллера; `@@unique([marketId, tf])` исключает дубликаты.

#### 5.2 Security Controls Checklist

- [x] Input validation: `marketId` и `tf` — числа; `tf` в whitelist допустимых значений.
- [x] No SQL concatenation: Prisma ORM.
- [x] No secrets: Нет новых env-переменных.
- [x] Access control: Endpoint — без изменений в auth (внутренний инструмент).
- [x] Infrastructure: Нет новых привилегий.

---

### 6. Implementation Steps

#### Step 1: Prisma schema — новая модель + relations

**Files:** `prisma/schema.prisma`

Добавить в схему модель `CandleUpdateStatus` и поле `CandleUpdateStatus CandleUpdateStatus[]` в `Market`, `Exchange`, `Symbol`.

```prisma
model CandleUpdateStatus {
  id               Int      @id @default(autoincrement())
  marketId         Int
  tf               Int
  symbolId         Int
  exchangeId       Int
  candleFirstTime  Int?
  candleLastTime   Int?
  status           Int      @default(0)

  market   Market   @relation(fields: [marketId], references: [id])
  exchange Exchange @relation(fields: [exchangeId], references: [id])
  symbol   Symbol   @relation(fields: [symbolId], references: [id])

  @@unique([marketId, tf])
  @@index([exchangeId, tf, status])
  @@index([symbolId, exchangeId, tf])
}
```

Запустить: `pnpm exec prisma migrate dev --name add_candle_update_status`

**Rationale:** Schema-first; остальные шаги зависят от типов Prisma Client.

---

#### Step 2: `src/exchange-fetch-last-candles.ts` — unified interface

**File:** `src/exchange-fetch-last-candles.ts` (новый)

Единая функция-диспетчер + 9 per-exchange функций. Каждая запрашивает последние `limit` свечей, заканчивающихся не позже `getCandleTime(timeframe)`.

```typescript
export interface FetchLastCandlesParams {
  exchange: string;
  synonym: string;
  timeframe: TIMEFRAME;
  limit: number;
}

export async function fetchLastCandles(
  params: FetchLastCandlesParams,
): Promise<CandleDb[] | string> {
  switch (params.exchange) {
    case 'binance':  return binanceFetchLastCandles(params);
    case 'okx':      return okxFetchLastCandles(params);
    case 'kucoin':   return kucoinFetchLastCandles(params);
    case 'htx':      return htxFetchLastCandles(params);
    case 'poloniex': return poloniexFetchLastCandles(params);
    case 'gateio':   return gateioFetchLastCandles(params);
    case 'mexc':     return mexcFetchLastCandles(params);
    case 'bitget':   return bitgetFetchLastCandles(params);
    case 'bybit':    return bybitFetchLastCandles(params);
    default:         return `Unknown exchange: ${params.exchange}`;
  }
}
```

**Per-exchange стратегии** (все используют `end = getCandleTime(timeframe)`):

| Exchange | Метод |
|----------|-------|
| **binance** | `startTime = end - limit*tfMs` → `GET /api/v3/uiKlines?symbol=X&interval=TF&limit=N&startTime=S` |
| **okx** | OKX newest-first: `GET /history-candles?instId=X&bar=TF&limit=N` (без before/after → последние N) |
| **kucoin** | `start = (end - limit*tfMs) / 1000` (seconds), `end = end/1000` → existing `kucoinFetchCandles` |
| **htx** | `GET /market/history/kline?symbol=X&period=TF&size=N` — HTX всегда отдаёт последние N |
| **poloniex** | `startTime = end - limit*tfMs`, `endTime = end`, `limit=N` → existing |
| **gateio** | `from = (end - limit*tfMs)/1000` (seconds), `to = end/1000` → existing |
| **mexc** | `start = end - limit*tfMs`, `end = end + tfMs`, `limit=N` → existing |
| **bitget** | `endTime = end + tfMs`, `limit=N` → existing |
| **bybit** | `start = end - limit*tfMs`, `limit=N` → existing |

**Rationale:** Изолированный модуль — тестируется отдельно без зависимостей от AppService.

---

#### Step 3: `src/exchange-fetch-last-candles.spec.ts` — полное тестовое покрытие

**File:** `src/exchange-fetch-last-candles.spec.ts` (новый)

Тесты: 9 per-exchange функций + диспетчер `fetchLastCandles`. Для каждой биржи:
- Mock `fetchJsonSafe` (или `fetch`) с валидными данными → проверяем возврат `CandleDb[]`.
- Mock с пустым массивом → возвращает `[]`.
- Mock с ошибкой → возвращает строку.
- Диспетчер с неизвестной биржей → возвращает строку-ошибку.

```typescript
describe('fetchLastCandles', () => {
  describe('binance', () => {
    it('returns CandleDb[] on success', async () => { ... });
    it('returns [] on empty response', async () => { ... });
    it('returns error string on fetch error', async () => { ... });
  });
  // ... остальные 8 бирж ...
  describe('dispatcher', () => {
    it('routes to correct exchange', async () => { ... });
    it('returns error for unknown exchange', async () => { ... });
  });
});
```

**Rationale:** Тесты до интеграции предотвращают регрессии при изменении адаптеров.

---

#### Step 4: `src/prisma.service.ts` — методы для CandleUpdateStatus

**File:** `src/prisma.service.ts`

Три метода:

```typescript
/** Find status record for a market+tf. Returns null if not exists. */
async getCandleUpdateStatus(
  marketId: number,
  tf: number,
): Promise<CandleUpdateStatusModel | null> {
  return this.candleUpdateStatus.findUnique({
    where: { marketId_tf: { marketId, tf } },
  });
}

/** Upsert the status record (creates if not exists). */
async upsertCandleUpdateStatus(data: {
  marketId: number;
  tf: number;
  symbolId: number;
  exchangeId: number;
  status: number;
  candleFirstTime?: number | null;
  candleLastTime?: number | null;
}): Promise<void> {
  const { marketId, tf, symbolId, exchangeId, status, candleFirstTime, candleLastTime } = data;
  await this.candleUpdateStatus.upsert({
    where: { marketId_tf: { marketId, tf } },
    create: { marketId, tf, symbolId, exchangeId, status, candleFirstTime, candleLastTime },
    update: { status, candleFirstTime, candleLastTime },
  });
}

/** Update only specified fields (partial update). */
async updateCandleStatusFields(
  marketId: number,
  tf: number,
  fields: { status?: number; candleFirstTime?: number | null; candleLastTime?: number | null },
): Promise<void> {
  await this.candleUpdateStatus.updateMany({
    where: { marketId, tf },
    data: fields,
  });
}
```

**Rationale:** Инкапсуляция — `app.service.ts` не работает с Prisma напрямую для этой таблицы.

---

#### Step 5: `src/app.service.ts` — state machine в циклах

**File:** `src/app.service.ts`

**5a. Вспомогательная функция `processCandleStateMachine`**

Выделить логику автомата в приватный метод (≤50 строк), вызываемый из всех 4 циклов:

```typescript
private async processCandleStateMachine(params: {
  market: { id: number; symbolId: number; synonym: string; symbol: { name: string } };
  exchange: { id: number; name: string };
  timeframe: TIMEFRAME;
  tfMinutes: number;
  limit: number;
  saveFn: (candles: CandleDb[]) => Promise<{ count?: number }>;
}): Promise<void>
```

Логика (псевдокод):

```
1. statusRec = await prisma.getCandleUpdateStatus(market.id, tfMinutes)
2. if !statusRec: create with status=0
3. status = statusRec?.status ?? 0

4. if status < 0: return  // skip

5. if status === 0:
     candles = await fetchLastCandles({ exchange.name, synonym, timeframe, limit })
     if typeof candles === 'string': return  // error, retry next iter
     if candles.length === 0:
       await prisma.upsertCandleUpdateStatus({ ..., status: -404 })
       return
     now = getCandleTime(timeframe)
     hasCurrent = candles.some(c => getCandleTime(timeframe, c.time) === now)
     if !hasCurrent:
       lastTime = Math.max(...candles.map(c => c.time.getTime())) / 1000
       await prisma.upsertCandleUpdateStatus({ ..., status: -100, candleLastTime: lastTime })
       return
     await saveFn(candles)
     firstTime = Math.min(...candles.map(c => c.time.getTime())) / 1000
     await prisma.upsertCandleUpdateStatus({ ..., status: 2, candleFirstTime: firstTime, candleLastTime: now/1000 })
     return

6. if status === 2:
     tfMs = timeframeMSeconds(timeframe)
     endMs = (statusRec.candleFirstTime ?? 0) * 1000
     startMs = endMs - limit * tfMs
     candles = await this.fetchCandles({ ..., start: startMs, limit })
     if typeof candles === 'string': return  // error
     newFirstTime = statusRec.candleFirstTime
     if candles.length > 0:
       batchMin = Math.min(...candles.map(c => c.time.getTime())) / 1000
       newFirstTime = Math.min(newFirstTime ?? batchMin, batchMin)
       await saveFn(candles)
     newStatus = candles.length < limit ? 4 : 2
     await prisma.updateCandleStatusFields(market.id, tfMinutes, { status: newStatus, candleFirstTime: newFirstTime })
     return

7. if status === 4:
     candles = await this.fetchCandles({ ... })  // existing behavior
     if typeof candles === 'string': return
     if candles.length > 0:
       await saveFn(candles)
       lastTime = Math.max(...candles.map(c => c.time.getTime())) / 1000
       await prisma.updateCandleStatusFields(market.id, tfMinutes, { candleLastTime: lastTime })
```

**5b. Обновить `findMany` в каждом цикле** — добавить `id: true` в `select`:

```typescript
const markets = await this.prisma.market.findMany({
  select: {
    id: true,        // добавить
    symbol: true,
    symbolId: true,
    synonym: true,
  },
  ...
});
```

**5c. Заменить вызов `fetchCandles` в каждом цикле** на `processCandleStateMachine`:

```typescript
// БЫЛО:
const candles = await this.fetchCandles({ exchange: exchange.name, ... });
if (typeof candles === 'string') { ... }
const saved = await this.saveExchangeCandlesM15({ ... });

// СТАЛО:
await this.processCandleStateMachine({
  market, exchange,
  timeframe: TIMEFRAME.M15,
  tfMinutes: timeframeMinutes(TIMEFRAME.M15),
  limit: 500,
  saveFn: (candles) => this.saveExchangeCandlesM15({ exchangeId: exchange.id, symbolId: market.symbolId, candles }),
});
```

Циклы: `fetchExchangeAllSymbolM15Candles`, `fetchExchangeAllSymbolH1Candles`, `fetchExchangeAllSymbolD1Candles`, `fetchTopCoinsM1Candles` (или аналогичный M1 цикл).

**Rationale:** Один метод вместо дублирования логики в 4 циклах.

---

#### Step 6: `src/app.controller.ts` — pause/resume endpoints

**File:** `src/app.controller.ts`

```typescript
import { Body, Controller, Get, Param, Patch, ... } from '@nestjs/common';

const VALID_TF = [1, 15, 60, 1440, 10080, 43200];

@Patch('market/:marketId/candle-status/:tf/pause')
async pauseCandleStatus(
  @Param('marketId') marketId: string,
  @Param('tf') tf: string,
): Promise<{ ok: boolean; status: number }> {
  const mId = parseInt(marketId, 10);
  const tfMin = parseInt(tf, 10);
  if (isNaN(mId) || isNaN(tfMin) || !VALID_TF.includes(tfMin)) {
    throw new BadRequestException('Invalid marketId or tf');
  }
  const market = await this.prisma.market.findUnique({ where: { id: mId } });
  if (!market) throw new NotFoundException(`Market ${mId} not found`);

  await this.prisma.updateCandleStatusFields(mId, tfMin, { status: -200 });
  return { ok: true, status: -200 };
}

@Patch('market/:marketId/candle-status/:tf/resume')
async resumeCandleStatus(
  @Param('marketId') marketId: string,
  @Param('tf') tf: string,
): Promise<{ ok: boolean; status: number }> {
  // same validation
  await this.prisma.updateCandleStatusFields(mId, tfMin, { status: 0 });
  return { ok: true, status: 0 };
}
```

**Rationale:** Простой управляющий API без изменения auth.

---

### 7. Test Plan

- **Unit — `exchange-fetch-last-candles.spec.ts`:**
  - 9 бирж × 3 сценария (success, empty, error) = 27 тестов
  - Диспетчер: known exchange → delegates, unknown → error string
  - Итого: ~30 тестов

- **Unit — `prisma.service.spec.ts` (дополнение):**
  - `getCandleUpdateStatus`: found, not found
  - `upsertCandleUpdateStatus`: create, update
  - `updateCandleStatusFields`: partial update

- **Integration — `app.service.ts` (ручное/E2E):**
  - Маркет с status=0, первый батч пуст → проверить status=-404 в БД
  - Маркет с status=0, есть текущая свеча → проверить status=2, candleFirstTime/LastTime
  - Маркет с status=2, батч < limit → проверить status=4
  - Маркет с status<0 → нет запросов к бирже
  - Ошибка запроса → статус не меняется

- **Security:**
  - PATCH с некорректным tf → 400
  - PATCH с несуществующим marketId → 404

---

### 8. Rollback Strategy

```bash
# Откат кода
git revert <commit>

# Откат миграции (если нужно)
pnpm exec prisma migrate resolve --rolled-back add_candle_update_status
# Затем вручную:
# DROP TABLE "CandleUpdateStatus";
```

Существующие `FindFirstCandle`-функции не удаляются → `fetchCandles` работает как прежде после отката.

---

### 9. Validation Checklist

- [ ] Step 1: Migration applied; `CandleUpdateStatus` таблица существует.
- [ ] Step 2: `fetchLastCandles` реализован для всех 9 бирж; вручную проверены URL-запросы.
- [ ] Step 3: Все тесты `exchange-fetch-last-candles.spec.ts` зелёные.
- [ ] Step 4: Методы `prisma.service.ts` работают (unit tests).
- [ ] Step 5: state machine вызывается в каждом из 4 циклов; market select включает `id`.
- [ ] Step 6: Endpoints `pause`/`resume` возвращают корректные статусы; невалидные параметры → 400/404.
- [ ] Регрессии: все существующие биржи продолжают получать свечи (наблюдение за логами).
- [ ] Производительность: новые маркеты определяются за 1–2 батча вместо сотен.
- [ ] `pnpm run build` без ошибок TypeScript.
- [ ] `pnpm test` — все тесты зелёные.

---

### 10. Next Steps

- Переходим к `/do` (BUILD) — реализация по шагам 1–6.
- Порядок реализации строго по шагам: schema → fetchLastCandles+tests → prisma methods → state machine → controller.
- После deploy: наблюдение за логами на статусы -404, -100, переходы 0→2→4.

---

## Task ID: DEV-0005

**Title:** Add Bitget exchange — candle fetching, API docs audit, full test coverage, deploy

**Status:** archived  
**Complexity:** Level 3  
**Started:** 2026-02-25  
**Completed:** 2026-02-25  
**Type:** feature + quality  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Reflection:** memory-bank/reflection/reflection-DEV-0005.md  
**Archive:** memory-bank/archive/archive-DEV-0005.md  

### Summary

Full integration of Bitget exchange: adapter (bitget.ts, bitget.interface.ts), wiring in app.service.ts, exchange-api-reference.md for all 9 exchanges, adapter audit, full test coverage (Bitget/KuCoin/Gate.io/MEXC + PrismaService). Post-deploy fixes: return→continue in D1/H1/M15 loops, history-candles limit 200, granularity 1h/1day. Production 23.88.34.218 green; Bitget candles saved.

---

## Task ID: DEV-0004

**Title:** Migrate feeder and API to DB server (Docker, open port; DB local)

**Status:** archived  
**Complexity:** Level 2  
**Started:** 2026-02-24  
**Completed:** 2026-02-25  
**Type:** infrastructure / migration  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Reflection:** memory-bank/reflection/reflection-DEV-0004.md  
**Archive:** memory-bank/archive/archive-DEV-0004.md  

### Summary

- **Target server (new):** `ssh root@23.88.34.218` — API + feeder in Docker, port open; DB on same host (local).
- **Source server (current):** `ssh -i ~/.ssh/id_ed25519 root@37.27.107.227` — app runs here now.
- **Pre-migration:** On the *current* server: stop the application, then remove Docker (containers, images, optionally Docker itself).

### Goals

1. **Pre-migration (current server 37.27.107.227)**  
   - Stop the candle-collector service (e.g. `scripts/external-app-down.sh` or manual `docker compose down`).  
   - Remove Docker: tear down containers/images and, if desired, uninstall Docker on that host.

2. **Migration to DB server (23.88.34.218)**  
   - Deploy the same app (feeder + API) to the new server via Docker.  
   - Open the API port (e.g. 14444) on the new server.  
   - Configure the app to use the DB **locally** on the same server (e.g. `DATABASE_URL` pointing to localhost or the same host).

3. **Documentation / automation**  
   - Update deploy scripts and docs so that future deploys target the new server (e.g. `APP_SERVER_USER=root@23.88.34.218`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519` or another key).  
   - If the new server needs GitHub access for `git pull`: document or configure SSH key (or HTTPS); inform if keys need to be set up.

### Success criteria

- Current server (37.27.107.227): app stopped, Docker removed as specified.  
- New server (23.88.34.218): app (API + feeder) runs in Docker, port 14444 (or chosen port) open and reachable; DB connection uses local DB on the same server.  
- Deploy script and env (e.g. `.env.example` / docs) point to the new server; optional: note about GitHub keys on the new host.

### Notes

- **GitHub keys:** If the new server will run `git pull` (e.g. from `scripts/external-deploy.sh`), it needs either: (1) SSH key added to GitHub (deploy key or user key), or (2) HTTPS with token. If keys are not yet set up on 23.88.34.218, document the need and steps (or add a short checklist) and inform the user.

---

# DEV-0004 Implementation Plan: Migrate feeder and API to DB server

## 1. Overview

**Problem:** The candle-collector app (API + feeder) currently runs on server 37.27.107.227. It must be moved to the DB server 23.88.34.218 so that the app and database run on the same host (DB local). The old server must be shut down and Docker removed before the new deployment.

**Goals:**

1. On **current server** (37.27.107.227): stop the application, then remove Docker (containers, images, optionally Docker engine).
2. On **new server** (23.88.34.218): deploy API + feeder via Docker, open API port (14444), configure app to use local DB on the same host.
3. Update deploy automation and docs so future deploys target the new server; document GitHub key setup on the new host if needed.

**Success criteria:**

- 37.27.107.227: app stopped, Docker removed as specified.
- 23.88.34.218: app runs in Docker, port 14444 open and reachable; `DATABASE_URL` points to local DB.
- `.env` / docs use new server (e.g. `APP_SERVER_USER=root@23.88.34.218`); optional checklist for GitHub keys on new host.

---

## 2. Security Summary

- **Attack surface:** Unchanged (same app, same port; only host and DB location change). Firewall/port rules on the new server should be verified.
- **New permissions:** None in code. Server access shifts to root@23.88.34.218; ensure SSH key and access are controlled.
- **Sensitive data:** `.env.production` and `DATABASE_URL` remain in deploy flow; no new exposure. DB on same host reduces network exposure of DB.
- **Risks:** (1) Wrong server targeted during transition — mitigate by updating env once and using one source of truth. (2) New server lacks GitHub access for `git pull` — document and optionally add deploy key. (3) Firewall on 23.88.34.218 may block 14444 — document opening the port.

---

## 3. Architecture Impact

- **Components:** `scripts/external-deploy.sh`, `scripts/external-app-down.sh` (usage/flow unchanged; env vars point to new host). Local `.env`: `APP_SERVER_USER`, `APP_SERVER_SSH_KEY`. New server: Docker, repo at `/repos/candle-collector`, `.env` with local `DATABASE_URL`.
- **Integration:** Deploy script SSHs to `APP_SERVER_USER`, copies `.env.production` to server, runs `git pull` and `docker compose` on the server. App in container connects to DB via `DATABASE_URL` (on new server: localhost or same-host PostgreSQL).

---

## 4. Detailed Design

### 4.1 Component Changes

| File / location | Changes | Reason |
|-----------------|---------|--------|
| Local `.env` (dev machine) | Set `APP_SERVER_USER=root@23.88.34.218`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519` (or key used for 23.88.34.218). | Deploy script uses these to target the new server. |
| `.env.production` (local) | Ensure `DATABASE_URL` (and `SHADOW_DATABASE_URL` if used) point to DB on 23.88.34.218 (e.g. `postgresql://user:pass@localhost:5432/dbname` or `@host.docker.internal` if DB in another container on same host). | App on new server must use local DB. |
| `memory-bank/techContext.md` or README | Document new server as deploy target; optional: firewall (open 14444), GitHub key checklist for server. | Single source of truth for deploy target and prerequisites. |

### 4.2 New Components

| Item | Purpose | Dependencies |
|------|---------|--------------|
| Optional: `memory-bank/tasks/DEV-0004-migration-runbook.md` or section in docs | Step-by-step runbook: pre-migration (stop + remove Docker on old server), prepare new server (Docker, repo, env), first deploy, verification. | None. |
| Optional: `scripts/pre-migration-stop-old-server.sh` | Script that SSHs to old server (37.27.107.227), runs down + Docker cleanup (and optionally uninstall Docker). | `.env` with vars for *old* server or explicit args. |

### 4.3 API Changes

- None. Same API and port (14444); only host changes.

### 4.4 Database Changes

- None in schema. Only `DATABASE_URL` on the new server must point to the local PostgreSQL instance (same host).

---

## 5. Security Design (Appendix A)

### 5.1 Threat Model

- **Assets:** App availability, DB and env on new server, SSH access.
- **Threats:** Misuse of root/SSH on new server; exposure of 14444 to unintended networks; accidental deploy to wrong host.
- **Mitigations:** Use dedicated SSH key for deploy; document correct `APP_SERVER_*` values; on new server, open only required ports (e.g. 22, 14444) and restrict by firewall if needed.

### 5.2 Security Controls Checklist

- [x] No new secrets in repo; `.env.production` stays local and is copied via scp.
- [x] Deploy uses SSH key (no password in script).
- [x] DB on same host reduces DB network exposure.
- [ ] Confirm firewall/security group on 23.88.34.218 allows 14444 only where intended.
- [ ] Document that GitHub key on new server (if used) should be read-only deploy key where possible.

---

## 6. Implementation Steps

### Step 1: Pre-migration — stop app and remove Docker on current server (37.27.107.227)

**Actions:**

1. From local machine, ensure `.env` still has old server for this run:  
   `APP_SERVER_USER=root@37.27.107.227`, `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519`.
2. Run stop script:  
   `pnpm run down` (or `bash scripts/external-app-down.sh`).  
   This SSHs to 37.27.107.227 and runs `docker compose -p cc -f docker-compose.yml down --remove-orphans`.
3. SSH to the current server and remove Docker resources (and optionally Docker itself):

```bash
# SSH to current server
ssh -i ~/.ssh/id_ed25519 root@37.27.107.227

# In /repos/candle-collector (if still present)
cd /repos/candle-collector
docker compose -p cc -f docker-compose.yml down --remove-orphans

# Remove images and cleanup
docker image rm cc-candles 2>/dev/null || true
docker image prune -f -a
docker volume prune -f

# Optional: uninstall Docker (example for Debian/Ubuntu)
# apt-get remove -y docker-ce docker-ce-cli containerd.io
# apt-get purge -y docker-ce docker-ce-cli containerd.io
```

**Rationale:** Clean shutdown and removal on old host before switching deploy target.

### Step 2: Prepare new server (23.88.34.218)

**Actions:**

1. SSH: `ssh root@23.88.34.218` (or with key if required: `ssh -i ~/.ssh/id_ed25519 root@23.88.34.218`).
2. Install Docker and Docker Compose if not present (e.g. Docker docs for the distro).
3. Ensure PostgreSQL is installed and running locally; create DB and user if needed; note connection string for `DATABASE_URL`.
4. Clone repo (or prepare for first deploy):  
   `git clone <repo-url> /repos/candle-collector` (or ensure directory exists and deploy script will run `git pull`).  
   If repo is private: add SSH deploy key to GitHub and use SSH clone URL, or use HTTPS + token.
5. Create `logs` directory: `mkdir -p /repos/candle-collector/logs`.

**Rationale:** New server must have Docker, local DB, and repo in place before first deploy.

### Step 3: Update local env and .env.production for new server

**Files:** Local `.env`, `.env.production` (both in `.gitignore`).

**Changes:**

- In `.env`: set  
  `APP_SERVER_USER=root@23.88.34.218`  
  `APP_SERVER_SSH_KEY=~/.ssh/id_ed25519`  
  (or the key that can SSH to 23.88.34.218).
- In `.env.production`: set  
  `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public`  
  (and `SHADOW_DATABASE_URL` if used) for the DB on 23.88.34.218.  
  If the app runs in Docker and DB is on host, use `host.docker.internal` or the host’s LAN IP if required by the OS.

**Rationale:** Deploy script and app config must target the new server and its local DB.

### Step 4: First deploy to new server

**Actions:**

1. From repo root (with updated `.env` and `.env.production`):  
   `bash scripts/external-deploy.sh`  
   (or `pnpm run deploy` if defined).
2. Script will: scp `.env.production` to `root@23.88.34.218:/repos/candle-collector/.env`, then SSH and run `git pull`, `docker compose build`, `docker compose up -d`.
3. Open port 14444 on the new server (firewall/security group): e.g. `ufw allow 14444/tcp` or cloud security group rule.
4. Verify: from local machine, `curl http://23.88.34.218:14444/` (or health endpoint). On server, `./scripts/verify-server.sh` if available.

**Rationale:** Single automated path for deploy; manual port and smoke test ensure correctness.

### Step 5: Document deploy target and optional GitHub key checklist

**Files:** `README.md`, optionally `memory-bank/techContext.md` or `memory-bank/tasks/DEV-0004-migration-runbook.md`.

**Changes:**

- In README (or Deploy section): state that the production deploy target is 23.88.34.218; `APP_SERVER_USER` and `APP_SERVER_SSH_KEY` must point to this host.
- Optional short checklist for new server: (1) Install Docker (and Compose). (2) Install/configure PostgreSQL; set `DATABASE_URL` in `.env.production`. (3) Clone repo to `/repos/candle-collector`; if private, configure GitHub access (SSH deploy key or HTTPS token). (4) Open port 14444. (5) Run deploy script from local.

**Rationale:** Prevents future confusion and gives a repeatable setup for the new host.

---

## 7. Test Plan

- **Pre-migration:** After Step 1, confirm no containers are running on 37.27.107.227 (`docker ps -a` empty or no `cc` stack).
- **Post-deploy:** (1) `curl http://23.88.34.218:14444/` returns expected health response. (2) Optional: call one API endpoint (e.g. `GET /exchange` or `GET /getTopCoins`) and check response. (3) On server, check container logs: `docker compose -p cc -f docker-compose.yml logs -f` and app logs in `logs/`.
- **DB:** App logs should show successful Prisma/DB connection; no connection errors to DB.

---

## 8. Rollback Strategy

- If deploy to new server fails: fix config (env, port, DB) and re-run `scripts/external-deploy.sh`. No schema or code rollback needed.
- If need to run again on old server: change `.env` back to `APP_SERVER_USER=root@37.27.107.227`, restore Docker on 37.27.107.227, ensure `.env.production` has DB reachable from that host, run deploy script. (DB would need to be reachable from old server or restored from backup.)

---

## 9. Validation Checklist

- [ ] Step 1 done: app stopped and Docker removed on 37.27.107.227.
- [ ] Step 2 done: Docker and local PostgreSQL installed on 23.88.34.218; repo present at `/repos/candle-collector`; GitHub access configured if repo is private.
- [ ] Step 3 done: local `.env` has `APP_SERVER_USER=root@23.88.34.218` and correct `APP_SERVER_SSH_KEY`; `.env.production` has `DATABASE_URL` for local DB on new server.
- [ ] Step 4 done: deploy script run successfully; port 14444 open; health (and optional API) check passes.
- [x] Step 5 done: README or docs updated with new server and optional GitHub/firewall checklist. Runbook and pre-migration script added (DEV-0004 BUILD).
- [ ] No regressions: existing API behavior unchanged; only host and DB location changed.

---

## 10. Next Steps

- Execute Steps 1–4 in order (pre-migration on old server → prepare new server → update env → deploy). Step 5 (docs) is done.
- Runbook: `memory-bank/tasks/DEV-0004-migration-runbook.md`. Pre-migration: `pnpm run pre-migration-stop` (set `OLD_APP_SERVER_USER`, `OLD_APP_SERVER_SSH_KEY` in `.env`).
- If GitHub key is not set up on 23.88.34.218: add a deploy key or use HTTPS token before first `git pull` on the server.

---

## Task ID: DEV-0003

**Title:** Add method fetchTopCoins — CMC scrape, new table, daily update, wire ENABLE_TOP_COIN_FETCH

**Status:** completed (archived)  
**Complexity:** Level 3  
**Started:** 2026-02-21  
**Type:** feature  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Archive:** [memory-bank/archive/archive-DEV-0003.md](archive/archive-DEV-0003.md)  
**Reflection:** [memory-bank/reflection/reflection-DEV-0003.md](reflection/reflection-DEV-0003.md)

---

## 1. Overview

**Problem:** Top coins are loaded from a static JSON file (`data/coins-top-500.json`); data is outdated and manual. Candle fetch for “top” coins (`ENABLE_TOP_COIN_FETCH`) relies on this source.

**Goals:** (1) Fetch live coin listing from CoinMarketCap page HTML; (2) store CMC data in a new DB table with upsert by CMC id; (3) run this update once per day when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`; (4) make `getTopCoinFirstExchange()` and related APIs use the new table so `ENABLE_TOP_COIN_FETCH` uses CMC-backed data.

**Success criteria:** CMC page fetched and JSON extracted; new table populated/updated; daily job runs under flag; `fetchTopCoinsM1Candles()` reads from new table with correct ordering (e.g. by `volume24h`).

---

## 2. Security Summary

- **Attack surface:** Unchanged (no new user-facing endpoints; outbound HTTP to CMC only).
- **New permissions:** None.
- **Sensitive data:** No PII; only public CMC listing data stored.
- **Risks:** (1) CMC may block or change HTML/JSON structure — mitigate with User-Agent, error handling, and optional fallback to existing TopCoin/JSON. (2) Parsing page HTML/JSON — validate and bound parsed data to avoid DoS; no eval/exec of CMC content.

---

## 3. Architecture Impact

- **Components:** `prisma/schema.prisma` (new model), `src/prisma.service.ts` (queries), `src/app.service.ts` (bootstrap, CMC fetch, daily job, optional TopCoin sync), new helper for CMC fetch/parse (e.g. `src/cmc.service.ts` or methods in `app.service.ts`).
- **Integration:** On bootstrap, if `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`, schedule a recurring check (e.g. same pattern as `fetchAllMarkets`): read `GlobalVar` `LastUpdateTopCoinFromCmc`; if older than 24h, run CMC fetch → parse → upsert; then set `LastUpdateTopCoinFromCmc`. `getTopCoinFirstExchange()` / `getTopCoins()` / `getTopCoinMarkets()` switch to query the new table (join by `symbol` → `Symbol.name = symbol || '/USDT'`).

---

## 4. Detailed Design

### 4.1 Component Changes

| File | Changes | Reason |
|------|---------|--------|
| `prisma/schema.prisma` | Add model `TopCoinFromCmc` with `cmcId`, `symbol`, `name`, `slug`, and CMC fields (price, volume24h, marketCap, supply, ath, atl, dates, etc.). Unique on `cmcId`. | Store CMC listing; upsert by CMC id. |
| `src/prisma.service.ts` | Add `getTopCoinFirstExchangeFromCmc()`, or change `getTopCoinFirstExchange()` to read from `TopCoinFromCmc` (join Symbol, Market, Exchange), order by `volume24h` desc. Same for `getTopCoins()` and `getTopCoinMarkets()` using new table. | Source of truth for “top coins” becomes CMC table. |
| `src/app.service.ts` | (1) Add `fetchAndUpdateTopCoinsFromCmc()`: HTTP get CMC URL, extract JSON from HTML (e.g. script id or regex), parse coins array, map to table rows, upsert by `cmcId`. (2) In `onApplicationBootstrap`, if `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`, schedule loop that checks `LastUpdateTopCoinFromCmc` (24h); runs fetch and sets var. (3) Keep `updateTopCoins()` for backward compatibility when CMC is off; optionally deprecate or call it only when CMC table is empty. | Daily CMC update and single-run fetch logic. |
| `.env.example` | Already has `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`. | Document flag. |

### 4.2 New Components

| File | Purpose | Dependencies |
|------|---------|--------------|
| Optional: `src/cmc.service.ts` | Encapsulate CMC fetch + HTML parse + JSON extraction + mapping to DTO. Returns array of coin objects. | `fetch` (Node built-in), no new deps. |
| Migration | `prisma migrate dev --name add_top_coin_from_cmc` | Prisma. |

### 4.3 API Changes

- No new endpoints. Existing: `GET /getTopCoins`, `GET /getTopCoinMarkets`, `GET /getTopCoinFirstExchange`, `GET /updateTopCoins` — response shape unchanged where possible (same `coin`/symbol, ordering by volume/cost). `GET /updateTopCoins` can be extended to trigger CMC update when flag is set, or left as legacy JSON updater.

### 4.4 Database Changes

- **Table:** `TopCoinFromCmc` (name TBD, e.g. `TopCoinFromCmc`).
- **Columns:** `cmcId Int @unique`, `symbol String`, `name String`, `slug String?`, `cmcRank Int?`, `logo String?`, `circulatingSupply Float?`, `totalSupply Float?`, `maxSupply Float?`, `ath Float?`, `atl Float?`, `high24h Float?`, `low24h Float?`, `price Float`, `volume24h Float`, `marketCap Float`, `percentChange1h Float?`, `percentChange24h Float?`, `percentChange7d Float?`, `lastUpdated DateTime?`, `dateAdded DateTime?`, `isActive Int?`, `createdAt DateTime`, `updatedAt DateTime`. Index on `symbol` for joins; index on `volume24h` for ordering.
- **Migration:** New migration creating this table.

---

## 5. Security Design (Appendix A)

### 5.1 Threat Model

- **Assets:** App availability; DB integrity.
- **Threats:** CMC returns malicious or huge payload; CMC changes structure and parser crashes; excessive memory from large HTML/JSON.
- **Mitigations:** Use native `fetch` + stream/bounded read if needed; parse only the known script/JSON block; validate array length (e.g. cap at 5000 items); try/catch and log errors without failing bootstrap; no eval of CMC content.

### 5.2 Security Controls Checklist

- [x] Input validation: Validate CMC response (status 200, content-type); validate parsed numbers/dates before DB write.
- [x] No SQL concatenation: Use Prisma upsert/queryRaw with parameters.
- [x] No secrets: CMC URL is public; no API key required for page fetch.
- [x] Access control: No new auth; job runs in-app with same privileges.
- [x] Infrastructure: No new permissions.

---

## 6. Implementation Steps

### Step 1: Prisma model and migration

**Files:** `prisma/schema.prisma`

Add model (example; adjust types to CMC payload):

```prisma
model TopCoinFromCmc {
  id                Int       @id @default(autoincrement())
  cmcId             Int       @unique
  symbol            String
  name              String
  slug              String?
  cmcRank           Int?
  logo              String?
  circulatingSupply Float?
  totalSupply       Float?
  maxSupply         Float?
  ath               Float?
  atl               Float?
  high24h           Float?
  low24h            Float?
  price             Float     @default(0)
  volume24h         Float     @default(0)
  marketCap         Float     @default(0)
  percentChange1h   Float?
  percentChange24h  Float?
  percentChange7d   Float?
  lastUpdated       DateTime?
  dateAdded         DateTime?
  isActive          Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([symbol])
  @@index([volume24h])
}
```

Run `pnpm exec prisma migrate dev --name add_top_coin_from_cmc`.

**Rationale:** Establish schema first so services can use the table.

### Step 2: CMC fetch and parse

**Files:** `src/app.service.ts` or `src/cmc.service.ts`

- Implement `fetchCmcPage(): Promise<string>`: `fetch('https://coinmarketcap.com/')` with `User-Agent` header, return response.text().
- Implement `extractCoinListingFromHtml(html: string): CmcCoin[]`: locate JSON in HTML (e.g. search for `__NEXT_DATA__` or script containing `"id":1,"name":"Bitcoin"`), parse JSON, find the array of coin objects (path depends on CMC page structure — may need one-time inspection of page source), return array. Map each item to a DTO with at least: cmcId, symbol, name, slug, quotes[USD].price, volume24h, marketCap, etc.
- Add error handling and optional max items (e.g. 2000) to avoid runaway memory.

**Rationale:** Isolate HTTP and parsing so daily job only does “fetch → parse → upsert”.

### Step 3: Upsert into TopCoinFromCmc

**Files:** `src/app.service.ts`

- Implement `updateTopCoinsFromCmc(): Promise<void>`: call fetch + extract; for each coin, find USD quote; upsert `TopCoinFromCmc` by `cmcId` with all mapped fields. Use Prisma `topCoinFromCmc.upsert({ where: { cmcId }, create: {...}, update: {...} })`.
- Expose optional GET endpoint or keep only internal call from scheduler.

**Rationale:** Single method that brings CMC data into DB.

### Step 4: Daily job with GlobalVar

**Files:** `src/app.service.ts`

- In `onApplicationBootstrap`, if `ENABLE_UPDATE_TOP_COIN_FROM_CMC === 'true' || === '1'`, schedule (setTimeout) a method e.g. `runUpdateTopCoinsFromCmcIfNeeded()`.
- In that method: `lastRun = await this.global.getGlobalVariableTime('LastUpdateTopCoinFromCmc')`; if `lastRun === null || Date.now() - lastRun > 24 * 60 * 60 * 1000`, call `updateTopCoinsFromCmc()`, then `await this.global.setGlobalVariable('LastUpdateTopCoinFromCmc', 1)`. Then reschedule itself (e.g. setTimeout(..., 60 * 60 * 1000)) to check again in 1 hour.
- Rationale: Once per day update without cron; same pattern as markets/candles.

### Step 5: Switch Prisma queries to new table

**Files:** `src/prisma.service.ts`

- **getTopCoinFirstExchange:** Change to query from `TopCoinFromCmc`: join `Symbol` ON `s.name = tc.symbol || '/USDT'`, Market, Exchange; `orderBy: { volume24h: 'desc' }`; exclude STABLES; same ROW_NUMBER per symbol, take first exchange. Use Prisma or $queryRaw with `TopCoinFromCmc` alias.
- **getTopCoins:** Change to `topCoinFromCmc.findMany({ where: { symbol: { notIn: STABLES } }, orderBy: { volume24h: 'desc' } })` and map to same shape as before (e.g. coin, name, cost24 → volume24h) so API contract holds.
- **getTopCoinMarkets:** Same join but from `TopCoinFromCmc` (tc.symbol instead of tc.coin).

**Rationale:** `fetchTopCoinsM1Candles()` already uses `getTopCoinFirstExchange()`; once Prisma reads from CMC table, no change needed in app.service for M1 loop.

### Step 6: Backward compatibility and fallback

**Files:** `src/prisma.service.ts`, `src/app.service.ts`

- If new table is empty and `getTopCoinFirstExchange()` returns [], keep existing behavior: either (a) still read from `TopCoin` when `TopCoinFromCmc` has no rows (hybrid), or (b) document that first run of CMC update or manual `updateTopCoins()` (legacy) must populate data. Prefer (a) for smooth rollout: when CMC table has rows, use it; otherwise fall back to TopCoin.
- Document in spec: `updateTopCoins()` and `coins-top-500.json` remain for fallback when `ENABLE_UPDATE_TOP_COIN_FROM_CMC=false`.

**Rationale:** Safe rollout; no breakage if CMC fails first time.

---

## 7. Test Plan

- **Unit:** (1) `extractCoinListingFromHtml` with a fixture HTML snippet containing sample JSON — assert parsed array length and sample fields. (2) Map CMC coin + USD quote to Prisma create payload — assert shape and types.
- **Integration:** (1) With DB, run `updateTopCoinsFromCmc()` (or mock fetch to return fixture), then assert `TopCoinFromCmc` rows. (2) Call `getTopCoinFirstExchange()` and assert ordering by volume24h and join with Symbol/Market.
- **Security:** No user input in CMC path; ensure no eval/Function of CMC content.

---

## 8. Rollback Strategy

- **Revert code:** `git revert <commit(s)>`.
- **DB:** If no dependency from other features, keep table; or `prisma migrate resolve --rolled-back <migration_name>` and drop table manually. Restore `getTopCoinFirstExchange`/`getTopCoins`/`getTopCoinMarkets` to use `TopCoin` only.
- **Feature flag:** Set `ENABLE_UPDATE_TOP_COIN_FROM_CMC=false` to stop CMC updates; Prisma can be reverted to read from TopCoin only.

---

## 9. Validation Checklist

- [x] Migration applied; `TopCoinFromCmc` exists.
- [x] CMC page fetch and JSON extraction work (unit test + fetchCmcPage/extractCoinListingFromHtml).
- [x] `updateTopCoinsFromCmc()` upserts rows; `LastUpdateTopCoinFromCmc` set when job runs.
- [x] With `ENABLE_UPDATE_TOP_COIN_FROM_CMC=true`, job runs once per 24h.
- [x] `getTopCoinFirstExchange()` uses CMC table when it has data, ordered by volume24h; fallback to TopCoin.
- [x] `ENABLE_TOP_COIN_FETCH=true` → `fetchTopCoinsM1Candles()` uses CMC-backed list (via getTopCoinFirstExchange).
- [x] No regressions: getTopCoins, getTopCoinMarkets response shape consistent.
- [x] Documentation (README, techContext, projectbrief, productContext) updated.

---

## 10. Next Steps

- Proceed to `/do` command to implement Step 1–6.
- Optionally inspect CMC page source once to confirm exact JSON path (e.g. `__NEXT_DATA__.props.pageProps.initialState.cryptocurrency.listingLatest.data` or similar).

---

## Task ID: DEV-0002

**Title:** Fix Prisma deprecation, ESLint/ajv, container stability, exchange env

**Status:** completed (archived)  
**Complexity:** Level 2  
**Started:** 2026-02-21  
**Type:** infrastructure / fix  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Archive:** [memory-bank/archive/archive-DEV-0002.md](archive/archive-DEV-0002.md)  
**Reflection:** [memory-bank/reflection/reflection-DEV-0002.md](reflection/reflection-DEV-0002.md)

---

## Task ID: DEV-0001

**Title:** Migrate to pnpm, update deps, modernize Docker, verify build and deploy

**Status:** completed  
**Complexity:** Level 2  
**Started:** 2026-02-20  
**Type:** infrastructure  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Archive:** [memory-bank/archive/archive-DEV-0001.md](archive/archive-DEV-0001.md)  
**Reflection:** [memory-bank/reflection/reflection-DEV-0001.md](reflection/reflection-DEV-0001.md)

---

## Task ID: INIT

**Title:** Project initialization (Memory Bank, .gitignore, documentation)

**Status:** completed  
**Complexity:** Level 1  
**Started:** 2025-02-20  
**Type:** setup  
**Priority:** high  
**Repository:** candles  
**Branch:** main  
**Reflection:** done — memory-bank/reflection/reflection-INIT.md  

### Checklist

- [x] Repo up to date (git pull)
- [x] Project analyzed
- [x] memory-bank/ structure created
- [x] projectbrief.md, techContext.md, productContext.md, systemPatterns.md
- [x] activeContext.md, progress.md, tasks.md
- [x] .gitignore updated
- [x] README and documentation updated
