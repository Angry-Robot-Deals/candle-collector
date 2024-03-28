import { TIMEFRAME } from '../timeseries.interface';

// [
//   [
//     "1545904980", //Start time of the candle cycle
//     "0.058", //opening price
//     "0.049", //closing price
//     "0.058", //highest price
//     "0.049", //lowest price
//     "0.018", //Transaction volume
//     "0.000945" //Transaction amount
//   ],
//   ["1545904920", "0.058", "0.072", "0.072", "0.058", "0.103", "0.006986"]
// ]

export type OHLCV_Kucoin = [
  string, //Start time of the candle cycle
  string, //opening price
  string, //closing price
  string, //highest price
  string, //lowest price
  string, //Transaction volume
  string, //Transaction amount
];

// 1min, 3min, 5min, 15min, 30min, 1hour, 2hour, 4hour, 6hour, 8hour, 12hour, 1day, 1week, 1month
export const KUCOIN_TIMEFRAME = {
  [TIMEFRAME.M1]: '1min',
  [TIMEFRAME.M5]: '5min',
  [TIMEFRAME.M15]: '15min',
  [TIMEFRAME.H1]: '1hour',
  [TIMEFRAME.D1]: '1day',
  [TIMEFRAME.MN1]: '1month',
};
