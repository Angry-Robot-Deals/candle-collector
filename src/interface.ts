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

// [
//   "1757.25",
//   "1848.17",
//   "1763.05",
//   "1828.9",
//   "7432850.54",
//   "4114.942304",
//   "3892188.09",
//   "2153.241905",
//   13412,
//   1698145627344,
//   "1806.55",
//   "DAY_1",
//   1698105600000,
//   1698191999999
// ]
// low	String	lowest price over the interval
// high	String	highest price over the interval
// open	String	price at the start time
// close	String	price at the end time
// amount	String	quote units traded over the interval
// quantity	String	base units traded over the interval
// buyTakerAmount	String	quote units traded over the interval filled by market buy orders
// buyTakerQuantity	String	base units traded over the interval filled by market buy orders
// tradeCount	Integer	count of trades
// ts	Long	time the record was pushed
// weightedAverage	String	weighted average over the interval
// interval	String	the selected interval
// startTime	Long	start time of interval
// closeTime	Long	close time of interval
export type OHLCV_Poloniex = [
  string, // low
  string, // high
  string, // open
  string, // close
  string, // amount - quote volume
  string, // quantity - coin volume
  string, // buyTakerQuantity
  string, // buyTakerAmount
  number, // tradeCount
  number, // ts
  string, // weightedAverage
  string, // interval
  number, // startTime
  number, // closeTime
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

// list	array
// An string array of individual candle
// Sort in reverse by startTime
// > list[0]: startTime	string	Start time of the candle (ms)
// > list[1]: openPrice	string	Open price
// > list[2]: highPrice	string	Highest price
// > list[3]: lowPrice	string	Lowest price
// > list[4]: closePrice	string	Close price. Is the last traded price when the candle is not closed
// > list[5]: volume	string	Trade volume. Unit of contract: pieces of contract. Unit of spot: quantity of coins
// > list[6]: turnover	string	Turnover. Unit of figure: quantity of quota coin
export type OHLCV_Bybit = [
  string, // timestamp
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  string, // quote volume
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
