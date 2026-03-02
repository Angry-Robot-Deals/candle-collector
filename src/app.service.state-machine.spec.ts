/**
 * Unit tests for AppService.processCandleStateMachine.
 *
 * All external calls (prisma, fetchLastCandles, fetchCandles) are mocked.
 * onApplicationBootstrap is suppressed to prevent background loops from starting.
 */
import { TIMEFRAME } from './timeseries.interface';
import { CandleDb } from './interface';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by Jest)
// ---------------------------------------------------------------------------
jest.mock('./exchange-fetch-last-candles', () => ({
  fetchLastCandles: jest.fn(),
}));

jest.mock('./exchange-fetch-candles', () => ({
  binanceFetchCandles: jest.fn(),
  okxFetchCandles: jest.fn(),
  poloniexFetchCandles: jest.fn(),
  bybitFetchCandles: jest.fn(),
  htxFetchCandles: jest.fn(),
  binanceFindFirstCandle: jest.fn(),
  okxFindFirstCandle: jest.fn(),
  poloniexFindFirstCandle: jest.fn(),
  bybitFindFirstCandle: jest.fn(),
}));

jest.mock('./exchanges/mexc', () => ({ mexcFetchCandles: jest.fn(), mexcFindFirstCandle: jest.fn() }));
jest.mock('./exchanges/gateio', () => ({ gateioFetchCandles: jest.fn(), gateioFindFirstCandle: jest.fn() }));
jest.mock('./exchanges/kucoin', () => ({ kucoinFetchCandles: jest.fn(), kucoinFindFirstCandle: jest.fn() }));
jest.mock('./exchanges/bitget', () => ({ bitgetFetchCandles: jest.fn(), bitgetCandleToCandleModel: jest.fn(), bitgetFindFirstCandle: jest.fn() }));

jest.mock('ccxt', () => ({}));

