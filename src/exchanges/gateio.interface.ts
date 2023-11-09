import { TIMEFRAME } from "../timeseries.interface";

// [
//   [
//     "1539852480",
//     "971519.677",
//     "0.0021724",
//     "0.0021922",
//     "0.0021724",
//     "0.0021737"
//   ]
// ]
// RESPONSE:
// - Unix timestamp in seconds
// - Quote currency trading volume
// - Close price
// - Highest price
// - Lowest price
// - Open price
// - Base currency trading amount

export type OHLCV_Gateio = [
  string, // Unix timestamp in seconds
  string, // Quote currency trading volume
  string, // Close price
  string, // Highest price
  string, // Lowest price
  string, // Open price
  string, // Base currency trading amount
];

export const GATEIO_TIMEFRAME = {
  [TIMEFRAME.M1]: '1m',
  [TIMEFRAME.M5]: '5m',
  [TIMEFRAME.M15]: '15m',
  [TIMEFRAME.H1]: '1h',
  [TIMEFRAME.D1]: '1d',
  [TIMEFRAME.MN1]: '30d',
};
