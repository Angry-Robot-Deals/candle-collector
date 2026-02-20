import { Logger } from '@nestjs/common';
import { fetchJsonSafe, toExchangeSymbol } from './fetch-json-safe';
import {
  binanceCandleToCandleModel,
  bybitCandleToCandleModel,
  htxCandleToCandleModel,
  okxCandleToCandleModel,
  poloniexCandleToCandleModel,
} from './exchange-dto';
import {
  BINANCE_TIMEFRAME,
  BYBIT_TIMEFRAME,
  HTX_TIMEFRAME,
  OKX_TIMEFRAME,
  POLONIEX_TIMEFRAME,
} from './exchange.constant';
import { CandleDb, OHLCV_Binance, OHLCV_Bybit, OHLCV_HTX, OHLCV_Okx, OHLCV_Poloniex } from './interface';
import { timeframeMSeconds } from './timeseries.constant';
import { getCandleHumanTime, getCandleTime } from './timeseries';
import { TIMEFRAME } from './timeseries.interface';
import { getStartFetchTime } from './app.constant';

export async function binanceFetchCandles(
  synonym: string,
  timeframe: keyof typeof BINANCE_TIMEFRAME,
  start?: number,
  limit?: number,
): Promise<CandleDb[] | string> {
  const symbol = toExchangeSymbol.noSeparator(synonym);
  const url = `https://api4.binance.com/api/v3/uiKlines?symbol=${symbol}&interval=${timeframe}&limit=${limit || 64}&startTime=${start || 1}`;
  const { data: candles, error } = await fetchJsonSafe<unknown>(url, 'binanceFetchCandles');

  if (error || candles == null) {
    return 'No candles';
  }
  if (!Array.isArray(candles)) {
    Logger.error(`[binance] ${symbol}.${timeframe} bad response: ${JSON.stringify(candles)}`, 'binanceFetchCandles');
    return `Bad response ${JSON.stringify(candles || {})}`;
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
  const instId = toExchangeSymbol.hyphen(synonym);
  const url = `https://www.okx.com/api/v5/market/history-candles?instId=${instId}&bar=${timeframe}&before=${start - 1}&after=${end + 1}&limit=${limit}`;
  const { data: res, error } = await fetchJsonSafe<{ code?: string; data?: OHLCV_Okx[] }>(url, 'okxFetchCandles');

  if (error || res == null) {
    return `Bad response ${error || 'null'}`;
  }

  if (!res?.data || res?.code !== '0') {
    Logger.error(
      `[okx] bad response instId=${instId} bar=${timeframe}: ${JSON.stringify(res || {})}`,
      'okxFetchCandles',
    );
    return `Bad response ${JSON.stringify(res || {})}`;
  }

  if (!res.data?.length) {
    return [];
  }

  return res.data.map((candle: OHLCV_Okx) => okxCandleToCandleModel(candle));
}

export async function poloniexFetchCandles(
  synonym: string,
  timeframe: keyof typeof POLONIEX_TIMEFRAME,
  start: number, // milliseconds, include a candle with this value
  end: number, // milliseconds, include a candle with this value
  limit: number, // milliseconds, include a candle with this value
): Promise<CandleDb[] | string> {
  const symbol = toExchangeSymbol.underscore(synonym);
  const url = `https://api.poloniex.com/markets/${symbol}/candles?interval=${timeframe}&startTime=${start}&endTime=${end}&limit=${limit}`;
  const { data: candles, error } = await fetchJsonSafe<unknown>(url, 'poloniexFetchCandles');

  if (error || candles == null) {
    return `Bad response ${error || 'null'}`;
  }
  if (!Array.isArray(candles)) {
    Logger.error(`[poloniex] bad response: ${symbol} ${timeframe} ${JSON.stringify(candles)}`, 'poloniexFetchCandles');
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
  const symbol = toExchangeSymbol.noSeparator(synonym);
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${timeframe}&start=${start}&limit=${limit}`;
  const { data: res, error } = await fetchJsonSafe<{ retCode?: number; result?: { list?: unknown[] } }>(url, 'bybitFetchCandles');

  if (error || res == null) {
    return `Bad response ${error || 'null'}`;
  }

  if (res?.retCode !== 0 || !res.result?.list || !Array.isArray(res.result.list)) {
    Logger.error(`[bybit] bad response: ${symbol} ${timeframe} ${JSON.stringify(res)}`, 'bybitFetchCandles');
    return `Bad response ${JSON.stringify(res || {})}`;
  }

  if (!res.result.list.length) {
    return [];
  }

  return res.result.list.map((candle: OHLCV_Bybit) => bybitCandleToCandleModel(candle));
}

export async function htxFetchCandles(
  synonym: string,
  timeframe: keyof typeof HTX_TIMEFRAME,
  limit: number, // milliseconds, include a candle with this value
): Promise<any[] | string> {
  const symbol = toExchangeSymbol.noSeparator(synonym).toLowerCase();
  const url = `https://api.huobi.pro/market/history/kline?symbol=${symbol}&period=${timeframe}&size=${limit}`;
  const { data: candles, error } = await fetchJsonSafe<{ status?: string; data?: unknown }>(url, 'htxFetchCandles');

  if (error || candles == null) {
    return `Bad response ${error || 'null'}`;
  }

  if (!candles?.data || candles?.status !== 'ok') {
    Logger.error(`[htx] bad response: ${symbol} ${timeframe} ${JSON.stringify(candles)}`, 'htxFetchCandles');
    return `Bad response ${JSON.stringify(candles || {})}`;
  }

  const list = Array.isArray(candles.data) ? candles.data : [];
  if (!list.length) {
    return [];
  }

  return list.map((candle: OHLCV_HTX) => htxCandleToCandleModel(candle));
}

export async function binanceFindFirstCandle(data: { synonym: string; timeframe: TIMEFRAME }): Promise<Date | null> {
  const symbol = toExchangeSymbol.noSeparator(data.synonym);
  const timeframe = BINANCE_TIMEFRAME[data.timeframe];

  let start = getStartFetchTime(data.timeframe).getTime();
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
      `https://api4.binance.com/api/v3/uiKlines?symbol=${symbol}&interval=${timeframe}&limit=3&startTime=${start}`,
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
      Logger.log(`[binance] ${symbol} first candle time ${firstCandleTime.toISOString()}`, 'binanceFindFirstCandle');
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
  const instId = toExchangeSymbol.hyphen(data.synonym);
  const timeframe = OKX_TIMEFRAME[data.timeframe];

  const limit = 64;

  let start = getCandleTime(data.timeframe, getStartFetchTime(data.timeframe));
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
    const url = `https://www.okx.com/api/v5/market/history-candles?instId=${instId}&bar=${timeframe}&before=${start - 1}&after=${end + 1}&limit=${limit}`;
    const { data: res, error } = await fetchJsonSafe<{ code?: string; data?: [string, ...unknown[]][] }>(url, 'okxFindFirstCandle');

    if (error || !res?.data || res?.code !== '0') {
      if (res && res.code !== '0') {
        Logger.error(`[okx] find first candle bad response instId=${instId}: ${JSON.stringify(res)}`, 'okxFindFirstCandle');
      }
      return null;
    }

    if (res.data?.length) {
      const minTime = Math.min(...res.data.map((candle: OHLCV_Okx) => +candle[0]));

      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);

      Logger.log(`[okx] ${instId} first candle time ${firstCandleTime?.getTime()}, ${firstCandleTime?.toISOString()}`);

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
  const symbol = toExchangeSymbol.underscore(data.synonym);
  const timeframe = POLONIEX_TIMEFRAME[data.timeframe];

  let start = getCandleTime(data.timeframe, getStartFetchTime(data.timeframe).getTime());

  // add 64 candles to start
  let end = Math.min(start + 500 * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  const now = new Date().getTime();

  while (start < now && start < end) {
    const url = `https://api.poloniex.com/markets/${symbol}/candles?interval=${timeframe}&startTime=${start}&endTime=${end}`;
    const { data: res, error } = await fetchJsonSafe<OHLCV_Poloniex[]>(url, 'poloniexFindFirstCandle');

    if (error || res == null) {
      return null;
    }

    if (Array.isArray(res) && res.length) {
      const minTime = Math.min(...res.map((candle: OHLCV_Poloniex) => +candle[12]));
      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);
      Logger.log(`[poloniex] ${symbol} first candle time ${firstCandleTime.toISOString()}`);
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
  const symbol = toExchangeSymbol.noSeparator(data.synonym);
  const timeframe = BYBIT_TIMEFRAME[data.timeframe];

  const limit = 999;

  let start = getCandleTime(data.timeframe, getStartFetchTime(data.timeframe).getTime());

  // add 64 candles to start
  let end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

  while (start < end) {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${timeframe}&start=${start}&limit=${limit}`;
    const { data: res, error } = await fetchJsonSafe<{ retCode?: number; result?: { list?: OHLCV_Bybit[] } }>(url, 'bybitFindFirstCandle');

    if (error || res == null) {
      return null;
    }

    const list = res?.result?.list;
    if (res?.retCode === 0 && Array.isArray(list) && list.length) {
      const minTime = Math.min(...list.map((candle: OHLCV_Bybit) => +candle[0]));

      const firstCandleTime = getCandleHumanTime(data.timeframe, minTime);

      Logger.log(`[bybit] ${symbol} first candle time ${firstCandleTime.getTime()}, ${firstCandleTime.toISOString()}`);
      return firstCandleTime;
    }

    start = start + limit * timeframeMSeconds(data.timeframe);
    end = Math.min(start + limit * timeframeMSeconds(data.timeframe), getCandleTime(data.timeframe, Date.now()));

    // delay 100 ms
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}