jest.mock('@nestjs/common', () => ({
  Injectable: () => () => {},
  Logger: { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
  OnApplicationBootstrap: () => () => {},
}));

jest.mock('./timeseries', () => ({
  /**
   * When called without a date argument → returns FIXED_NOW_MS (current candle boundary).
   * When called with a date argument → returns the date's timestamp as-is (no alignment needed in tests).
   * This allows hasCurrent checks to work correctly:
   *   getCandleTime(tf, currentCandle.time) → FIXED_NOW_MS  (equal → hasCurrent=true)
   *   getCandleTime(tf, oldCandle.time)     → oldMs          (≠ FIXED_NOW_MS → hasCurrent=false)
   */
  getCandleTime: jest.fn((tf, date?: Date | number) => {
    if (date == null) return 1_770_000_000_000;
    return date instanceof Date ? date.getTime() : +date;
  }),
  getCandleHumanTime: jest.fn((tf, d) => (d instanceof Date ? d : new Date(d))),
  getCandleTimeByShift: jest.fn().mockReturnValue(1_769_999_100_000),
}));

// ---------------------------------------------------------------------------
// Imports after mocking
// ---------------------------------------------------------------------------
import { AppService } from './app.service';
import { fetchLastCandles } from './exchange-fetch-last-candles';

const mockFetchLastCandles = fetchLastCandles as jest.Mock;

// ---------------------------------------------------------------------------
// Fixed test data
// ---------------------------------------------------------------------------
const FIXED_NOW_MS = 1_770_000_000_000;
const TF = TIMEFRAME.M15;
const TF_MINUTES = 15;
const TF_MS = 15 * 60 * 1000;

function makeCandle(offsetMs = 0): CandleDb {
  return {
    time: new Date(FIXED_NOW_MS - offsetMs),
    open: 100, high: 110, low: 90, close: 105, volume: 1000, trades: 50,
  };
}

const CURRENT_CANDLE = makeCandle(0);     // time === getCandleTime(TF) → current
const OLD_CANDLE = makeCandle(TF_MS);     // one step in the past

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------
function makePrisma(opts: {
  statusRec?: object | null;
  upsertResult?: object;
}) {
  return {
    getCandleUpdateStatus: jest.fn().mockResolvedValue(opts.statusRec ?? null),
    upsertCandleUpdateStatus: jest.fn().mockResolvedValue(
      opts.upsertResult ?? { id: 1, marketId: 1, tf: TF_MINUTES, symbolId: 1, exchangeId: 1, status: 0, candleFirstTime: null, candleLastTime: null },
    ),
    updateCandleStatusFields: jest.fn().mockResolvedValue(undefined),
    market: { findUnique: jest.fn() },
  };
}

const MOCK_GLOBAL = {
  getGlobalVariable: jest.fn(),
  setGlobalVariable: jest.fn(),
  getGlobalVariableTime: jest.fn(),
};

const MARKET = { id: 7, symbolId: 3, synonym: 'BTCUSDT', symbol: { name: 'BTC/USDT' } };
const EXCHANGE = { id: 2, name: 'binance' };
const LOG_CTX = 'test';
const LIMIT = 10;

function makeService(prisma: ReturnType<typeof makePrisma>): AppService {
  const svc = new AppService(prisma as any, MOCK_GLOBAL as any);
  // Suppress background loops
  svc.onApplicationBootstrap = jest.fn() as any;
  // Spy on fetchCandles (used in status 2 & 4)
  svc.fetchCandles = jest.fn();
  return svc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('processCandleStateMachine', () => {
  let saveFn: jest.Mock;
  let onFewCandles: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    saveFn = jest.fn().mockResolvedValue({ count: 1 });
    onFewCandles = jest.fn();
  });

  // ── No status record: create with status=0 and run status=0 logic ─────────
  describe('status 0 — pending (no existing record)', () => {
    it('creates record and detects not-found (-404) when fetchLastCandles returns empty', async () => {
      const prisma = makePrisma({ statusRec: null });
      const svc = makeService(prisma);
      mockFetchLastCandles.mockResolvedValue([]);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.upsertCandleUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: -404 }),
      );
      expect(saveFn).not.toHaveBeenCalled();
    });

    it('detects disabled (-100) when no current candle in batch', async () => {
      const prisma = makePrisma({ statusRec: null });
      const svc = makeService(prisma);
      mockFetchLastCandles.mockResolvedValue([OLD_CANDLE]);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.upsertCandleUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: -100 }),
      );
      expect(saveFn).not.toHaveBeenCalled();
    });

    it('transitions to 2 (find_first_fringe) when current candle is present', async () => {
      const prisma = makePrisma({ statusRec: null });
      const svc = makeService(prisma);
      mockFetchLastCandles.mockResolvedValue([CURRENT_CANDLE, OLD_CANDLE]);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      // Candles saved + status → 2
      expect(saveFn).toHaveBeenCalledWith([CURRENT_CANDLE, OLD_CANDLE]);
      expect(prisma.upsertCandleUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 2 }),
      );
    });

    it('does not change status on fetchLastCandles error (string)', async () => {
      const prisma = makePrisma({ statusRec: null });
      const svc = makeService(prisma);
      mockFetchLastCandles.mockResolvedValue('Network error');

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      // Only the initial create upsert with status=0; no further updates
      expect(prisma.upsertCandleUpdateStatus).toHaveBeenCalledTimes(1);
      expect(prisma.upsertCandleUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 0 }),
      );
      expect(saveFn).not.toHaveBeenCalled();
    });
  });

  // ── Explicit status 0 from DB ─────────────────────────────────────────────
  describe('status 0 — pending (record exists in DB)', () => {
    it('transitions to 2 when batch has current candle', async () => {
      const rec = { id: 1, marketId: 7, tf: TF_MINUTES, symbolId: 3, exchangeId: 2, status: 0, candleFirstTime: null, candleLastTime: null };
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      mockFetchLastCandles.mockResolvedValue([CURRENT_CANDLE]);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.upsertCandleUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 2 }),
      );
    });
  });

  // ── Status 2: find_first_fringe ───────────────────────────────────────────
  describe('status 2 — find_first_fringe', () => {
    const rec = {
      id: 1, marketId: 7, tf: TF_MINUTES, symbolId: 3, exchangeId: 2,
      status: 2, candleFirstTime: Math.floor(FIXED_NOW_MS / 1000) - 100 * (TF_MINUTES * 60), candleLastTime: null,
    };

    it('stays in 2 when full batch returned (length === limit)', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      const fullBatch = Array.from({ length: LIMIT }, (_, i) => makeCandle((i + 101) * TF_MS));
      (svc.fetchCandles as jest.Mock).mockResolvedValue(fullBatch);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.updateCandleStatusFields).toHaveBeenCalledWith(
        MARKET.id, TF_MINUTES,
        expect.objectContaining({ status: 2 }),
      );
    });

    it('transitions to 4 when partial batch (length < limit)', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      const partialBatch = [makeCandle((101) * TF_MS), makeCandle((102) * TF_MS)]; // 2 < LIMIT=10
      (svc.fetchCandles as jest.Mock).mockResolvedValue(partialBatch);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.updateCandleStatusFields).toHaveBeenCalledWith(
        MARKET.id, TF_MINUTES,
        expect.objectContaining({ status: 4 }),
      );
    });

    it('transitions to 4 on empty batch', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      (svc.fetchCandles as jest.Mock).mockResolvedValue([]);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.updateCandleStatusFields).toHaveBeenCalledWith(
        MARKET.id, TF_MINUTES,
        expect.objectContaining({ status: 4 }),
      );
    });

    it('does not change status on fetch error', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      (svc.fetchCandles as jest.Mock).mockResolvedValue('Timeout');

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(prisma.updateCandleStatusFields).not.toHaveBeenCalled();
    });

    it('updates candleFirstTime to the minimum batch timestamp', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      const c1 = makeCandle(200 * TF_MS);
      const c2 = makeCandle(150 * TF_MS);
      (svc.fetchCandles as jest.Mock).mockResolvedValue([c1, c2]); // 2 < LIMIT=10 → status 4

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      const call = (prisma.updateCandleStatusFields as jest.Mock).mock.calls[0];
      const fields = call[2];
      expect(fields.candleFirstTime).toBeLessThan(rec.candleFirstTime);
    });
  });

  // ── Status 4: process ─────────────────────────────────────────────────────
  describe('status 4 — process (standard fetch)', () => {
    const rec = {
      id: 1, marketId: 7, tf: TF_MINUTES, symbolId: 3, exchangeId: 2,
      status: 4, candleFirstTime: 1_000_000, candleLastTime: Math.floor(FIXED_NOW_MS / 1000),
    };

    it('saves candles and updates candleLastTime', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      const batch = [CURRENT_CANDLE];
      (svc.fetchCandles as jest.Mock).mockResolvedValue(batch);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(saveFn).toHaveBeenCalledWith(batch);
      expect(prisma.updateCandleStatusFields).toHaveBeenCalledWith(
        MARKET.id, TF_MINUTES, expect.objectContaining({ candleLastTime: expect.any(Number) }),
      );
    });

    it('does not save or update on fetch error', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      (svc.fetchCandles as jest.Mock).mockResolvedValue('API error');

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(saveFn).not.toHaveBeenCalled();
      expect(prisma.updateCandleStatusFields).not.toHaveBeenCalled();
    });

    it('calls onFewCandles when batch size <= fewCandlesThreshold', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      (svc.fetchCandles as jest.Mock).mockResolvedValue([CURRENT_CANDLE]); // 1 ≤ default threshold 3

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, onFewCandles, logContext: LOG_CTX,
      });

      expect(onFewCandles).toHaveBeenCalled();
    });

    it('does NOT call onFewCandles when batch is larger than threshold', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      const largeBatch = Array.from({ length: 10 }, () => CURRENT_CANDLE);
      (svc.fetchCandles as jest.Mock).mockResolvedValue(largeBatch);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, onFewCandles, logContext: LOG_CTX,
      });

      expect(onFewCandles).not.toHaveBeenCalled();
    });

    it('uses custom fewCandlesThreshold', async () => {
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);
      const batch = Array.from({ length: 8 }, () => CURRENT_CANDLE);
      (svc.fetchCandles as jest.Mock).mockResolvedValue(batch);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, onFewCandles, fewCandlesThreshold: 10, logContext: LOG_CTX,
      });

      expect(onFewCandles).toHaveBeenCalled();
    });
  });

  // ── Negative statuses: skip ───────────────────────────────────────────────
  describe.each([
    ['disabled', -100],
    ['paused', -200],
    ['not-found', -404],
  ])('status %s (%i) — skip', (_name, negStatus) => {
    it('makes no fetch or save calls', async () => {
      const rec = {
        id: 1, marketId: 7, tf: TF_MINUTES, symbolId: 3, exchangeId: 2,
        status: negStatus, candleFirstTime: null, candleLastTime: null,
      };
      const prisma = makePrisma({ statusRec: rec });
      const svc = makeService(prisma);

      await svc.processCandleStateMachine({
        market: MARKET, exchange: EXCHANGE, timeframe: TF, tfMinutes: TF_MINUTES,
        limit: LIMIT, saveFn, logContext: LOG_CTX,
      });

      expect(mockFetchLastCandles).not.toHaveBeenCalled();
      expect(svc.fetchCandles).not.toHaveBeenCalled();
      expect(saveFn).not.toHaveBeenCalled();
      expect(prisma.updateCandleStatusFields).not.toHaveBeenCalled();
    });
  });
});
