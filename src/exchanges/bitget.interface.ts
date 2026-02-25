import { TIMEFRAME } from '../timeseries.interface';

// Response data array per candle:
// [ts, open, high, low, close, baseVol, quoteVol]
// ts       — open timestamp, Unix ms (string)
// open     — opening price (string)
// high     — highest price (string)
// low      — lowest price (string)
// close    — closing price (string)
// baseVol  — base asset volume (string)
// quoteVol — quote asset volume (string)
export type OHLCV_Bitget = [
  string, // timestamp ms
  string, // open
  string, // high
  string, // low
  string, // close
  string, // base asset volume
  string, // quote asset volume
];

// Bitget v2 spot candles granularity values (must match API enum exactly)
export const BITGET_TIMEFRAME = {
  [TIMEFRAME.M1]: '1min',
  [TIMEFRAME.M5]: '5min',
  [TIMEFRAME.M15]: '15min',
  [TIMEFRAME.H1]: '1h',
  [TIMEFRAME.D1]: '1day',
};
