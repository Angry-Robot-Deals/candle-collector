import { CandleDb, OHLCV_Binance, OHLCV_Huobi, OHLCV_Okx, OHLCV_Poloniex } from './interface';

export function binanceCandleToCandleModel(candle: OHLCV_Binance): CandleDb {
  return {
    time: new Date(candle[0]),
    open: +candle[1],
    high: +candle[2],
    low: +candle[3],
    close: +candle[4],
    volume: +candle[5],
    trades: candle[8],
  };
}

export function poloniexCandleToCandleModel(candle: OHLCV_Poloniex): CandleDb {
  return {
    time: new Date(candle[12]),
    open: +candle[2],
    high: +candle[1],
    low: +candle[0],
    close: +candle[3],
    volume: +candle[4],
    trades: candle[8],
  };
}

export function okxCandleToCandleModel(candle: OHLCV_Okx): CandleDb {
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

export function huobiCandleToCandleModel(candle: OHLCV_Huobi): CandleDb {
  return {
    time: new Date(candle.id * 1000),
    open: +candle.open,
    high: +candle.high,
    low: +candle.low,
    close: +candle.close,
    volume: +candle.amount,
    trades: candle.count,
  };
}
