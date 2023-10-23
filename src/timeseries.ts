import { TIMEFRAME } from './timeseries.interface';
import { timeframeMSeconds } from './timeseries.constant';

export function getLowTimeframe(timeframe: TIMEFRAME | string, shift = 1): TIMEFRAME {
  const i = Object.values(TIMEFRAME).indexOf(timeframe as TIMEFRAME);

  return Object.values(TIMEFRAME)[Math.max(i - shift, 0)];
}

export function getHighTimeframe(timeframe: TIMEFRAME | string, shift = 1): TIMEFRAME {
  const count = Object.values(TIMEFRAME).length;
  const i = Object.values(TIMEFRAME).indexOf(timeframe as TIMEFRAME);

  return Object.values(TIMEFRAME)[Math.min(i + shift, count - 1)];
}

export function getCandleShift(timeframe: TIMEFRAME, time?: Date | number): number {
  let candleTime: number;

  if (typeof time === 'number') {
    candleTime = getCandleTime(timeframe, time);
  } else if (typeof time === 'object') {
    candleTime = getCandleTime(timeframe, time);
  } else if (!time) {
    return 0;
  }

  const now = getCandleTime(timeframe);

  if (now === candleTime) {
    return 0;
  }

  return Math.floor((now - candleTime) / timeframeMSeconds(timeframe));
}

export function getCandleTimeByShift(
  timeframe: TIMEFRAME,
  shift: number, // shift in number of candles
  fromTime: Date | number = undefined,
): number {
  const now = getCandleTime(timeframe, fromTime);

  return now - shift * timeframeMSeconds(timeframe);
}

export function getCandleHumanTime(timeframe: TIMEFRAME, time: Date | number = undefined): Date {
  return new Date(getCandleTime(timeframe, time));
}

export function getCandleTime(timeframe: TIMEFRAME, time: Date | number = undefined): number {
  let now: Date;

  if (typeof time === 'number') {
    now = new Date(time);
  } else if (typeof time === 'object') {
    now = time;
  } else if (!time) {
    now = new Date();
  }

  let candleTime: Date;
  let minutes = now.getMinutes();
  let hours = now.getHours();
  let days = now.getDate();
  const months = now.getMonth();
  const years = now.getFullYear();

  switch (timeframe) {
    case '1m':
      candleTime = new Date(
        years,
        months,
        days,
        hours,
        minutes,
        0,
        0, // milliseconds
      );
      break;
    case '3m':
      if (minutes % 3 !== 0) {
        minutes = Math.floor(minutes / 3) * 3;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        minutes,
        0,
        0, // milliseconds
      );

      break;
    case '5m':
      if (minutes % 5 !== 0) {
        minutes = Math.floor(minutes / 5) * 5;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        minutes,
        0,
        0, // milliseconds
      );

      break;
    case '15m':
      if (minutes % 15 !== 0) {
        minutes = Math.floor(minutes / 15) * 15;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        minutes,
        0,
        0, // milliseconds
      );

      break;
    case '30m':
      if (minutes % 30 !== 0) {
        minutes = Math.floor(minutes / 30) * 30;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        minutes,
        0,
        0, // milliseconds
      );

      break;
    case '1h':
      candleTime = new Date(
        years,
        months,
        days,
        hours,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '2h':
      if (hours % 2 !== 0) {
        hours = Math.floor(hours / 2) * 2;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '4h':
      if (hours % 4 !== 0) {
        hours = Math.floor(hours / 4) * 4;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '6h':
      if (hours % 6 !== 0) {
        hours = Math.floor(hours / 6) * 6;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '8h':
      if (hours % 8 !== 0) {
        hours = Math.floor(hours / 8) * 8;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '12h':
      if (hours % 12 !== 0) {
        hours = Math.floor(hours / 12) * 12;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '1d':
      candleTime = new Date(
        years,
        months,
        days,
        0,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '3d':
      if (days % 3 !== 0) {
        days = Math.floor(days / 3) * 3;
      }

      candleTime = new Date(
        years,
        months,
        days,
        0,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '1w':
      if (days % 7 !== 0) {
        days = Math.floor(days / 7) * 7;
      }

      candleTime = new Date(
        years,
        months,
        days,
        0,
        0,
        0,
        0, // milliseconds
      );

      break;
    case '1M':
      candleTime = new Date(
        years, // year
        months, // month is 0-11
        1, // days
        0, // hours
        0, // minutes
        0, // seconds
        0, // milliseconds
      );

      break;
    default:
      if (minutes % 5 !== 0) {
        minutes = Math.floor(minutes / 5) * 5;
      }

      candleTime = new Date(
        years,
        months,
        days,
        hours,
        minutes,
        0,
        0, // milliseconds
      );

      break;
  }

  return candleTime.getTime();
}

export function getCandleTimestampsByShift(timeframe: TIMEFRAME, sinceShift: number, tillShift?: number): number[] {
  const time = getCandleTime(timeframe, getCandleTimeByShift(timeframe, sinceShift));
  const tillTime = tillShift
    ? getCandleTime(timeframe, getCandleTimeByShift(timeframe, tillShift))
    : getCandleTime(timeframe);

  return getCandleTimestamps(timeframe, time, tillTime);
}

export function getCandleTimestamps(timeframe: TIMEFRAME, since: number, till?: number): number[] {
  const res: number[] = [];
  const sinceTime = getCandleTime(timeframe, since);
  let time = till ? getCandleTime(timeframe, till) : getCandleTime(timeframe);
  const step = timeframeMSeconds(timeframe);

  // timeseries array [now() or till..since time]
  while (time >= sinceTime) {
    res.push(time);
    time -= step;
  }

  return res;
}

export function getFilteredCandleTimestamps(params: {
  timeframe: TIMEFRAME;
  limit: number; // return only this number of candles
  shift?: number; // shift in number of candles from now() or maximumTime
  sort?: 1 | -1; // 1 - ascendant, -1 - descendant. Default: -1
  minimumTime?: number; // filter result by minimum timestamp
  maximumTime?: number; // filter result by maximum timestamp
}): number[] {
  const { timeframe, limit, shift, sort, minimumTime } = params;

  const maxTime = getCandleTime(timeframe, params.maximumTime) - (shift ? shift * timeframeMSeconds(timeframe) : 0);

  if (!isNaN(minimumTime) && minimumTime > maxTime) {
    return [];
  }

  const since = Math.min(Date.now() - 10000 * timeframeMSeconds(timeframe), maxTime, minimumTime || Infinity);

  const times = getCandleTimestamps(timeframe, since, maxTime);

  const filteredTimes = minimumTime && times.length ? times.filter((time) => time >= minimumTime) : times;

  const sortedTimes =
    sort === 1 && filteredTimes.length
      ? filteredTimes.sort((a, b) => {
          return +a - +b; // sort by time
        })
      : filteredTimes;

  return sortedTimes.length && limit < sortedTimes.length ? sortedTimes.slice(0, limit) : sortedTimes;
}
