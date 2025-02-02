import { Logger } from '@nestjs/common';
import { getCandleHumanTime, getCandleTime } from '../timeseries';
import { getStartFetchTime } from '../app.constant';
import { timeframeSeconds } from '../timeseries.constant';
import { TIMEFRAME } from '../timeseries.interface';
import { CandleDb } from '../interface';
import { GATEIO_TIMEFRAME, OHLCV_Gateio } from './gateio.interface';

function getCandleURI(data: {
  synonym: string;
  timeframe: keyof typeof GATEIO_TIMEFRAME;
  start: number; // seconds, include a candle with this value
  end: number; // seconds, include a candle with this value
}): string {
  const { synonym, timeframe, start, end } = data;

  return `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${synonym}&interval=${timeframe}&from=${start}&to=${end}`;
}

async function fetchCandles(data: {
  synonym: string;
  timeframe: keyof typeof GATEIO_TIMEFRAME;
  start: number; // seconds, include a candle with this value
  end: number; // seconds, include a candle with this value
}): Promise<OHLCV_Gateio[] | string> {
  const { synonym, timeframe, start, end } = data;

  // console.log(getCandleURI({ synonym, timeframe, start, end }));

  return await fetch(getCandleURI({ synonym, timeframe, start, end }))
    .then((res) => res.json())
    .then((res) => {
      if (!res || !Array.isArray(res)) {
        Logger.error(
          `[gateio] bad response: ${getCandleURI({ synonym, timeframe, start, end })}`,
          'fetchCandles.gateio',
        );

        return `Bad response ${JSON.stringify(res || {})}`;
      }

      return res;
    })
    .catch((err) => {
      Logger.error(`[gateio] Error fetch candles: ${err.message}`, 'fetchCandles.gateio');

      return err.message;
    });
}

export async function gateioFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | string> {
  const { synonym } = data;
  const timeframe = GATEIO_TIMEFRAME[data.timeframe];

  const limit = 500;

  let start = Math.ceil(getCandleTime(data.timeframe, getStartFetchTime(data.timeframe).getTime()) / 1000);
  let end = Math.min(
    start + limit * timeframeSeconds(data.timeframe),
    Math.ceil(getCandleTime(data.timeframe, Date.now()) / 1000),
  );

  while (start < end) {
    const candles = await fetchCandles({ synonym, timeframe, start, end });
    if (typeof candles === 'string') {
      return candles;
    }

    if (candles?.length) {
      try {
        const minTime = Math.min(...candles.map((candle: OHLCV_Gateio) => +candle[0] * 1000));

        const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);

        Logger.log(
          `[gateio] ${synonym} first candle time ${firstCandleTime.getTime()}, ${firstCandleTime.toISOString()}`,
          'gateioFindFirstCandle',
        );

        return firstCandleTime;
      } catch (err) {
        return `[gateio] Error parse first candle time: ${err.message}`;
      }
    }

    start = start + limit * timeframeSeconds(data.timeframe);
    end = Math.min(
      start + limit * timeframeSeconds(data.timeframe),
      Math.ceil(getCandleTime(data.timeframe, Date.now()) / 1000),
    );

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function gateioFetchCandles(data: {
  synonym: string;
  timeframe: TIMEFRAME;
  start: number; // seconds, include a candle with this value
  end: number; // seconds, include a candle with this value
}): Promise<CandleDb[] | string> {
  const timeframe = GATEIO_TIMEFRAME[data.timeframe];

  const candles = await fetchCandles({ ...data, timeframe });
  if (typeof candles === 'string') {
    return candles;
  }

  if (!candles.length) {
    return [];
  }

  return candles.map((candle: OHLCV_Gateio) => gateioCandleToCandleModel(candle));
}

function gateioCandleToCandleModel(candle: OHLCV_Gateio): CandleDb {
  return {
    time: new Date(+candle[0] * 1000),
    open: +candle[5],
    high: +candle[3],
    low: +candle[4],
    close: +candle[2],
    volume: +candle[6],
    trades: 0,
  };
}
