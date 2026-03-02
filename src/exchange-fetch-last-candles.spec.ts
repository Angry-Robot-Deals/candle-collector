import { TIMEFRAME } from './timeseries.interface';
import {
  fetchLastCandles,
  binanceFetchLastCandles,
  okxFetchLastCandles,
  kucoinFetchLastCandles,
  htxFetchLastCandles,
  poloniexFetchLastCandles,
  gateioFetchLastCandles,
  mexcFetchLastCandles,
  bitgetFetchLastCandles,
  bybitFetchLastCandles,
} from './exchange-fetch-last-candles';
import { CandleDb } from './interface';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('./exchange-fetch-candles', () => ({
  binanceFetchCandles: jest.fn(),
  okxFetchCandles: jest.fn(),
  poloniexFetchCandles: jest.fn(),
  bybitFetchCandles: jest.fn(),
  htxFetchCandles: jest.fn(),
}));

jest.mock('./exchanges/mexc', () => ({
  mexcFetchCandles: jest.fn(),
  mexcFindFirstCandle: jest.fn(),
}));

jest.mock('./exchanges/gateio', () => ({
  gateioFetchCandles: jest.fn(),
  gateioFindFirstCandle: jest.fn(),
}));

jest.mock('./exchanges/kucoin', () => ({
  kucoinFetchCandles: jest.fn(),
  kucoinFindFirstCandle: jest.fn(),
}));

jest.mock('./exchanges/bitget', () => ({
  bitgetFetchCandles: jest.fn(),
  bitgetCandleToCandleModel: jest.fn(),
  bitgetFindFirstCandle: jest.fn(),
}));

