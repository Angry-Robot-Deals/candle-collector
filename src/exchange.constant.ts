import { TIMEFRAME } from './timeseries.interface';

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
