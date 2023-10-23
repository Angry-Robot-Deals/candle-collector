import { BINANCE_TIMEFRAME, OKX_TIMEFRAME } from './exchange.constant';
import { Logger } from '@nestjs/common';
import { binanceCandleToCandleModel, okxCandleToCandleModel } from './exchange-dto';
import { OHLCV_Binance, OHLCV_Okx } from './interface';
import { TIMEFRAME } from './timeseries.interface';
import { timeframeMSeconds } from './timeseries.constant';
import { getCandleTime } from './timeseries';

export async function binanceFetchCandles(
  synonym: string,
  timeframe: keyof typeof BINANCE_TIMEFRAME,
  start?: number,
  limit?: number,
): Promise<any[] | string> {
  const candles: any = await fetch(
    `https://api4.binance.com/api/v3/uiKlines?symbol=${synonym}&interval=${timeframe}&limit=${limit || 64}&startTime=${
      start || 1
    }`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`);
      return null;
    });

  if (!candles) {
    return 'No candles';
  }

  return candles.map((candle: OHLCV_Binance) => binanceCandleToCandleModel(candle));
}

export async function okxFetchCandles(
  synonym: string,
  timeframe: keyof typeof OKX_TIMEFRAME,
  start: number, // milliseconds, include a candle with this value
  limit: number, // milliseconds, include a candle with this value
): Promise<any[] | string> {
  const candles: any = await fetch(
    `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${
      start - 1
    }&limit=${limit}`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`);
      return null;
    });

  if (!candles?.data || candles?.code !== '0') {
    return `Bad response ${JSON.stringify(candles || {})}`;
  }

  if (!candles.data?.length) {
    return [];
  }

  return candles.data.map((candle: OHLCV_Okx) => okxCandleToCandleModel(candle));
}

export async function binanceFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const { synonym } = data;
  // const synonym = 'BTC-USDT';
  const timeframe = BINANCE_TIMEFRAME[data.timeframe];

  let start = new Date('2017-01-01T00:00:00.000Z').getTime();
  // add 64 candles to start
  let end = Math.min(start + 1000 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  const now = new Date().getTime();

  while (start < now && start < end) {
    // const res: any = await fetch(
    //   `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${start - 1}&before=${
    //     end + 1
    //   }`,
    // )
    const res: any = await fetch(
      `https://api4.binance.com/api/v3/uiKlines?symbol=${synonym}&interval=${timeframe}&limit=3&startTime=${start}`,
    )
      .then((res) => res.json())
      .catch((e) => {
        Logger.error(`Error fetch candles: ${e.message}`);
        return null;
      });

    // console.log(
    //   `https://api4.binance.com/api/v3/uiKlines?symbol=${synonym}&interval=${timeframe}&limit=3&startTime=${start}`,
    //   res?.data?.length,
    // );

    if (res?.length) {
      const firstCandleTime = new Date(+res.data[0]);
      Logger.log(`[binance] ${synonym} first candle time ${firstCandleTime}`);
      return firstCandleTime;
    }

    start = start + 64 * timeframeMSeconds(data.timeframe);
    end = Math.min(start + 64 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function okxFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const { synonym } = data;
  // const synonym = 'BTC-USDT';
  const timeframe = OKX_TIMEFRAME[data.timeframe];

  let start = new Date('2017-01-01T00:00:00.000Z').getTime();
  // let start = getCandleTime(data.timeframe, Date.now()) - 100 * timeframeMSeconds(data.timeframe);
  // let start = getCandleTime(data.timeframe, 1517443200000) - 100 * timeframeMSeconds(data.timeframe);

  // add 64 candles to start
  let end = Math.min(start + 300 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  const now = new Date().getTime();

  while (start < now && start < end) {
    // const res: any = await fetch(
    //   `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${start - 1}&before=${
    //     end + 1
    //   }`,
    // )
    const res: any = await fetch(
      `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${start}&limit=3`,
    )
      .then((res) => res.json())
      .catch((e) => {
        Logger.error(`Error fetch candles: ${e.message}`);
        return null;
      });

    // console.log(
    //   `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${start}&before=${end}&limit=3`,
    //   res?.data?.length,
    // );

    if (res?.code === '0' && res?.data?.length) {
      const firstCandleTime = new Date(+res.data[0][0]);
      Logger.log(`[okx] ${synonym} first candle time ${firstCandleTime}`);
      return firstCandleTime;
    }

    start = start + 64 * timeframeMSeconds(data.timeframe);
    end = Math.min(start + 64 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}