jest.mock('@nestjs/common', () => ({
  Logger: { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

// Fix getCandleTime to return a predictable value so time math is testable.
// The literal must live inside the factory (jest.mock is hoisted).
jest.mock('./timeseries', () => ({
  getCandleTime: jest.fn().mockReturnValue(1_770_000_000_000),
  getCandleHumanTime: jest.requireActual('./timeseries').getCandleHumanTime,
  getCandleTimeByShift: jest.requireActual('./timeseries').getCandleTimeByShift,
}));

const FIXED_NOW_MS = 1_770_000_000_000;

// ---------------------------------------------------------------------------
// Imports after mocking
// ---------------------------------------------------------------------------
import {
  binanceFetchCandles,
  okxFetchCandles,
  poloniexFetchCandles,
  bybitFetchCandles,
  htxFetchCandles,
} from './exchange-fetch-candles';
import { mexcFetchCandles } from './exchanges/mexc';
import { gateioFetchCandles } from './exchanges/gateio';
import { kucoinFetchCandles } from './exchanges/kucoin';
import { bitgetFetchCandles } from './exchanges/bitget';

const mockBinance = binanceFetchCandles as jest.Mock;
const mockOkx = okxFetchCandles as jest.Mock;
const mockPoloniex = poloniexFetchCandles as jest.Mock;
const mockBybit = bybitFetchCandles as jest.Mock;
const mockHtx = htxFetchCandles as jest.Mock;
const mockMexc = mexcFetchCandles as jest.Mock;
const mockGateio = gateioFetchCandles as jest.Mock;
const mockKucoin = kucoinFetchCandles as jest.Mock;
const mockBitget = bitgetFetchCandles as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCandle(timeMs: number): CandleDb {
  return { time: new Date(timeMs), open: 1, high: 2, low: 0.5, close: 1.5, volume: 100, trades: 10 };
}

const LIMIT = 10;
const TF = TIMEFRAME.M15;
const TF_MS = 15 * 60 * 1000;
const TF_SEC = 15 * 60;
const END_MS = FIXED_NOW_MS;
const START_MS = END_MS - LIMIT * TF_MS;
const END_SEC = Math.ceil(END_MS / 1000);
const START_SEC = END_SEC - LIMIT * TF_SEC;

// Candles in reverse order (as some exchanges return) to test sorting
const CANDLES_REVERSED = [
  makeCandle(END_MS - TF_MS),
  makeCandle(END_MS - 2 * TF_MS),
  makeCandle(END_MS - 3 * TF_MS),
];
const CANDLES_SORTED = [...CANDLES_REVERSED].sort((a, b) => a.time.getTime() - b.time.getTime());

// ---------------------------------------------------------------------------
// binanceFetchLastCandles
// ---------------------------------------------------------------------------
describe('binanceFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls binanceFetchCandles with correct startMs and limit', async () => {
    mockBinance.mockResolvedValue([]);
    await binanceFetchLastCandles({ exchange: 'binance', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockBinance).toHaveBeenCalledWith(expect.any(String), expect.any(String), START_MS, LIMIT);
  });

  it('returns CandleDb[] on success', async () => {
    mockBinance.mockResolvedValue(CANDLES_REVERSED);
    const result = await binanceFetchLastCandles({ exchange: 'binance', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns [] on empty response', async () => {
    mockBinance.mockResolvedValue([]);
    const result = await binanceFetchLastCandles({ exchange: 'binance', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(result).toEqual([]);
  });

  it('returns error string on fetch error', async () => {
    mockBinance.mockResolvedValue('Network error');
    const result = await binanceFetchLastCandles({ exchange: 'binance', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// okxFetchLastCandles
// ---------------------------------------------------------------------------
describe('okxFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls okxFetchCandles with correct startMs, endMs and limit', async () => {
    mockOkx.mockResolvedValue([]);
    await okxFetchLastCandles({ exchange: 'okx', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockOkx).toHaveBeenCalledWith(expect.any(String), expect.any(String), START_MS, END_MS, LIMIT);
  });

  it('returns CandleDb[] on success', async () => {
    mockOkx.mockResolvedValue(CANDLES_REVERSED);
    const result = await okxFetchLastCandles({ exchange: 'okx', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockOkx.mockResolvedValue('Bad response');
    const result = await okxFetchLastCandles({ exchange: 'okx', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// kucoinFetchLastCandles
// ---------------------------------------------------------------------------
describe('kucoinFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls kucoinFetchCandles with correct startMs and endMs', async () => {
    mockKucoin.mockResolvedValue([]);
    await kucoinFetchLastCandles({ exchange: 'kucoin', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockKucoin).toHaveBeenCalledWith(
      expect.objectContaining({ start: START_MS, end: END_MS }),
    );
  });

  it('returns CandleDb[] on success', async () => {
    mockKucoin.mockResolvedValue(CANDLES_REVERSED);
    const result = await kucoinFetchLastCandles({ exchange: 'kucoin', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockKucoin.mockResolvedValue('Bad response');
    const result = await kucoinFetchLastCandles({ exchange: 'kucoin', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// htxFetchLastCandles
// ---------------------------------------------------------------------------
describe('htxFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls htxFetchCandles with correct limit (no time range)', async () => {
    mockHtx.mockResolvedValue([]);
    await htxFetchLastCandles({ exchange: 'htx', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockHtx).toHaveBeenCalledWith(expect.any(String), expect.any(String), LIMIT);
  });

  it('returns CandleDb[] on success', async () => {
    mockHtx.mockResolvedValue(CANDLES_REVERSED);
    const result = await htxFetchLastCandles({ exchange: 'htx', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockHtx.mockResolvedValue('Bad response');
    const result = await htxFetchLastCandles({ exchange: 'htx', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// poloniexFetchLastCandles
// ---------------------------------------------------------------------------
describe('poloniexFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls poloniexFetchCandles with correct startMs, endMs and limit', async () => {
    mockPoloniex.mockResolvedValue([]);
    await poloniexFetchLastCandles({ exchange: 'poloniex', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockPoloniex).toHaveBeenCalledWith(expect.any(String), expect.any(String), START_MS, END_MS, LIMIT);
  });

  it('returns CandleDb[] on success', async () => {
    mockPoloniex.mockResolvedValue(CANDLES_REVERSED);
    const result = await poloniexFetchLastCandles({ exchange: 'poloniex', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockPoloniex.mockResolvedValue('Bad response');
    const result = await poloniexFetchLastCandles({ exchange: 'poloniex', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// gateioFetchLastCandles
// ---------------------------------------------------------------------------
describe('gateioFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls gateioFetchCandles with correct startSec and endSec', async () => {
    mockGateio.mockResolvedValue([]);
    await gateioFetchLastCandles({ exchange: 'gateio', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockGateio).toHaveBeenCalledWith(
      expect.objectContaining({ start: START_SEC, end: END_SEC }),
    );
  });

  it('returns CandleDb[] on success', async () => {
    mockGateio.mockResolvedValue(CANDLES_REVERSED);
    const result = await gateioFetchLastCandles({ exchange: 'gateio', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockGateio.mockResolvedValue('Bad response');
    const result = await gateioFetchLastCandles({ exchange: 'gateio', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// mexcFetchLastCandles
// ---------------------------------------------------------------------------
describe('mexcFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls mexcFetchCandles with correct startMs and limit', async () => {
    mockMexc.mockResolvedValue([]);
    await mexcFetchLastCandles({ exchange: 'mexc', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockMexc).toHaveBeenCalledWith(
      expect.objectContaining({ start: START_MS, limit: LIMIT }),
    );
  });

  it('returns CandleDb[] on success', async () => {
    mockMexc.mockResolvedValue(CANDLES_REVERSED);
    const result = await mexcFetchLastCandles({ exchange: 'mexc', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockMexc.mockResolvedValue('Bad response');
    const result = await mexcFetchLastCandles({ exchange: 'mexc', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// bitgetFetchLastCandles
// ---------------------------------------------------------------------------
describe('bitgetFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls bitgetFetchCandles with correct startMs and limit', async () => {
    mockBitget.mockResolvedValue([]);
    await bitgetFetchLastCandles({ exchange: 'bitget', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockBitget).toHaveBeenCalledWith(
      expect.objectContaining({ start: START_MS, limit: LIMIT }),
    );
  });

  it('returns CandleDb[] on success', async () => {
    mockBitget.mockResolvedValue(CANDLES_REVERSED);
    const result = await bitgetFetchLastCandles({ exchange: 'bitget', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockBitget.mockResolvedValue('Bad response');
    const result = await bitgetFetchLastCandles({ exchange: 'bitget', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// bybitFetchLastCandles
// ---------------------------------------------------------------------------
describe('bybitFetchLastCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls bybitFetchCandles with correct startMs and limit', async () => {
    mockBybit.mockResolvedValue([]);
    await bybitFetchLastCandles({ exchange: 'bybit', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(mockBybit).toHaveBeenCalledWith(expect.any(String), expect.any(String), START_MS, LIMIT);
  });

  it('returns CandleDb[] on success', async () => {
    mockBybit.mockResolvedValue(CANDLES_REVERSED);
    const result = await bybitFetchLastCandles({ exchange: 'bybit', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns error string on fetch error', async () => {
    mockBybit.mockResolvedValue('Bad response');
    const result = await bybitFetchLastCandles({ exchange: 'bybit', synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT });
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// fetchLastCandles — dispatcher
// ---------------------------------------------------------------------------
describe('fetchLastCandles dispatcher', () => {
  beforeEach(() => jest.clearAllMocks());

  const params = { synonym: 'BTC/USDT', timeframe: TF, limit: LIMIT };

  it.each([
    ['binance', mockBinance],
    ['okx', mockOkx],
    ['kucoin', mockKucoin],
    ['htx', mockHtx],
    ['poloniex', mockPoloniex],
    ['gateio', mockGateio],
    ['mexc', mockMexc],
    ['bitget', mockBitget],
    ['bybit', mockBybit],
  ])('routes %s to the correct adapter', async (exchange, mock) => {
    (mock as jest.Mock).mockResolvedValue([]);
    await fetchLastCandles({ exchange, ...params });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('returns error string for unknown exchange', async () => {
    const result = await fetchLastCandles({ exchange: 'unknown_exchange', ...params });
    expect(typeof result).toBe('string');
    expect(result).toContain('unknown_exchange');
  });

  it('sorts result oldest-first', async () => {
    mockBinance.mockResolvedValue(CANDLES_REVERSED);
    const result = await fetchLastCandles({ exchange: 'binance', ...params });
    expect(Array.isArray(result)).toBe(true);
    const times = (result as CandleDb[]).map((c) => c.time.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('propagates error string from adapter', async () => {
    mockBinance.mockResolvedValue('API error');
    const result = await fetchLastCandles({ exchange: 'binance', ...params });
    expect(typeof result).toBe('string');
  });

  it('returns [] when adapter returns empty array', async () => {
    mockBinance.mockResolvedValue([]);
    const result = await fetchLastCandles({ exchange: 'binance', ...params });
    expect(result).toEqual([]);
  });
});
