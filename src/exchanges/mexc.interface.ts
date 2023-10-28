// Index	Description
// 0	Open time
// 1	Open
// 2	High
// 3	Low
// 4	Close
// 5	Volume
// 6	Close time
// 7	Quote asset volume
// [
//   1698364800000,
//   "34151.66",
//   "34245.0",
//   "33397.0",
//   "33892.01",
//   "11752.583103",
//   1698451200000,
//   "3.9935754907E8"
// ]
import { TIMEFRAME } from '../timeseries.interface';

export type OHLCV_Mexc = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  string, // quote asset volume
];

export const MEXC_TIMEFRAME = {
  [TIMEFRAME.M1]: '1m',
  [TIMEFRAME.M5]: '5m',
  [TIMEFRAME.M15]: '15m',
  [TIMEFRAME.H1]: '60m',
  [TIMEFRAME.D1]: '1d',
  [TIMEFRAME.MN1]: '1M',
};
