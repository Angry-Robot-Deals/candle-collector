import { Logger } from '@nestjs/common';
import { getCandleHumanTime, getCandleTime } from '../timeseries';
import { timeframeMSeconds } from '../timeseries.constant';
import { TIMEFRAME } from '../timeseries.interface';
import { CandleDb } from '../interface';
import { getStartFetchTime } from '../app.constant';
import { KUCOIN_TIMEFRAME, OHLCV_Kucoin } from './kucoin.interface';

function getCandleURI(data: {
  synonym: string;
  timeframe: keyof typeof KUCOIN_TIMEFRAME;
  start: number; // milliseconds, include a candle with this value
  end: number; // milliseconds, include a candle with this value
}): string {
  const { synonym, timeframe, start, end } = data;

  return `https://api.kucoin.com/api/v1/market/candles?type=${timeframe}&symbol=${synonym}&startAt=${Math.ceil(start / 1000)}&endAt=${Math.ceil(end / 1000)}`;
}

async function fetchCandles(data: {
  synonym: string;
  timeframe: keyof typeof KUCOIN_TIMEFRAME;
  start: number; // milliseconds, include a candle with this value
  end: number; // milliseconds, include a candle with this value
}): Promise<CandleDb[] | string> {
  const { synonym, timeframe, start, end } = data;

  const URI = getCandleURI({ synonym, timeframe, start, end });
  // console.log(URI);

  return await fetch(URI)
    .then((res) => res.json())
    .then((res: { code: string; data: OHLCV_Kucoin[] }) => {
      if (res?.code !== '200000' || !Array.isArray(res?.data)) {
        Logger.error(`[kucoin] bad response: ${URI}`, 'fetchCandles.kucoin');

        return `Bad response ${JSON.stringify(res || {})}`;
      }

      return res.data.map((candle: OHLCV_Kucoin) => kucoinCandleToCandleModel(candle));
    })
    .catch((err) => {
      Logger.error(`[kucoin] Error fetch candles: ${err.message}`);

      return err.message;
    });
}

export async function kucoinFindFirstCandle(data: {
  synonym: string;
  timeframe: TIMEFRAME;
  startTime?: number; // milliseconds
}): Promise<Date | null> {
  const { synonym, startTime } = data;
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
