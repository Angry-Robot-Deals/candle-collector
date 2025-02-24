import { TIMEFRAME } from './timeseries.interface';

export const ENABLED_EXCHANGES: string[] = [
  'binance',
  'okx',
  'poloniex',
  'bybit',
  'mexc',
  'gateio',
  'kucoin',
  'htx',
  'bitget',
];
export const TOP_COIN_EXCHANGES: string[] = ['binance', 'okx', 'poloniex', 'bybit', 'mexc', 'kucoin', 'htx', 'bitget'];

export const BINANCE_TIMEFRAME = {
  [TIMEFRAME.M1]: '1m',
  [TIMEFRAME.M15]: '15m',
  [TIMEFRAME.H1]: '1h',
  [TIMEFRAME.D1]: '1d',
};

export const OKX_TIMEFRAME = {
  [TIMEFRAME.M1]: '1m',
  [TIMEFRAME.M15]: '15m',
  [TIMEFRAME.H1]: '1H',
  [TIMEFRAME.D1]: '1Dutc',
};

export const COINBASE_TIMEFRAME = {
  [TIMEFRAME.M1]: '1min',
  [TIMEFRAME.M15]: '15min',
  [TIMEFRAME.H1]: '1hour',
  [TIMEFRAME.D1]: '1day',
};

export const HTX_TIMEFRAME = {
  [TIMEFRAME.M1]: '1min',
  [TIMEFRAME.M15]: '15min',
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

export const STABLES = [
  'USDT',
  'USDC',
  'BUSD',
  'DAI',
  'USDP',
  'TUSD',
  'USDD',
  'USDN',
  'FEI',
  'USTC',
  'GUSD',
  'TRIBE',
  'FRAX',
  'HUSD',
  'LUSD',
  'EURS',
  'vUSDC',
  'USDX',
  'SUSD',
  'vBUSD',
  'VAI',
  'CUSD',
  'XSGD',
  'OUSD',
  'MUSD',
  'CEUR',
  'vUSDT',
  'SBD',
  'RSV',
  'USDK',
  'KRT',
  'BIDR',
  'IDRT',
  'DGD',
  'vDAI',
  'BITCNY',
  'XCHF',
  'EOSDT',
  'DGX',
  'ESD',
  'USDS',
  'USDSB',
  'USDSBE',
  'USDSBT',
  'USDSBN',
  'USDSBS',
  'BAC',
  'ITL',
  'USDP',
  'CUSDT',
  'USDZ',
  'AGEUR',
  'MIM',
  'USDH',
  'DUSD',
  'TRYB',
  'TOR',
  'SEUR',
  'MTR',
  'USDEX',
  'xDAI',
  'DUSD',
  'EURT',
  'USN',
  'USDs',
  'JPYC',
  'MIMATIC',
  'ONC',
  'mCUSD',
  'MUSD',
  'DOLA',
  'WANUSDT',
  'USDR',
  '1GOLD',
  'mCEUR',
  'XSTUSD',
  'FUSD',
  'XUSD',
  'XIDR',
  'ARTH',
  'MXNT',
  'USDI',
  'YUSD',
  'PAR',
  'FUSD',
  'EUROS',
  'JPYC',
  'DPT',
  'USDB',
  'MONEY',
  'ALUSD',
  'CADC',
  'XUSD',
  'IUSDS',
  'IRON',
  'BRCP',
  'COFFIN',
  'KBC',
  'DSD',
  'FLOAT',
  'fUSDT',
  'USX',
  'STATIK',
  'ONEICHI',
  'CUSD',
];
