import { TIMEFRAME } from '../timeseries.interface';
import { gateioFetchCandles, gateioFindFirstCandle } from './gateio';
import { OHLCV_Gateio } from './gateio.interface';

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

// [ts_sec, quoteVol, close, high, low, open, baseVol]
const SAMPLE_CANDLE: OHLCV_Gateio = ['1704067200', '6310000.0', '42200.0', '42500.0', '41800.0', '42000.5', '150.123'];

describe('gateioFetchCandles — mapper', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps all fields correctly (ts in seconds, open=index5, close=index2, high=index3, low=index4)', async () => {
    mockFetch.mockResolvedValue({ data: [SAMPLE_CANDLE], error: null });

    const result = await gateioFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200, end: 1704153600 });

    expect(Array.isArray(result)).toBe(true);
    const candle = (result as any[])[0];
    expect(candle.time).toEqual(new Date(1704067200 * 1000));
    expect(candle.open).toBe(42000.5);
    expect(candle.close).toBe(42200.0);
    expect(candle.high).toBe(42500.0);
    expect(candle.low).toBe(41800.0);
    expect(candle.volume).toBe(150.123); // baseVol at index 6
    expect(candle.trades).toBe(0);
  });

  it('returns empty array for empty response', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    const result = await gateioFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200, end: 1704153600 });

    expect(result).toEqual([]);
  });

  it('returns error string on fetch error', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'INVALID_CURRENCY_PAIR' });

    const result = await gateioFetchCandles({ synonym: 'FAKE/USDT', timeframe: TIMEFRAME.M1, start: 1704067200, end: 1704153600 });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('INVALID_CURRENCY_PAIR');
  });

  it('returns error string on non-array response', async () => {
    mockFetch.mockResolvedValue({ data: { error: 'bad request' } as any, error: null });

    const result = await gateioFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200, end: 1704153600 });

    expect(typeof result).toBe('string');
  });

  it('uses seconds in request URL', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    await gateioFetchCandles({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.M1, start: 1704067200, end: 1704153600 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('from=1704067200');
    expect(calledUrl).toContain('to=1704153600');
  });
});

describe('gateioFindFirstCandle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns Date when candles found', async () => {
    mockFetch.mockResolvedValue({ data: [SAMPLE_CANDLE], error: null });

    const result = await gateioFindFirstCandle({ synonym: 'BTC/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeInstanceOf(Date);
  });

  it('returns null when time range exhausted with empty results', async () => {
    mockFetch.mockResolvedValue({ data: [], error: null });

    const result = await gateioFindFirstCandle({ synonym: 'NEWCOIN/USDT', timeframe: TIMEFRAME.D1 });

    expect(result).toBeNull();
  });

  it('returns error string when INVALID_CURRENCY_PAIR', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'INVALID_CURRENCY_PAIR' });

    const result = await gateioFindFirstCandle({ synonym: 'FAKE/USDT', timeframe: TIMEFRAME.D1 });

    expect(typeof result).toBe('string');
  });
});
