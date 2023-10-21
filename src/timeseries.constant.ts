import { TIMEFRAME } from './timeseries.interface';

export function timeframeSeconds(timeframe: TIMEFRAME): number {
  switch (timeframe) {
    case TIMEFRAME.M1:
      return 60;
    case TIMEFRAME.M3:
      return 180;
    case TIMEFRAME.M5:
      return 300;
    case TIMEFRAME.M15:
      return 900;
    case TIMEFRAME.M30:
      return 1800;
    case TIMEFRAME.H1:
      return 3600;
    case TIMEFRAME.H2:
      return 7200;
    case TIMEFRAME.H4:
      return 14400;
    case TIMEFRAME.H6:
      return 21600;
    case TIMEFRAME.H8:
      return 28800;
    case TIMEFRAME.H12:
      return 43200;
    case TIMEFRAME.D1:
      return 86400;
    case TIMEFRAME.D3:
      return 259200;
    case TIMEFRAME.W1:
      return 604800;
    case TIMEFRAME.MN1:
      return 2592000;
    case TIMEFRAME.Y1:
      return 31536000;
    default:
      throw new Error(`Unknown timeframe: ${timeframe}`);
  }
}

export function timeframeMSeconds(timeframe: TIMEFRAME): number {
  return timeframeSeconds(timeframe) * 1000;
}

export function timeframeMinutes(timeframe: TIMEFRAME): number {
  return Math.floor(timeframeSeconds(timeframe) / 60);
}
