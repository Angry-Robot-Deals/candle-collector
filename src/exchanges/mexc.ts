import { Logger } from '@nestjs/common';
import { fetchJsonSafe, toExchangeSymbol } from '../fetch-json-safe';
import { getCandleHumanTime, getCandleTime } from '../timeseries';
import { timeframeMSeconds } from '../timeseries.constant';
import { getStartFetchTime } from '../app.constant';
import { TIMEFRAME } from '../timeseries.interface';
import { CandleDb } from '../interface';
import { MEXC_TIMEFRAME, OHLCV_Mexc } from './mexc.interface';

/** MEXC API expects symbol without separator, e.g. BTCUSDT. */
function toMexcSymbol(synonym: string): string {
  return toExchangeSymbol.noSeparator(synonym);
}

function getCandleURI(data: {
  symbol: string;
  timeframe: keyof typeof MEXC_TIMEFRAME;
  start: number;
  end: number;
  limit: number;
}): string {
  const { symbol, timeframe, start, end, limit } = data;
  return `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&startTime=${start}&endTime=${end}&limit=${limit}`;
}

async function fetchCandles(data: {
  synonym: string;
  timeframe: keyof typeof MEXC_TIMEFRAME;
  start: number; // milliseconds, include a candle with this value
  end: number; // milliseconds, include a candle with this value
  limit: number; // milliseconds, include a candle with this value
}): Promise<OHLCV_Mexc[] | string> {
  const symbol = toMexcSymbol(data.synonym);
  const { timeframe, start, end, limit } = data;
  const url = getCandleURI({ symbol, timeframe, start, end, limit });

  const { data: res, error } = await fetchJsonSafe<unknown>(url, 'fetchCandles.mexc');

  if (error || res == null) {
    return error || 'Bad response';
  }
  if (!Array.isArray(res)) {
    Logger.error(`[mexc] bad response (not array): ${url} ${JSON.stringify(res).slice(0, 200)}`, 'fetchCandles.mexc');
    return `Bad response ${JSON.stringify(res || {})}`;
  }

  return res as OHLCV_Mexc[];
}

export async function mexcFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | string> {
  const synonym = toMexcSymbol(data.synonym);
  const timeframe = MEXC_TIMEFRAME[data.timeframe];

  const limit = 999;

  let start = getCandleTime(data.timeframe, new Date(getStartFetchTime(data.timeframe).getTime()).getTime());

  // add 64 candles to start
  let end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  while (start < end) {
    Logger.debug(
      `[mexc] find first candle ${synonym} ${data.timeframe} start ${new Date(start).toISOString()} end ${new Date(end).toISOString()}`,
      'mexcFindFirstCandle',
    );

    const candles = await fetchCandles({ synonym, timeframe, start, end, limit });
    if (typeof candles === 'string') {
      return candles;
    }

    if (candles?.length) {
      try {
        const minTime = Math.min(...candles.map((candle: OHLCV_Mexc) => +candle[0]));

        const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);

        Logger.log(
          `[mexc] ${synonym} first candle time ${firstCandleTime.getTime()}, ${firstCandleTime.toISOString()}`,
        );

        return firstCandleTime;
      } catch (err) {
        return `[mexc] Error parse first candle time: ${err.message}`;
      }
    }

    start = start + limit * timeframeMSeconds(data.timeframe);
    end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function mexcFetchCandles(data: {
  synonym: string;
  timeframe: TIMEFRAME;
  start: number; // milliseconds, include a candle with this value
  end: number; // milliseconds, include a candle with this value
  limit: number; // milliseconds, include a candle with this value
}): Promise<CandleDb[] | string> {
  const timeframe = MEXC_TIMEFRAME[data.timeframe];

  const candles = await fetchCandles({ ...data, timeframe });
  if (typeof candles === 'string') {
    return candles;
  }

  if (!candles.length) {
    return [];
  }

  return candles.map((candle: OHLCV_Mexc) => mexcCandleToCandleModel(candle));
}

function mexcCandleToCandleModel(candle: OHLCV_Mexc): CandleDb {
  return {
    time: new Date(candle[0]),
    open: +candle[1],
    high: +candle[2],
    low: +candle[3],
    close: +candle[4],
    volume: +candle[5],
    trades: 0,
  };
}
