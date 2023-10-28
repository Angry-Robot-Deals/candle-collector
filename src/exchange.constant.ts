import { TIMEFRAME } from './timeseries.interface';

export const ENABLED_EXCHANGES: string[] = ['binance', 'okx', 'poloniex', 'huobi', 'bybit', 'mexc'];

export const BINANCE_TIMEFRAME = {
  [TIMEFRAME.M1]: '1m',
  [TIMEFRAME.D1]: '1d',
};

export const OKX_TIMEFRAME = {
  [TIMEFRAME.M1]: '1m',
  [TIMEFRAME.D1]: '1Dutc',
};

export const COINBASE_TIMEFRAME = {
  [TIMEFRAME.M1]: '1min',
  [TIMEFRAME.D1]: '1day',
};

export const HUOBI_TIMEFRAME = {
  [TIMEFRAME.M1]: '1min',
  [TIMEFRAME.H1]: '60min',
  [TIMEFRAME.D1]: '1day',
  [TIMEFRAME.MN1]: '1mon',
};

export const POLONIEX_TIMEFRAME = {
  [TIMEFRAME.M1]: 'MINUTE_1',
  [TIMEFRAME.M5]: 'MINUTE_5',
  [TIMEFRAME.M15]: 'MINUTE_15',
  [TIMEFRAME.H1]: 'HOUR_1',
  [TIMEFRAME.D1]: 'DAY_1',
  [TIMEFRAME.W1]: 'WEEK_1',
  [TIMEFRAME.MN1]: 'MONTH_1',
};

export const BYBIT_TIMEFRAME = {
  [TIMEFRAME.M1]: '1',
  [TIMEFRAME.M5]: '5',
  [TIMEFRAME.M15]: '15',
  [TIMEFRAME.H1]: '60',
  [TIMEFRAME.D1]: 'D',
  [TIMEFRAME.W1]: 'W',
  [TIMEFRAME.MN1]: 'M',
};
