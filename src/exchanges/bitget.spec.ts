import { TIMEFRAME } from '../timeseries.interface';
import { bitgetCandleToCandleModel, bitgetFetchCandles, bitgetFindFirstCandle } from './bitget';
import { OHLCV_Bitget } from './bitget.interface';

jest.mock('../fetch-json-safe', () => ({
  fetchJsonSafe: jest.fn(),
  toExchangeSymbol: {
    noSeparator: (s: string) => s.replace(/\//g, ''),
    underscore: (s: string) => s.replace(/\//g, '_'),
    hyphen: (s: string) => s.replace(/\//g, '-'),
  },
}));

// Mock Logger to suppress output during tests
jest.mock('@nestjs/common', () => ({
  Logger: { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { fetchJsonSafe } from '../fetch-json-safe';
const mockFetch = fetchJsonSafe as jest.MockedFunction<typeof fetchJsonSafe>;

const SAMPLE_CANDLE: OHLCV_Bitget = ['1704067200000', '42000.5', '42500.0', '41800.0', '42200.0', '150.123', '6310000.0'];

describe('bitgetCandleToCandleModel', () => {
  it('maps all fields correctly', () => {
    const result = bitgetCandleToCandleModel(SAMPLE_CANDLE);

    expect(result.time).toEqual(new Date(1704067200000));
    expect(result.open).toBe(42000.5);
    expect(result.high).toBe(42500.0);
    expect(result.low).toBe(41800.0);
    expect(result.close).toBe(42200.0);
    expect(result.volume).toBe(150.123);
    expect(result.trades).toBe(0);
  });

  it('parses string numbers to floats', () => {
    const candle: OHLCV_Bitget = ['1000000000000', '1.23456789', '2.0', '0.5', '1.5', '999.99', '12345.0'];
    const result = bitgetCandleToCandleModel(candle);

    expect(typeof result.open).toBe('number');
    expect(typeof result.high).toBe('number');
    expect(result.open).toBe(1.23456789);
  });
});

describe('bitgetFetchCandles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns CandleDb array on success', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [SAMPLE_CANDLE, SAMPLE_CANDLE] },
      error: null,
    });

    const result = await bitgetFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000 });

    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(2);
    expect((result as any[])[0].open).toBe(42000.5);
  });

  it('returns empty array when data is empty', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [] },
      error: null,
    });

    const result = await bitgetFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000 });

    expect(result).toEqual([]);
  });

  it('returns error string on network error', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'Network timeout' });

    const result = await bitgetFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000 });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('Network timeout');
  });

  it('returns error string on non-00000 response code', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '40001', msg: 'symbol does not exist', data: null },
      error: null,
    });

    const result = await bitgetFetchCandles({ synonym: 'INVALID/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000 });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('40001');
  });

  it('returns error string when data field is not an array', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: null as any },
      error: null,
    });

    const result = await bitgetFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000 });

    expect(typeof result).toBe('string');
  });

  it('uses custom limit when provided', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [SAMPLE_CANDLE] },
      error: null,
    });

    await bitgetFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.H1, start: 1704067200000, end: 1704153600000, limit: 500 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=500');
  });
});

describe('bitgetFindFirstCandle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns Date when first candle is found', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [SAMPLE_CANDLE] },
      error: null,
    });

    const result = await bitgetFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1 });

    expect(result).toBeInstanceOf(Date);
  });

  it('returns null when no candles exist (walks to end of time range)', async () => {
    // Return empty data to make the loop exhaust
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [] },
      error: null,
    });

    const result = await bitgetFindFirstCandle({ synonym: 'NEWCOIN/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'Connection refused' });

    const result = await bitgetFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeNull();
  });

  it('selects history-candles endpoint for old start dates', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [SAMPLE_CANDLE] },
      error: null,
    });

    await bitgetFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.D1 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    // D1 start is 2017-01-01, well beyond 90 days
    expect(calledUrl).toContain('history-candles');
  });

  it('uses candles endpoint for start dates within 90 days', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '00000', msg: 'success', data: [SAMPLE_CANDLE] },
      error: null,
    });

    // Use M1 and a very recent start time (within 90 days)
    const recentStart = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago

    // Directly test the URL selection by calling fetchCandles through bitgetFetchCandles
    await bitgetFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: recentStart, end: Date.now() });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/candles?');
    expect(calledUrl).not.toContain('history-candles');
  });
});
