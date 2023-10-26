import { Logger } from '@nestjs/common';
import {
  binanceCandleToCandleModel,
  bybitCandleToCandleModel,
  huobiCandleToCandleModel,
  okxCandleToCandleModel,
  poloniexCandleToCandleModel,
} from './exchange-dto';
import {
  BINANCE_TIMEFRAME,
  BYBIT_TIMEFRAME,
  HUOBI_TIMEFRAME,
  OKX_TIMEFRAME,
  POLONIEX_TIMEFRAME,
} from './exchange.constant';
import { CandleDb, OHLCV_Binance, OHLCV_Bybit, OHLCV_Huobi, OHLCV_Okx, OHLCV_Poloniex } from './interface';
import { timeframeMSeconds } from './timeseries.constant';
import { getCandleHumanTime, getCandleTime } from './timeseries';
import { TIMEFRAME } from './timeseries.interface';

export async function binanceFetchCandles(
  synonym: string,
  timeframe: keyof typeof BINANCE_TIMEFRAME,
  start?: number,
  limit?: number,
): Promise<CandleDb[] | string> {
  const candles: any = await fetch(
    `https://api4.binance.com/api/v3/uiKlines?symbol=${synonym}&interval=${timeframe}&limit=${limit || 64}&startTime=${
      start || 1
    }`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`, 'binanceFetchCandles');
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
  end: number, // milliseconds, include a candle with this value
  limit: number, // milliseconds, include a candle with this value
): Promise<CandleDb[] | string> {
  const candles: any = await fetch(
    `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&before=${start - 1}&after=${
      end + 1
    }&limit=${limit}`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`);
      return null;
    });

  // console.log(
  //   candles?.data?.length,
  //   `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&before=${start - 1}&after=${
  //     end + 1
  //   }&limit=${limit}`,
  // );

  if (!candles?.data || candles?.code !== '0') {
    return `Bad response ${JSON.stringify(candles || {})}`;
  }

  if (!candles.data?.length) {
    return [];
  }

  return candles.data.map((candle: OHLCV_Okx) => okxCandleToCandleModel(candle));
}

export async function poloniexFetchCandles(
  synonym: string,
  timeframe: keyof typeof POLONIEX_TIMEFRAME,
  start: number, // milliseconds, include a candle with this value
  end: number, // milliseconds, include a candle with this value
  limit: number, // milliseconds, include a candle with this value
): Promise<CandleDb[] | string> {
  const candles: any = await fetch(
    `https://api.poloniex.com/markets/${synonym}/candles?interval=${timeframe}&startTime=${start}&endTime=${end}&limit=${limit}`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`);
      return null;
    });

  if (!candles || !Array.isArray(candles)) {
    console.log(
      `https://api.poloniex.com/markets/${synonym}/candles?interval=${timeframe}&startTime=${start}&endTime=${end}&limit=${limit}`,
    );
    return `Bad response ${JSON.stringify(candles || {})}`;
  }

  if (!candles.length) {
    return [];
  }

  return candles.map((candle: OHLCV_Poloniex) => poloniexCandleToCandleModel(candle));
}

export async function bybitFetchCandles(
  synonym: string,
  timeframe: keyof typeof BYBIT_TIMEFRAME,
  start: number, // milliseconds, include a candle with this value
  limit: number, // milliseconds, include a candle with this value
): Promise<CandleDb[] | string> {
  const res: any = await fetch(
    `https://api.bybit.com/v5/market/kline?category=spot&symbol=${synonym}&interval=${timeframe}&start=${start}&limit=${limit}`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`);
      return null;
    });

  if (res?.retCode !== 0 || !res.result?.list || !Array.isArray(res.result.list)) {
    console.log(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${synonym}&interval=${timeframe}&start=${start}&limit=${limit}`,
    );
    return `Bad response ${JSON.stringify(res || {})}`;
  }

  if (!res.result.list.length) {
    return [];
  }

  return res.result.list.map((candle: OHLCV_Bybit) => bybitCandleToCandleModel(candle));
}

export async function huobiFetchCandles(
  synonym: string,
  timeframe: keyof typeof HUOBI_TIMEFRAME,
  limit: number, // milliseconds, include a candle with this value
): Promise<any[] | string> {
  // console.log(`https://api.huobi.pro/market/history/kline?symbol=${synonym}&period=${timeframe}&size=${limit}`);

  const candles: any = await fetch(
    `https://api.huobi.pro/market/history/kline?symbol=${synonym}&period=${timeframe}&size=${limit}`,
  )
    .then((res) => res.json())
    .catch((e) => {
      Logger.error(`Error fetch candles: ${e.message}`, 'huobiFetchCandles');
      return null;
    });

  if (!candles?.data || candles?.status !== 'ok') {
    console.log(`https://api.huobi.pro/market/history/kline?symbol=${synonym}&period=${timeframe}&size=${limit}`);
    return `Bad response ${JSON.stringify(candles || {})}`;
  }

  if (!candles.data?.length) {
    return [];
  }

  return candles.data.map((candle: OHLCV_Huobi) => huobiCandleToCandleModel(candle));
}

