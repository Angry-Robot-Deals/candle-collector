import { TIMEFRAME } from './timeseries.interface';

export const FETCH_DELAY: number = 1000 * 60 * 60 * 2; // 2 hours
export const CALCULATE_ATHL_PERIOD: number = 1000 * 60 * 60; // 1 hour

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
