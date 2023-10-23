// [
//   [
//     1499040000000,      // Kline open time
//     "0.01634790",       // Open price
//     "0.80000000",       // High price
//     "0.01575800",       // Low price
//     "0.01577100",       // Close price
//     "148976.11427815",  // Volume
//     1499644799999,      // Kline close time
//     "2434.19055334",    // Quote asset volume
//     308,                // Number of trades
//     "1756.87402397",    // Taker buy base asset volume
//     "28.46694368",      // Taker buy quote asset volume
//     "0"                 // Unused field. Ignore.
//   ]
// ]
export type OHLCV_Binance = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export type OHLCV_Okx = [
  string, // timestamp
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  string, // currency volume
  string, // volCcyQuote
  string, // confirm
];

// id	long	The UNIX timestamp in seconds as response id
// amount	float	Accumulated trading volume, in base currency
// count	integer	The number of completed trades
// open	float	The opening price
// close	float	The closing price
// low	float	The low price
// high	float	The high price
// vol	float	Accumulated trading value, in quote currency
export type OHLCV_Huobi = {
  id: number; // timestamp seconds
  open: 49056.37; // open
  close: 49025.51; // close
  low: 49022.86; // low
  high: 49056.38; // high
  amount: 3.946281917950917; // vol in currency
  vol: 193489.67275732; // vol in quote currency
  count: 196; // trades
};

// timestamp, open, high, low, close, volume, ticks/trades
export type OHLCVT = [number, number, number, number, number, number];

export type CandleDb = {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
};