export async function binanceFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const { synonym } = data;
  // const synonym = 'BTC-USDT';
  const timeframe = BINANCE_TIMEFRAME[data.timeframe];

  let start = new Date('2017-01-01T00:00:00.000Z').getTime();
  // add 64 candles to start
  let end = Math.min(start + timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

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
        Logger.error(`Error fetch candles: ${e.message}`, 'binanceFindFirstCandle');
        return null;
      });

    // console.log(
    //   `https://api4.binance.com/api/v3/uiKlines?symbol=${synonym}&interval=${timeframe}&limit=3&startTime=${start}`,
    //   res?.data?.length,
    // );

    if (res?.length) {
      const minTime = Math.min(...res.map((candle: OHLCV_Binance) => +candle[0]));
      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);
      Logger.log(`[binance] ${synonym} first candle time ${firstCandleTime.toISOString()}`);
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

  const limit = 64;

  let start = getCandleTime(data.timeframe, new Date('2017-01-01T00:00:00.000Z'));
  // let start = getCandleTime(data.timeframe, Date.now()) - 100 * timeframeMSeconds(data.timeframe);
  // let start = getCandleTime(data.timeframe, 1517443200000) - 100 * timeframeMSeconds(data.timeframe);

  // add 64 candles to start
  let end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  const now = new Date().getTime();

  while (start < now && start < end) {
    // const res: any = await fetch(
    //   `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${start - 1}&before=${
    //     end + 1
    //   }`,
    // )
    const res: any = await fetch(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${synonym}&interval=${timeframe}&start=${start}&limit=${limit}`,
    )
      .then((res) => res.json())
      .catch((e) => {
        Logger.error(`Error fetch candles: ${e.message}`, 'okxFindFirstCandle');
        return null;
      });

    // console.log(
    //   res?.data?.length,
    //   `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&before=${start - 1}&after=${
    //     end + 1
    //   }&limit=${limit}`,
    // );

    if (res?.code === '0' && res?.data?.length) {
      const minTime = Math.min(...res.data.map((candle: OHLCV_Okx) => +candle[0]));

      // if (synonym === 'GARI-USDT') {
      //   console.log(
      //     'minTime',
      //     minTime,
      //     new Date(minTime).toISOString(),
      //     res.data.map((candle: OHLCV_Okx) => new Date(+candle[0]).toISOString()),
      //   );
      // }

      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);
      Logger.log(`[okx] ${synonym} first candle time ${firstCandleTime?.getTime()}, ${firstCandleTime?.toISOString()}`);
      return firstCandleTime;
    }

    start = start + limit * timeframeMSeconds(data.timeframe);
    end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function poloniexFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const { synonym } = data;
  const timeframe = POLONIEX_TIMEFRAME[data.timeframe];

  let start = getCandleTime(data.timeframe, new Date('2017-01-01T00:00:00.000Z').getTime());

  // add 64 candles to start
  let end = Math.min(start + 500 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  const now = new Date().getTime();

  while (start < now && start < end) {
    const res: any = await fetch(
      `https://api.poloniex.com/markets/${synonym}/candles?interval=${timeframe}&startTime=${start}&endTime=${end}`,
    )
      .then((res) => res.json())
      .catch((e) => {
        Logger.error(`Error fetch candles: ${e.message}`);
        return null;
      });

    if (res?.length) {
      const minTime = Math.min(...res.map((candle: OHLCV_Poloniex) => +candle[12]));
      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);
      Logger.log(`[poloniex] ${synonym} first candle time ${firstCandleTime.toISOString()}`);
      return firstCandleTime;
    }

    start = start + 500 * timeframeMSeconds(data.timeframe);
    end = Math.min(start + 500 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function bybitFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const { synonym } = data;
  const timeframe = BYBIT_TIMEFRAME[data.timeframe];

  const limit = 999;

  let start = getCandleTime(data.timeframe, new Date('2017-01-01T00:00:00.000Z').getTime());

  // add 64 candles to start
  let end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  while (start < end) {
    const request = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${synonym}&interval=${timeframe}&start=${start}&limit=${limit}`;
    const res: any = await fetch(request)
      .then((res) => res.json())
      .catch((e) => {
        Logger.error(`Error fetch candles: ${e.message}`, 'bybitFindFirstCandle');
        return null;
      });

    if (res?.retCode === 0 && res.result?.list && Array.isArray(res.result.list) && res.result.list.length) {
      const minTime = Math.min(...res.result.list.map((candle: OHLCV_Bybit) => +candle[0]));

      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);

      Logger.log(`[bybit] ${synonym} first candle time ${firstCandleTime.getTime()}, ${firstCandleTime.toISOString()}`);
      return firstCandleTime;
    } else {
      // console.log(request);
      // console.log(JSON.stringify(res));
    }

    start = start + limit * timeframeMSeconds(data.timeframe);
    end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}
