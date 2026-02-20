import { Logger } from '@nestjs/common';
import { fetchJsonSafe, toExchangeSymbol } from '../fetch-json-safe';
import { getCandleHumanTime, getCandleTime } from '../timeseries';
import { timeframeMSeconds } from '../timeseries.constant';
import { TIMEFRAME } from '../timeseries.interface';
import { CandleDb } from '../interface';
import { getStartFetchTime } from '../app.constant';
import { KUCOIN_TIMEFRAME, OHLCV_Kucoin } from './kucoin.interface';

/** Kucoin API expects symbol with hyphen, e.g. BTC-USDT. */
function toKucoinSymbol(synonym: string): string {
  return toExchangeSymbol.hyphen(synonym);
}

function getCandleURI(data: {
  symbol: string;
  timeframe: keyof typeof KUCOIN_TIMEFRAME;
  start: number; // milliseconds
  end: number; // milliseconds
}): string {
  const { symbol, timeframe, start, end } = data;
  return `https://api.kucoin.com/api/v1/market/candles?type=${timeframe}&symbol=${symbol}&startAt=${Math.ceil(start / 1000)}&endAt=${Math.ceil(end / 1000)}`;
}

async function fetchCandles(data: {
  synonym: string;
  timeframe: keyof typeof KUCOIN_TIMEFRAME;
  start: number; // milliseconds, include a candle with this value
  end: number; // milliseconds, include a candle with this value
}): Promise<CandleDb[] | string> {
  const symbol = toKucoinSymbol(data.synonym);
  const { timeframe, start, end } = data;
  const uri = getCandleURI({ symbol, timeframe, start, end });

  const { data: res, error } = await fetchJsonSafe<{ code?: string; data?: OHLCV_Kucoin[] }>(uri, 'fetchCandles.kucoin');

  if (error || res == null) {
    return error || 'Bad response';
  }
  if (res?.code !== '200000' || !Array.isArray(res?.data)) {
    Logger.error(`[kucoin] bad response: ${uri} ${JSON.stringify(res || {}).slice(0, 200)}`, 'fetchCandles.kucoin');
    return `Bad response ${JSON.stringify(res || {})}`;
  }

  return res.data.map((candle: OHLCV_Kucoin) => kucoinCandleToCandleModel(candle));
}

export async function kucoinFindFirstCandle(data: {
  synonym: string;
  timeframe: TIMEFRAME;
  startTime?: number; // milliseconds
}): Promise<Date | null> {
  const synonym = toKucoinSymbol(data.synonym);
  const { startTime } = data;
  const timeframe = KUCOIN_TIMEFRAME[data.timeframe];

  const limit = 1499;

  let start = getCandleTime(
    data.timeframe,
    new Date(startTime || getStartFetchTime(data.timeframe).getTime()).getTime(),
  );
  let end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  while (start < end) {
    Logger.debug(
      `[kucoin] find first candle ${synonym} ${data.timeframe} start ${new Date(start).toISOString()} end ${new Date(end).toISOString()}`,
      'kucoinFindFirstCandle',
    );

    const candles = await fetchCandles({ synonym, timeframe, start, end });
    if (typeof candles === 'string') {
      Logger.error(`[kucoin] Error fetch first candle: ${candles}`);
      return null;
    }

    if (candles?.length) {
      try {
        const minTime = Math.min(...candles.map((candle) => candle.time.getTime()));

        const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);

        Logger.log(
          `[kucoin] ${synonym} first candle time ${firstCandleTime.getTime()}, ${firstCandleTime.toISOString()}`,
          'kucoinFindFirstCandle',
        );

        return firstCandleTime;
      } catch (err) {
        Logger.error(`[kucoin] Error parse first candle time: ${err.message}`, 'kucoinFindFirstCandle');
        return null;
      }
    }

    start = start + limit * timeframeMSeconds(data.timeframe);
    end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function kucoinFetchCandles(data: {
  synonym: string;
  timeframe: TIMEFRAME;
  start: number; // seconds, include a candle with this value
  end: number; // seconds, include a candle with this value
}): Promise<CandleDb[] | string> {
  const timeframe = KUCOIN_TIMEFRAME[data.timeframe];

  return fetchCandles({ ...data, timeframe });
}

function kucoinCandleToCandleModel(candle: OHLCV_Kucoin): CandleDb {
  return {
    time: new Date(+candle[0] * 1000),
    open: +candle[1],
    high: +candle[3],
    low: +candle[4],
    close: +candle[2],
    volume: +candle[5],
    trades: +candle[6],
  };
}
