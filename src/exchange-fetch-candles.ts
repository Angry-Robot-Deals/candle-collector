import { BINANCE_TIMEFRAME, OKX_TIMEFRAME } from './exchange.constant';
import { Logger } from '@nestjs/common';
import { binanceCandleToCandleModel, okxCandleToCandleModel } from './exchange-dto';
import { OHLCV_Binance, OHLCV_Okx } from './interface';

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
  end: number, // milliseconds, include a candle with this value
): Promise<any[] | string> {
  const candles: any = await fetch(
    `https://www.okx.com/api/v5/market/history-candles?instId=${synonym}&bar=${timeframe}&after=${start - 1}&before=${
      end + 1
    }`,
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
