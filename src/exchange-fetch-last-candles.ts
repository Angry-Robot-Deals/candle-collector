/**
 * Unified "fetch last N candles" interface for all 9 exchanges.
 *
 * Each function requests the most recent `limit` candles up to and including
 * `getCandleTime(timeframe)` (current closed candle boundary).
 *
 * Returns CandleDb[] sorted oldest-first, or a string error message.
 */
import {
  binanceFetchCandles,
  okxFetchCandles,
  poloniexFetchCandles,
  bybitFetchCandles,
  htxFetchCandles,
} from './exchange-fetch-candles';
import { mexcFetchCandles } from './exchanges/mexc';
import { gateioFetchCandles } from './exchanges/gateio';
import { kucoinFetchCandles } from './exchanges/kucoin';
import { bitgetFetchCandles } from './exchanges/bitget';
import {
  BINANCE_TIMEFRAME,
  BYBIT_TIMEFRAME,
  HTX_TIMEFRAME,
  OKX_TIMEFRAME,
  POLONIEX_TIMEFRAME,
} from './exchange.constant';
import { getCandleTime } from './timeseries';
import { timeframeMSeconds, timeframeSeconds } from './timeseries.constant';
import { TIMEFRAME } from './timeseries.interface';
import { CandleDb } from './interface';

export interface FetchLastCandlesParams {
  exchange: string;
  synonym: string;
  timeframe: TIMEFRAME;
  limit: number;
}

/**
 * Dispatcher: routes to the correct per-exchange fetcher and returns
 * candles sorted oldest-first.
 */
export async function fetchLastCandles(
  params: FetchLastCandlesParams,
): Promise<CandleDb[] | string> {
  let result: CandleDb[] | string;

  switch (params.exchange) {
    case 'binance':
      result = await binanceFetchLastCandles(params);
      break;
    case 'okx':
      result = await okxFetchLastCandles(params);
      break;
    case 'kucoin':
      result = await kucoinFetchLastCandles(params);
      break;
    case 'htx':
      result = await htxFetchLastCandles(params);
      break;
    case 'poloniex':
      result = await poloniexFetchLastCandles(params);
      break;
    case 'gateio':
      result = await gateioFetchLastCandles(params);
      break;
    case 'mexc':
      result = await mexcFetchLastCandles(params);
      break;
    case 'bitget':
      result = await bitgetFetchLastCandles(params);
      break;
    case 'bybit':
      result = await bybitFetchLastCandles(params);
      break;
    default:
      return `[fetchLastCandles] Unknown exchange: ${params.exchange}`;
  }

  if (typeof result === 'string') return result;

  return result.sort((a, b) => a.time.getTime() - b.time.getTime());
}

// ---------------------------------------------------------------------------
// Per-exchange implementations
// ---------------------------------------------------------------------------

/**
 * Binance: GET /api/v3/uiKlines?symbol=X&interval=TF&limit=N&startTime=S
 * startTime = endMs - (limit-1)*tfMs so the window is [start, current] inclusive.
 */
export async function binanceFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - (limit - 1) * timeframeMSeconds(timeframe);
  return binanceFetchCandles(synonym, BINANCE_TIMEFRAME[timeframe], startMs, limit);
}

/**
 * OKX: GET /api/v5/market/history-candles?instId=X&bar=TF&before=S-1&after=E+1&limit=N
 * before/after are exclusive bounds; before=lower, after=upper.
 */
export async function okxFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - limit * timeframeMSeconds(timeframe);
  return okxFetchCandles(synonym, OKX_TIMEFRAME[timeframe], startMs, endMs, limit);
}

/**
 * KuCoin: GET /api/v1/market/candles?type=TF&symbol=X&startAt=S&endAt=E
 * kucoinFetchCandles expects ms; internally converts to seconds.
 */
export async function kucoinFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - limit * timeframeMSeconds(timeframe);
  return kucoinFetchCandles({ synonym, timeframe, start: startMs, end: endMs });
}

/**
 * HTX: GET /market/history/kline?symbol=X&period=TF&size=N
 * HTX does not support time range — always returns the most recent N candles.
 */
export async function htxFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  return htxFetchCandles(synonym, HTX_TIMEFRAME[timeframe], limit);
}

/**
 * Poloniex: GET /markets/{symbol}/candles?interval=TF&startTime=S&endTime=E&limit=N
 * startTime / endTime in ms.
 */
export async function poloniexFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - limit * timeframeMSeconds(timeframe);
  return poloniexFetchCandles(synonym, POLONIEX_TIMEFRAME[timeframe], startMs, endMs, limit);
}

/**
 * Gate.io: GET /api/v4/spot/candlesticks?currency_pair=X&interval=TF&from=S&to=E
 * from / to in Unix seconds.
 */
export async function gateioFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endSec = Math.ceil(getCandleTime(timeframe) / 1000);
  const startSec = endSec - limit * timeframeSeconds(timeframe);
  return gateioFetchCandles({ synonym, timeframe, start: startSec, end: endSec });
}

/**
 * MEXC: GET /api/v3/klines?symbol=X&interval=TF&startTime=S&endTime=E&limit=N
 * startTime / endTime in ms. Use (limit-1)*tfMs so current candle is included.
 */
export async function mexcFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - (limit - 1) * timeframeMSeconds(timeframe);
  return mexcFetchCandles({ synonym, timeframe, start: startMs, end: endMs + timeframeMSeconds(timeframe), limit });
}

/**
 * Bitget: GET /api/v2/spot/market/candles?symbol=X&granularity=TF&startTime=S&endTime=E&limit=N
 * Selects /candles vs /history-candles automatically inside bitgetFetchCandles.
 * startTime / endTime in ms.
 */
export async function bitgetFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - limit * timeframeMSeconds(timeframe);
  return bitgetFetchCandles({ synonym, timeframe, start: startMs, end: endMs + timeframeMSeconds(timeframe), limit });
}

/**
 * Bybit: GET /v5/market/kline?category=spot&symbol=X&interval=TF&start=S&limit=N
 * Response is newest-first; sorted by dispatcher.
 * Use (limit-1)*tfMs so current candle is included.
 */
export async function bybitFetchLastCandles({
  synonym,
  timeframe,
  limit,
}: FetchLastCandlesParams): Promise<CandleDb[] | string> {
  const endMs = getCandleTime(timeframe);
  const startMs = endMs - (limit - 1) * timeframeMSeconds(timeframe);
  return bybitFetchCandles(synonym, BYBIT_TIMEFRAME[timeframe], startMs, limit);
}
