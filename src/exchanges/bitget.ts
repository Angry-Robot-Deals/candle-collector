import { Logger } from '@nestjs/common';
import { fetchJsonSafe, toExchangeSymbol } from '../fetch-json-safe';
import { getCandleHumanTime, getCandleTime } from '../timeseries';
import { timeframeMSeconds } from '../timeseries.constant';
import { getStartFetchTime } from '../app.constant';
import { TIMEFRAME } from '../timeseries.interface';
import { CandleDb } from '../interface';
import { BITGET_TIMEFRAME, OHLCV_Bitget } from './bitget.interface';

const BITGET_BASE_URL = 'https://api.bitget.com';
/** Candles older than 90 days must use the /history-candles endpoint. */
const HISTORY_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
/** history-candles endpoint max limit is 200; candles endpoint allows up to 1000. */
const HISTORY_CANDLES_MAX_LIMIT = 200;

/** Bitget API expects symbol without separator, e.g. BTCUSDT. */
function toBitgetSymbol(synonym: string): string {
  return toExchangeSymbol.noSeparator(synonym);
}

function getCandleURI(data: {
  symbol: string;
  granularity: string;
  start: number; // milliseconds
  end: number; // milliseconds
  limit: number;
}): string {
  const { symbol, granularity, start, end } = data;
  const isHistory = start < Date.now() - HISTORY_THRESHOLD_MS;
  const endpoint = isHistory ? 'history-candles' : 'candles';
  const limit = isHistory ? Math.min(data.limit, HISTORY_CANDLES_MAX_LIMIT) : data.limit;
  return `${BITGET_BASE_URL}/api/v2/spot/market/${endpoint}?symbol=${symbol}&granularity=${granularity}&startTime=${start}&endTime=${end}&limit=${limit}`;
}

async function fetchCandles(data: {
  synonym: string;
  granularity: string;
  start: number; // milliseconds
  end: number; // milliseconds
  limit: number;
}): Promise<OHLCV_Bitget[] | string> {
  const symbol = toBitgetSymbol(data.synonym);
  const { granularity, start, end, limit } = data;
  const url = getCandleURI({ symbol, granularity, start, end, limit });

  const { data: res, error } = await fetchJsonSafe<{ code?: string; msg?: string; data?: OHLCV_Bitget[] }>(
    url,
    'fetchCandles.bitget',
  );

  if (error || res == null) {
    return error || '[bitget] Bad response';
  }

  if (res?.code !== '00000' || !Array.isArray(res?.data)) {
    Logger.error(`[bitget] bad response ${url} ${JSON.stringify(res).slice(0, 200)}`, 'fetchCandles.bitget');
    return `[bitget] Bad response code=${res?.code} msg=${res?.msg}`;
  }

  return res.data;
}

export async function bitgetFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const synonym = toBitgetSymbol(data.synonym);
  const granularity = BITGET_TIMEFRAME[data.timeframe];
  const limit = 1000;

  let start = getCandleTime(data.timeframe, getStartFetchTime(data.timeframe).getTime());
  let end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  while (start < end) {
    Logger.debug(
      `[bitget] find first candle ${synonym} ${data.timeframe} start ${new Date(start).toISOString()} end ${new Date(end).toISOString()}`,
      'bitgetFindFirstCandle',
    );

    const candles = await fetchCandles({ synonym, granularity, start, end, limit });
    if (typeof candles === 'string') {
      Logger.error(`[bitget] findFirstCandle error: ${candles}`, 'bitgetFindFirstCandle');
      return null;
    }

    if (candles?.length) {
      try {
        const minTime = Math.min(...candles.map((candle: OHLCV_Bitget) => +candle[0]));
        const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);
        Logger.log(
          `[bitget] ${synonym} first candle time ${firstCandleTime.getTime()}, ${firstCandleTime.toISOString()}`,
          'bitgetFindFirstCandle',
        );
        return firstCandleTime;
      } catch (err) {
        Logger.error(`[bitget] Error parse first candle time: ${err.message}`, 'bitgetFindFirstCandle');
        return null;
      }
    }

    start = start + limit * timeframeMSeconds(data.timeframe);
    end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function bitgetFetchCandles(data: {
  synonym: string;
  timeframe: TIMEFRAME;
  start: number; // milliseconds
  end: number; // milliseconds
  limit?: number;
}): Promise<CandleDb[] | string> {
  const granularity = BITGET_TIMEFRAME[data.timeframe];
  const limit = data.limit ?? 1000;

  const candles = await fetchCandles({ synonym: data.synonym, granularity, start: data.start, end: data.end, limit });
  if (typeof candles === 'string') {
    return candles;
  }

  if (!candles.length) {
    return [];
  }

  return candles.map(bitgetCandleToCandleModel);
}

export function bitgetCandleToCandleModel(candle: OHLCV_Bitget): CandleDb {
  return {
    time: new Date(+candle[0]),
    open: +candle[1],
    high: +candle[2],
    low: +candle[3],
    close: +candle[4],
    volume: +candle[5],
    trades: 0,
  };
}
