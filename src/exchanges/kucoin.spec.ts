import { TIMEFRAME } from '../timeseries.interface';
import { kucoinFetchCandles, kucoinFindFirstCandle } from './kucoin';
import { OHLCV_Kucoin } from './kucoin.interface';

jest.mock('../fetch-json-safe', () => ({
  fetchJsonSafe: jest.fn(),
  toExchangeSymbol: {
    noSeparator: (s: string) => s.replace(/\//g, ''),
    underscore: (s: string) => s.replace(/\//g, '_'),
    hyphen: (s: string) => s.replace(/\//g, '-'),
  },
}));

jest.mock('@nestjs/common', () => ({
  Logger: { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

import { fetchJsonSafe } from '../fetch-json-safe';
const mockFetch = fetchJsonSafe as jest.MockedFunction<typeof fetchJsonSafe>;

// [startSec, open, close, high, low, vol, amount]
const SAMPLE_CANDLE: OHLCV_Kucoin = ['1704067200', '42000.5', '42200.0', '42500.0', '41800.0', '150.123', '6310000.0'];

describe('kucoinFetchCandles — mapper', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps all fields correctly (note: close=index2, high=index3, low=index4)', async () => {
    mockFetch.mockResolvedValue({
      data: { code: '200000', data: [SAMPLE_CANDLE] },
      error: null,
    });

    const result = await kucoinFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 0, end: Date.now() });

    expect(Array.isArray(result)).toBe(true);
    const candle = (result as any[])[0];
    expect(candle.time).toEqual(new Date(1704067200 * 1000));
    expect(candle.open).toBe(42000.5);
    expect(candle.close).toBe(42200.0);
    expect(candle.high).toBe(42500.0);
    expect(candle.low).toBe(41800.0);
    expect(candle.volume).toBe(150.123);
  });

  it('returns empty array for empty data', async () => {
    mockFetch.mockResolvedValue({ data: { code: '200000', data: [] }, error: null });

    const result = await kucoinFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 0, end: Date.now() });

    expect(result).toEqual([]);
  });

  it('returns error string on non-200000 code', async () => {
    mockFetch.mockResolvedValue({ data: { code: '400000', data: null }, error: null });

    const result = await kucoinFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 0, end: Date.now() });

    expect(typeof result).toBe('string');
  });

  it('returns error string on fetch error', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'timeout' });

    const result = await kucoinFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 0, end: Date.now() });

    expect(typeof result).toBe('string');
  });

  it('uses seconds in request URL (not ms)', async () => {
    mockFetch.mockResolvedValue({ data: { code: '200000', data: [] }, error: null });

    const startMs = 1704067200000;
    const endMs = 1704153600000;
    await kucoinFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: startMs, end: endMs });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('startAt=1704067200');
    expect(calledUrl).toContain('endAt=1704153600');
    expect(calledUrl).not.toContain('1704067200000');
  });
});

describe('kucoinFindFirstCandle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns Date when candles are found', async () => {
    mockFetch.mockResolvedValue({ data: { code: '200000', data: [SAMPLE_CANDLE] }, error: null });

    const result = await kucoinFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeInstanceOf(Date);
  });

  it('returns null when no candles and time exhausted', async () => {
    mockFetch.mockResolvedValue({ data: { code: '200000', data: [] }, error: null });

    const result = await kucoinFindFirstCandle({ synonym: 'NEWCOIN/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeNull();
  });

  it('returns null on error response', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'network error' });

    const result = await kucoinFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeNull();
  });
});
