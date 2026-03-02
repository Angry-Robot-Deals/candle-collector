import { TIMEFRAME } from './timeseries.interface';

export const MIN_MSEC: number = 1000 * 60;
export const HOUR_MSEC: number = 1000 * 60 * 60; // 1 hour
export const DAY_MSEC: number = 1000 * 60 * 60 * 24; // 1 day

export const MARKET_UPDATE_TIMEOUT: number = 1000 * 60 * 60 * 24 * 7; // 1 week
/** Max number of top coins (by volume) to sync from CMC into TopCoin table. */
export const TOP_COIN_SYNC_LIMIT = 150;
/** Number of CMC listing pages to fetch (1..N, ~100 coins per page). */
export const CMC_FETCH_PAGES = 100;
/** Delay between CMC page fetches (ms) to avoid rate limit. */
export const CMC_PAGE_DELAY_MS = 1500;
export const FETCH_DELAY: number = 1000 * 60 * 60 * 2; // 2 hours
export const CALCULATE_ATHL_PERIOD: number = 1000 * 60 * 60 * 24; // 1 day

export const START_FETCH_TIME_M1 = new Date('2024-01-01T00:00:00Z');
export const START_FETCH_TIME_M5 = new Date('2023-01-01T00:00:00Z');
export const START_FETCH_TIME_M15 = new Date('2022-01-01T00:00:00Z');
export const START_FETCH_TIME_H1 = new Date('2017-01-01T00:00:00Z');
export const START_FETCH_TIME_D1 = new Date('2017-01-01T00:00:00Z');

export const getStartFetchTime = (timeframe: TIMEFRAME): Date => {
  switch (timeframe) {
    case TIMEFRAME.M1:
      return START_FETCH_TIME_M1;
    case TIMEFRAME.M5:
      return START_FETCH_TIME_M5;
    case TIMEFRAME.M15:
      return START_FETCH_TIME_M15;
    case TIMEFRAME.H1:
      return START_FETCH_TIME_H1;
    case TIMEFRAME.D1:
      return START_FETCH_TIME_D1;
    default:
      return START_FETCH_TIME_M1;
  }
};

export const BAD_SYMBOL_CHARS = ['-', ';', ',', ':', '.', '$', '%', '^', '&', '*'];

/**
 * Maximum candles an exchange returns per request.
 * Used by the state machine to size fetch batches correctly.
 * OKX history-candles endpoint is capped at 100.
 */
export const EXCHANGE_BATCH_LIMIT: Readonly<Record<string, number>> = {
  okx: 100,
};
export const DEFAULT_BATCH_LIMIT = 500;

export function getExchangeBatchLimit(exchangeName: string): number {
  return EXCHANGE_BATCH_LIMIT[exchangeName] ?? DEFAULT_BATCH_LIMIT;
}
