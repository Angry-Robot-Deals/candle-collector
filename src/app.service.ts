import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OHLCV_Binance } from './interface';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getMaxTimestamp(body: {
    exchange: string;
    symbol: string;
    timeframe: string;
  }): Promise<number | null> {
    const { exchange, symbol, timeframe } = body;
    try {
      const maxTimestamp = await this.prisma.candle.findFirst({
        select: {
          time: true,
        },
        where: {
          exchange,
          symbol,
          timeframe,
        },
        orderBy: {
          time: 'desc',
        },
      });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return maxTimestamp?.time || null;
    } catch (error) {
      // Обработка ошибки, например, логирование или возврат ошибки
      console.error(error);
      return null;
    }
  }

  async saveBinanceCandles(
    exchange: string,
    symbol: string,
    timeframe: string,
    candles: OHLCV_Binance[],
  ): Promise<any[]> {
    const candlesToSave = candles.map((candle) => {
      return {
        exchange,
        symbol,
        timeframe,
        time: new Date(candle[0]),
        open: +candle[1],
        high: +candle[2],
        low: +candle[3],
        close: +candle[4],
        volume: +candle[5],
        trades: candle[8],
      };
    });

    try {
      const savedCandles = await this.prisma.candle.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
      console.log('Saved:', savedCandles);

      return candlesToSave;
    } catch (error) {
      // Обработка ошибки, например, логирование или возврат ошибки
      console.error(error);
      return [];
    }
  }

  async fetchCandles(body: {
    exchange: string;
    symbol: string;
    timeframe: string;
    start: number;
    limit: number;
  }): Promise<string> {
    const { exchange, symbol, timeframe, start, limit } = body;

    const maxTimestamp = await this.getMaxTimestamp(body);
    console.log(maxTimestamp);

    console.log(
      `https://api4.binance.com/api/v3/uiKlines?symbol=${symbol}&interval=${timeframe}&limit=${
        limit || 64
      }&startTime=${start ? start : (+maxTimestamp || 0) + 1}`,
    );

    const res = await fetch(
      `https://api4.binance.com/api/v3/uiKlines?symbol=${symbol.replace(
        '/',
        '',
      )}&interval=${timeframe}&limit=${limit || 64}&startTime=${
        start ? start : (+maxTimestamp || 0) + 1
      }`,
    )
      .then((res) => res.json())
      .catch((e) => console.error(e));

    if (!res?.length) {
      return `Error fetch candles: ${JSON.stringify(res)}`;
    }

    console.log('Fetched: ', res);

    let saved = [];
    if (res.length) {
      saved = await this.saveBinanceCandles(exchange, symbol, timeframe, res);
    }

    return JSON.stringify(saved);
  }
}
