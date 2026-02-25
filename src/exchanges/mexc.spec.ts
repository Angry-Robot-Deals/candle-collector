import { TIMEFRAME } from '../timeseries.interface';
import { mexcFetchCandles, mexcFindFirstCandle } from './mexc';
import { OHLCV_Mexc } from './mexc.interface';

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

// [openTime_ms, open, high, low, close, vol, closeTime_ms, quoteVol]
const SAMPLE_CANDLE: OHLCV_Mexc = [1704067200000, '42000.5', '42500.0', '41800.0', '42200.0', '150.123', 1704067259999, '6310000.0'];

describe('mexcFetchCandles — mapper', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps all fields correctly', async () => {
    mockFetch.mockResolvedValue({ data: [SAMPLE_CANDLE], error: null });

    const result = await mexcFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000, limit: 100 });

    expect(Array.isArray(result)).toBe(true);
    const candle = (result as any[])[0];
    expect(candle.time).toEqual(new Date(1704067200000));
    expect(candle.open).toBe(42000.5);
    expect(candle.high).toBe(42500.0);
    expect(candle.low).toBe(41800.0);
    expect(candle.close).toBe(42200.0);
    expect(candle.volume).toBe(150.123);
    expect(candle.trades).toBe(0);
  });

  it('returns empty array for empty response', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    const result = await mexcFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000, limit: 100 });

    expect(result).toEqual([]);
  });

  it('returns error string on fetch error', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'Invalid symbol' });

    const result = await mexcFetchCandles({ synonym: 'FAKE/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000, limit: 100 });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid symbol');
  });

  it('returns error string when response is not array', async () => {
    mockFetch.mockResolvedValue({ data: { code: -1121, msg: 'Invalid symbol' } as any, error: null });

    const result = await mexcFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000, limit: 100 });

    expect(typeof result).toBe('string');
  });

  it('includes symbol without separator in URL', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    await mexcFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200000, end: 1704153600000, limit: 100 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('symbol=BTCUSDT');
    expect(calledUrl).not.toContain('BTC/USDT');
    expect(calledUrl).not.toContain('BTC-USDT');
  });

  it('uses H1 granularity as 60m not 1h', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    await mexcFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.H1, start: 1704067200000, end: 1704153600000, limit: 100 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('interval=60m');
  });
});

describe('mexcFindFirstCandle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns Date when candles found', async () => {
    mockFetch.mockResolvedValue({ data: [SAMPLE_CANDLE], error: null });

    const result = await mexcFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeInstanceOf(Date);
  });

  it('returns null when time range exhausted', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    const result = await mexcFindFirstCandle({ synonym: 'NEWCOIN/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeNull();
  });

  it('returns error string when Invalid symbol error occurs', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'Invalid symbol' });

    const result = await mexcFindFirstCandle({ synonym: 'FAKE/USDT', timeframe: TIMEFRAME.D1 });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid symbol');
  });
});
