import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OHLCV_Binance } from './interface';
import * as topCoins from '../data/coins-top-300.json';
import * as ccxt from 'ccxt';
import { Market as ExchangeMarket } from 'ccxt';
import { STABLES } from './constant';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private badCoins = [];
  private delayCoin = {};

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(() => this.fetchAllCandles(), 5000);
  }

  async fetchAllCandles() {
    const coins = await this.getTopCoins();
    if (!coins?.length) {
      Logger.error('Error loading top coins', 'fetchAllCandles');
      return;
    }

    for (const coin of coins.slice(0, 30) || []) {
      if (this.badCoins.includes(coin.coin)) {
        continue;
      }

      if (
        this.delayCoin?.[coin.coin] &&
        Date.now() - this.delayCoin?.[coin.coin] < 1000 * 60 * 60
      ) {
        continue;
      }

      const candles = await this.fetchCandles({
        exchange: 'binance',
        symbol: `${coin.coin}/USDT`,
        timeframe: '1m',
        limit: 1000,
      });

      if (typeof candles === 'string') {
        Logger.error(candles, 'fetchAllCandles');
        this.badCoins.push(coin.coin);
      } else {
        Logger.log(`Saved ${coin.coin} ${candles.length}`);

        if (candles.length <= 5) {
          this.delayCoin = { [coin.coin]: Date.now() };
          Logger.warn(`Delay ${coin.coin} ${candles.length}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setTimeout(() => this.fetchAllCandles(), 100);
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getMaxTimestamp(body: {
    exchange: string;
    symbol: string;
    timeframe: string;
  }): Promise<Date | null> {
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
      await this.prisma.candle.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
      // console.log('Saved:', savedCandles);

      return candlesToSave;
    } catch (error) {
      // Обработка ошибки, например, логирование или возврат ошибки
      console.error(error);
      return [];
    }
  }

  async fetchMarkets(exchangeId: string): Promise<string[]> {
    const exchange = new ccxt[exchangeId]({
      enableRateLimit: true,
      verbose: false,
      options: {
        defaultType: 'spot',
      },
    });

    console.log('Loading markets...', exchangeId);

    // const markets: Dictionary<ExchangeMarket> = await exchange.fetchMarkets();
    const markets: Record<string, ExchangeMarket> =
      await exchange.loadMarkets(false);

    if (!markets) {
      Logger.error(`Error loading markets for [${exchangeId}]`, 'fetchMarkets');

      return [];
    }
    const totalMarkets = Object.keys(markets).length;
    console.log('Loaded markets:', totalMarkets, exchangeId);

    let counter = 0;
    const symbols = [];
    for (const market of Object.values(markets)) {
      symbols.push(market.symbol);
      counter++;

      console.log(
        'Check market',
        exchangeId,
        market.symbol,
        counter,
        '/',
        totalMarkets,
      );
      const existData = await this.prisma.market.findUnique({
        where: {
          symbol_synonym_exchange: {
            symbol: market.symbol,
            synonym: market.id,
            exchange: exchangeId,
          },
        },
      });

      if (!existData) {
        console.log(
          'A new market',
          exchangeId,
          market.symbol,
          counter,
          '/',
          totalMarkets,
        );

        await this.prisma.market.upsert({
          where: {
            symbol_synonym_exchange: {
              symbol: market.symbol,
              synonym: market.id,
              exchange: exchangeId,
            },
          },
          create: {
            exchange: exchangeId,
            symbol: market.symbol,
            synonym: market.id as string,
          },
          update: { synonym: market.id },
        });
      }
    }

    return symbols;
  }

  async fetchCandles(body: {
    exchange: string;
    symbol: string;
    timeframe: string;
    start?: number;
    limit?: number;
  }): Promise<any[] | string> {
    const { exchange, symbol, timeframe, start, limit } = body;

    const maxTimestamp = await this.getMaxTimestamp(body);
    Logger.log(
      `Max timestamp: ${maxTimestamp?.toISOString()} for ${symbol} ${timeframe}`,
    );

    // console.log(
    //   `https://api4.binance.com/api/v3/uiKlines?symbol=${symbol.replace(
    //     '/',
    //     '',
    //   )}&interval=${timeframe}&limit=${limit || 64}&startTime=${
    //     start ? start : +maxTimestamp ? +maxTimestamp - 1 : 1
    //   }`,
    // );

    const res = await fetch(
      `https://api4.binance.com/api/v3/uiKlines?symbol=${symbol.replace(
        '/',
        '',
      )}&interval=${timeframe}&limit=${limit || 64}&startTime=${
        start ? start : +maxTimestamp ? +maxTimestamp - 1 : 1
      }`,
    )
      .then((res) => res.json())
      .catch((e) => console.error(`Error fetch candles: ${e.message}`));

    if (!res?.length) {
      return `Error fetch candles ${symbol}: ${JSON.stringify(res)}`;
    }

    // console.log('Fetched: ', res?.length);

    let saved = [];
    if (res.length) {
      saved = await this.saveBinanceCandles(exchange, symbol, timeframe, res);
    }

    return saved;
  }

  async getTopCoins(): Promise<any[]> {
    // select top coins form prisma which is not in the array STABLES, limit 30 records
    return this.prisma.topCoin.findMany({
      where: {
        NOT: {
          coin: {
            in: STABLES,
          },
        },
      },
      orderBy: {
        cost24: 'desc',
      },
      // take: 30,
    });
  }
  async updateTopCoins(): Promise<any[]> {
    const coins: any[] = topCoins;

    for (const coin of coins) {
      try {
        const data = {
          name: coin[1],
          logo: coin[2],
          price:
            typeof coin[3] === 'string' &&
            +coin[3].replaceAll('$', '').replaceAll(',', '')
              ? +coin[3].replaceAll('$', '').replaceAll(',', '')
              : coin[3],
          volumeCap:
            typeof coin[4] === 'string' &&
            +coin[4].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              ? +coin[4].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              : 0,
          costCap:
            typeof coin[5] === 'string' &&
            +coin[5].replaceAll('$', '').replaceAll(',', '')
              ? +coin[5].replaceAll('$', '').replaceAll(',', '')
              : 0,
          volume24:
            typeof coin[6] === 'string' &&
            +coin[6].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              ? +coin[6].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              : 0,
          cost24:
            typeof coin[7] === 'string' &&
            +coin[7].replace('$', '').replaceAll(',', '')
              ? +coin[7].replace('$', '').replaceAll(',', '')
              : 0,
        };

        // console.log(coin);
        // console.log(data);

        await this.prisma.topCoin.upsert({
          where: {
            coin: coin[0],
          },
          create: { ...data, coin: coin[0] },
          update: data,
        });

        // console.log(savedCoin);
      } catch (e) {
        console.error(e.message);
      }
    }

    return coins.map((coin) => coin[0]);
  }
}
