import * as process from 'node:process';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { Market as ExchangeMarket } from 'ccxt';
import { Exchange as ExchangeModel, Symbol as SymbolModel } from '@prisma/client';
import * as topCoins from '../data/coins-top-300.json';
import {
  binanceFetchCandles,
  binanceFindFirstCandle,
  bybitFetchCandles,
  bybitFindFirstCandle,
  huobiFetchCandles,
  okxFetchCandles,
  okxFindFirstCandle,
  poloniexFetchCandles,
  poloniexFindFirstCandle,
} from './exchange-fetch-candles';
import { getCandleHumanTime, getCandleTime, getCandleTimeByShift } from './timeseries';
import {
  BINANCE_TIMEFRAME,
  BYBIT_TIMEFRAME,
  ENABLED_EXCHANGES,
  HUOBI_TIMEFRAME,
  OKX_TIMEFRAME,
  POLONIEX_TIMEFRAME,
} from './exchange.constant';
import { isCorrectSymbol } from './utils';
import { PrismaService } from './prisma.service';
import { TIMEFRAME } from './timeseries.interface';
import { CandleDb } from './interface';
import { STABLES } from './constant';
import { timeframeMSeconds } from './timeseries.constant';
import { CALCULATE_ATHL_PERIOD, FETCH_DELAY } from './app.constant';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private badCoins = [];
  private badSymbols = {};
  private delayCoin = {};

  private delayMarket = {};

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.ENABLE_DAY_CANDLE_FETCH === 'true' || process.env.ENABLE_DAY_CANDLE_FETCH === '1') {
      setTimeout(() => this.fetchAllSymbolD1Candles(), Math.random() * 10000);
    }

    if (process.env.ENABLE_TOP_COIN_FETCH === 'true' || process.env.ENABLE_TOP_COIN_FETCH === '1') {
      setTimeout(() => this.fetchTopCoinsM1Candles(), Math.random() * 10000);
    }

    if (process.env.ENABLE_ATHL_CALCULATION === 'true' || process.env.ENABLE_ATHL_CALCULATION === '1') {
      setTimeout(() => this.calculateAllATHL(), Math.random() * 10000);
    }
  }

  async fetchTopCoinsM1Candles() {
    const coins = await this.getTopCoins();
    if (!coins?.length) {
      Logger.error('Error loading top coins', 'fetchTopCoinsM1Candles');
      return;
    }

    for (const coin of coins.slice(0, 100) || []) {
      if (this.badCoins.includes(coin.coin)) {
        continue;
      }

      if (this.delayCoin?.[coin.coin] && Date.now() - this.delayCoin?.[coin.coin] < FETCH_DELAY) {
        continue;
      }

      if (this.badSymbols['binance'] && this.badSymbols['binance'].includes(`${coin.coin}/USDT`)) {
        continue;
      }

      const candles = await this.fetchCandles({
        exchange: 'binance',
        symbol: `${coin.coin}/USDT`,
        timeframe: TIMEFRAME.M1,
        limit: 1000,
      });

      if (typeof candles === 'string') {
        Logger.error(candles, 'fetchTopCoinsM1Candles');
        this.badCoins.push(coin.coin);
      } else {
        const exchangeId = await this.getExchangeId('binance');
        if (!exchangeId) {
          return `Error get an exchange id 'binance'`;
        }

        const symbolId = await this.getSymbolId(`${coin.coin}/USDT`);
        if (!symbolId) {
          return `Error get a symbol id ${coin.coin}/USDT`;
        }

        const saved = candles?.length
          ? await this.saveExchangeCandles({
              exchangeId,
              symbolId,
              timeframe: TIMEFRAME.M1,
              candles,
            })
          : { saved: 0 };

        Logger.log(`Saved ${TIMEFRAME.M1} ${coin.coin} ${JSON.stringify(saved)}`);

        if (candles?.length <= 3) {
          this.delayCoin[coin.coin] = Date.now();
          Logger.warn(`Delay COIN ${coin.coin} ${candles.length}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setTimeout(() => this.fetchTopCoinsM1Candles(), 100);
  }

  async fetchAllSymbolD1Candles() {
    const exchanges = await this.getExchanges();
    if (!exchanges?.length) {
      return;
    }

    const jobs = [];
    for (const exchange of exchanges) {
      jobs.push(this.fetchExchangeAllSymbolD1Candles(exchange));
    }

    await Promise.all(jobs);

    setTimeout(() => this.fetchAllSymbolD1Candles(), 5000);
  }

  async calculateAllATHL() {
    const start = Date.now();
    // select unique symbolId and exchangeId from candleD1
    const daySymbols = await this.prisma.candleD1.groupBy({
      by: ['symbolId', 'exchangeId'],
      _count: {
        _all: true,
      },
      _min: {
        low: true,
      },
      _max: {
        high: true,
      },
      orderBy: {
        symbolId: 'asc',
      },
    });
    // const daySymbols = await this.prisma.candleD1.findMany({
    //   select: {
    //     symbolId: true,
    //     exchangeId: true,
    //   },
    //   // distinct: ['symbolId', 'exchangeId'],
    //   groupBy: ['symbolId', 'exchangeId'],
    // });

    if (!daySymbols.length) {
      return;
    }

    // await this.prisma.aTHL.deleteMany({});

    console.log('Select:', daySymbols.length, Date.now() - start, 'ms');

    let i = 0;
    // for each symbolId and exchangeId
    for (const symbol of daySymbols) {
      i++;
      const firstCandle = await this.prisma.candleD1.findFirst({
        select: {
          open: true,
        },
        where: {
          symbolId: symbol.symbolId,
          exchangeId: symbol.exchangeId,
        },
        orderBy: {
          time: 'asc',
        },
      });
      const lastCandle = await this.prisma.candleD1.findFirst({
        select: {
          close: true,
        },
        where: {
          symbolId: symbol.symbolId,
          exchangeId: symbol.exchangeId,
        },
        orderBy: {
          time: 'desc',
        },
      });

      const highRange = symbol._max.high - firstCandle.open;
      // const lowRange = firstCandle.open - symbol._min.low || symbol._max.high / 2;
      const zeroRange = firstCandle.open || symbol._max.high / 2;
      const fullRange = symbol._max.high - symbol._min.low;

      let index = 0;
      if (lastCandle.close > firstCandle.open) {
        index = (lastCandle.close - firstCandle.open) / highRange;
      } else if (lastCandle.close < firstCandle.open) {
        index = (-1 * lastCandle.close) / zeroRange;
      }

      let position = 0;
      if (lastCandle.close > firstCandle.open) {
        position = (lastCandle.close - firstCandle.open) / fullRange;
      } else if (lastCandle.close < firstCandle.open) {
        position = (lastCandle.close - firstCandle.open) / fullRange;
      }

      const athl = await this.prisma.aTHL.upsert({
        where: {
          symbolId_exchangeId: {
            symbolId: symbol.symbolId,
            exchangeId: symbol.exchangeId,
          },
        },
        create: {
          symbolId: symbol.symbolId,
          exchangeId: symbol.exchangeId,
          high: symbol._max.high,
          low: symbol._min.low,
          start: firstCandle.open,
          close: lastCandle.close,
          index,
          position,
        },
        update: {
          high: symbol._max.high,
          low: symbol._min.low,
          start: firstCandle.open,
          close: lastCandle.close,
          index,
          position,
        },
      });

      if (i % 10 === 0) {
        console.log(
          i,
          '/',
          daySymbols.length,
          'index',
          athl.index * 100,
          'pos',
          athl.position * 100,
          Date.now() - start,
          'ms',
        );
      }
    }

    setTimeout(() => this.calculateAllATHL(), CALCULATE_ATHL_PERIOD);
  }

  async fetchExchangeAllSymbolD1Candles(exchange: { id: number; name: string }): Promise<void> {
    const envExchanges = process.env.DAY_CANDLE_FETCH_EXCHANGES?.split(',') || [];
    const enabledExchanges = ENABLED_EXCHANGES.filter((e) => !envExchanges?.length || envExchanges.includes(e));

    if (!enabledExchanges.includes(exchange.name)) {
      return;
    }

    const markets = await this.prisma.market.findMany({
      select: {
        symbol: true,
        symbolId: true,
        synonym: true,
      },
      where: {
        exchangeId: exchange.id,
        disabled: false,
      },
      orderBy: {
        synonym: 'asc',
      },
    });

    if (!markets?.length) {
      return;
    }

    Logger.log(`Fetching markets ${exchange.name} ${markets.length}`);

    for (const market of markets) {
      if (
        this.delayMarket?.[exchange.id]?.[market.symbolId] &&
        Date.now() - this.delayMarket[exchange.id][market.symbolId] < FETCH_DELAY
      ) {
        continue;
      }

      if (!isCorrectSymbol(market.symbol.name)) {
        // Logger.debug(`Error symbol ${market.symbol.name}`, 'fetchAllSymbolD1Candles');
        continue;
      }

      if (this.badSymbols[exchange.id] && this.badSymbols[exchange.id].includes(market.symbol.name)) {
        continue;
      }

      // delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      let limit: number = 0;
      if (exchange.name === 'huobi') {
        const lastCandle = await this.prisma.candleD1.findFirst({
          select: {
            time: true,
          },
          where: {
            exchangeId: exchange.id,
            symbolId: market.symbolId,
            timeframe: TIMEFRAME.D1,
          },
          orderBy: {
            time: 'desc',
          },
        });

        if (lastCandle?.time) {
          if (
            getCandleTime(TIMEFRAME.D1, lastCandle.time) === getCandleTime(TIMEFRAME.D1) ||
            getCandleTime(TIMEFRAME.D1, lastCandle.time) === getCandleTimeByShift(TIMEFRAME.D1, 1)
          ) {
            limit = 1;
          }
        }
      }

      const candles = await this.fetchCandles({
        exchange: exchange.name,
        exchangeId: exchange.id,
        symbol: market.symbol.name,
        symbolId: market.symbolId,
        synonym: market.synonym,
        timeframe: TIMEFRAME.D1,
        limit,
      });

      if (typeof candles === 'string') {
        Logger.error(candles, 'fetchExchangeAllSymbolD1Candles');
      } else {
        if (candles.length <= 3) {
          if (!this.delayMarket[exchange.id]) {
            this.delayMarket[exchange.id] = {};
          }
          Logger.warn(`Delay ${exchange.name} ${market.symbol.name} ${candles.length}`);
          this.delayMarket[exchange.id][market.symbolId] = Date.now();
        }

        const saved = candles?.length
          ? await this.saveExchangeCandlesD1({
              exchangeId: exchange.id,
              symbolId: market.symbolId,
              timeframe: TIMEFRAME.D1,
              candles,
            })
          : { fetched: 0 };

        Logger.log(`Saved D1 ${exchange.name} ${market.symbol.name} ${JSON.stringify(saved)}`);
      }

      // 1-month candles
      if (exchange.name === 'huobi') {
        limit = 0;
        const lastCandle = await this.prisma.candleD1.findFirst({
          select: {
            time: true,
          },
          where: {
            exchangeId: exchange.id,
            symbolId: market.symbolId,
            timeframe: TIMEFRAME.MN1,
          },
          orderBy: {
            time: 'desc',
          },
        });

        if (lastCandle?.time) {
          if (
            getCandleTime(TIMEFRAME.MN1, lastCandle.time) === getCandleTime(TIMEFRAME.MN1) ||
            getCandleTime(TIMEFRAME.MN1, lastCandle.time) === getCandleTimeByShift(TIMEFRAME.MN1, 1)
          ) {
            limit = 1;
          }
        }

        const candlesMN1 = await this.fetchCandles({
          exchange: exchange.name,
          exchangeId: exchange.id,
          symbol: market.symbol.name,
          symbolId: market.symbolId,
          synonym: market.synonym,
          timeframe: TIMEFRAME.MN1,
          limit,
        });

        if (typeof candlesMN1 === 'string') {
          Logger.error(candles, 'fetchExchangeAllSymbolD1Candles');
        } else {
          if (candlesMN1.length <= 1) {
            if (!this.delayMarket[exchange.id]) {
              this.delayMarket[exchange.id] = {};
            }
            Logger.warn(`Delay ${exchange.name} ${market.symbol.name} ${candlesMN1.length}`);
            this.delayMarket[exchange.id][market.symbolId] = Date.now();
          }

          const saved = candlesMN1?.length
            ? await this.saveExchangeCandlesD1({
                exchangeId: exchange.id,
                symbolId: market.symbolId,
                timeframe: TIMEFRAME.MN1,
                candles: candlesMN1,
              })
            : { fetched: 0 };

          Logger.log(`Saved Month ${exchange.name} ${market.symbol.name} ${JSON.stringify(saved)}`);
        }
      }
    }
  }

  getHello(): string {
    return `Works ${process.uptime()} ms`;
  }

  async getMaxTimestamp(body: { exchangeId: number; symbolId: number; timeframe: string }): Promise<Date | null> {
    const { exchangeId, symbolId, timeframe } = body;
    try {
      const maxTimestamp = await this.prisma.candle.findFirst({
        select: {
          time: true,
        },
        where: {
          exchangeId,
          symbolId,
          timeframe,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return maxTimestamp?.time || null;
    } catch (error) {
      Logger.error(`Error get a max timestamp: ${error.message}`, 'getMaxTimestamp');
      return null;
    }
  }

  async getMaxTimestampD1(body: { exchangeId: number; symbolId: number; timeframe: string }): Promise<Date | null> {
    const { exchangeId, symbolId, timeframe } = body;
    try {
      const maxTimestamp = await this.prisma.candleD1.findFirst({
        select: {
          time: true,
        },
        where: {
          exchangeId,
          symbolId,
          timeframe,
        },
        orderBy: {
          time: 'desc',
        },
      });

      return maxTimestamp?.time || null;
    } catch (error) {
      Logger.error(`Error get a max timestamp: ${error.message}`, 'getMaxTimestampD1');
      return null;
    }
  }

  async getSynonym(body: { exchangeId: number; symbolId: number }): Promise<string | null> {
    const { exchangeId, symbolId } = body;
    try {
      const row = await this.prisma.market.findUnique({
        where: {
          symbolId_exchangeId: {
            exchangeId,
            symbolId,
          },
        },
      });

      return row?.synonym || null;
    } catch (error) {
      Logger.error(`Error get a market synonym: ${error.message}`, 'getSynonym');
      return null;
    }
  }

  async addSymbol(data: { symbol: string }): Promise<SymbolModel> {
    const { symbol } = data;

    const value = await this.prisma.symbol.upsert({
      where: {
        name: symbol,
      } as any,
      create: {
        name: symbol,
      },
      update: {},
    });

    console.log('Saved exchange:', value);

    return value;
  }

  async addExchange(data: {
    exchange: string;
    apiUri?: string;
    candlesUri?: string;
    disabled?: boolean;
    priority?: number;
  }): Promise<ExchangeModel> {
    const { exchange, apiUri, candlesUri, disabled, priority } = data;

    const value = await this.prisma.exchange.upsert({
      where: {
        name: exchange,
      } as any,
      create: {
        name: exchange,
        apiUri: apiUri || '',
        candlesUri,
        disabled,
        priority,
      },
      update: {
        apiUri,
        candlesUri,
        disabled,
        priority,
      },
    });

    console.log('Saved exchange:', value);

    return value;
  }

  async getExchangeId(exchange: string): Promise<number | null> {
    try {
      const row = await this.prisma.exchange.findUnique({
        where: {
          name: exchange,
        },
      });

      return row?.id || null;
    } catch (error) {
      Logger.error(`Error get an exchange id: ${error.message}`, 'getExchangeId');
      return null;
    }
  }

  async getExchanges(): Promise<{ id: number; name: string }[]> {
    try {
      const rows = await this.prisma.exchange.findMany({
        select: {
          id: true,
          name: true,
        },
        where: {},
      });

      if (!rows) {
        Logger.error(`Error get an exchanges`, 'getExchanges');
        return null;
      }

      return rows;
    } catch (error) {
      Logger.error(`Error get an exchanges: ${error.message}`, 'getExchanges');
      return null;
    }
  }

  async getSymbolId(symbol: string): Promise<number | null> {
    try {
      const row = await this.prisma.symbol.findUnique({
        where: {
          name: symbol,
        },
      });

      return row?.id || null;
    } catch (error) {
      Logger.error(`Error get a symbol id: ${error.message}`, 'getSymbolId');
      return null;
    }
  }

  async saveExchangeCandles(data: {
    exchangeId: number;
    symbolId: number;
    timeframe: string;
    candles: CandleDb[];
  }): Promise<any> {
    const { exchangeId, symbolId, timeframe, candles } = data;

    if (!candles?.length) {
      return { empty: true };
    }

    try {
      const timestamps = candles.map((candle) => candle.time);

      await this.prisma.candle.deleteMany({
        where: {
          exchangeId,
          symbolId,
          timeframe,
          time: {
            in: timestamps,
          },
        },
      });

      const candlesToSave = candles.map((candle) => ({
        ...candle,
        exchangeId,
        symbolId,
        timeframe,
      }));

      return this.prisma.candle.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
    } catch (error) {
      // Обработка ошибки, например, логирование или возврат ошибки
      console.error(error);
      return [];
    }
  }

  async saveExchangeCandlesD1(data: {
    exchangeId: number;
    symbolId: number;
    timeframe: string;
    candles: CandleDb[];
  }): Promise<any> {
    const { exchangeId, symbolId, timeframe, candles } = data;
    try {
      const timestamps = candles.map((candle) => candle.time);

      await this.prisma.candleD1.deleteMany({
        where: {
          exchangeId,
          symbolId,
          timeframe,
          time: {
            in: timestamps,
          },
        },
      });

      const candlesToSave = candles.map((candle) => ({
        ...candle,
        exchangeId,
        symbolId,
        timeframe,
      }));

      return this.prisma.candleD1.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
    } catch (error) {
      // Обработка ошибки, например, логирование или возврат ошибки
      Logger.error(error.message, 'saveExchangeCandlesD1');
      return null;
    }
  }

  async fetchMarkets(exchangeName: string): Promise<string[]> {
    let exchange: any;
    try {
      exchange = new ccxt[exchangeName]({
        enableRateLimit: true,
        verbose: false,
        options: {
          defaultType: 'spot',
        },
      });
    } catch (e) {
      console.error(e);
      return [];
    }

    const exc = await this.addExchange({ exchange: exchangeName });
    if (!exc?.id) {
      Logger.error(`Error loading exchange for [${exchangeName}]`, 'fetchMarkets');
      return [];
    }

    console.log('Loading markets...', exchangeName);

    // const markets: Dictionary<ExchangeMarket> = await exchange.fetchMarkets();
    const markets: Record<string, ExchangeMarket> = await exchange.loadMarkets(false);

    if (!markets) {
      Logger.error(`Error loading markets for [${exchangeName}]`, 'fetchMarkets');

      return [];
    }
    const totalMarkets = Object.keys(markets).length;
    Logger.log(`Loaded markets ${exchangeName}: ${totalMarkets}`, 'fetchMarkets');

    let counter = 0;
    const symbols = [];
    for (const market of Object.values(markets)) {
      symbols.push(market.symbol);
      const sym = await this.addSymbol({ symbol: market.symbol });
      counter++;

      if (!sym?.id) {
        Logger.error(
          `Error loading symbol for [${exchangeName}] ${market.symbol}: ${JSON.stringify(sym || {})}`,
          'fetchMarkets',
        );
        continue;
      }

      Logger.log(`Check market ${exchangeName} ${market.symbol}: ${counter}/${totalMarkets}`, 'fetchMarkets');
      const existData = await this.prisma.market.findUnique({
        where: {
          symbolId_synonym_exchangeId: {
            symbolId: sym.id,
            synonym: market.id,
            exchangeId: exc.id,
          },
        },
      });

      if (!existData) {
        Logger.log(`A new market ${exchangeName} ${market.symbol}: ${counter}/${totalMarkets}`, 'fetchMarkets');

        await this.prisma.market.upsert({
          where: {
            symbolId_synonym_exchangeId: {
              symbolId: sym.id,
              synonym: market.id,
              exchangeId: exc.id,
            },
          },
          create: {
            symbolId: sym.id,
            synonym: market.id,
            exchangeId: exc.id,
          },
          update: { synonym: market.id },
        });
      }
    }

    return symbols;
  }

  async disableMarket(data: { exchangeId: number; symbolId: number }) {
    const { exchangeId, symbolId } = data;

    await this.prisma.market.update({
      where: {
        symbolId_exchangeId: {
          symbolId,
          exchangeId,
        },
      },
      data: {
        disabled: true,
      },
    });
  }

  async fetchCandles(body: {
    exchange: string;
    exchangeId?: number;
    symbol: string;
    symbolId?: number;
    synonym?: string;
    timeframe: TIMEFRAME;
    start?: number;
    limit?: number;
  }): Promise<CandleDb[] | string> {
    const { exchange, symbol, timeframe, start, limit } = body;

    const exchangeId = body.exchangeId || (await this.getExchangeId(exchange));
    if (!exchangeId) {
      return `Error get an exchange id ${exchange}`;
    }

    const symbolId = body.symbolId || (await this.getSymbolId(symbol));
    if (!symbolId) {
      if (!this.badSymbols[exchangeId]) {
        this.badSymbols[exchangeId] = [];
      }
      return `Error get a symbol id ${exchange} ${symbol}`;
    }

    const synonym = body.synonym || (await this.getSynonym({ exchangeId, symbolId }));
    if (!synonym) {
      if (!this.badSymbols[exchangeId]) {
        this.badSymbols[exchangeId] = [];
      }
      this.badSymbols[exchangeId].push(symbol);
      return `Error get a symbol synonym ${exchange} ${symbol}`;
    }

    let maxTimestamp: Date;
    if (start) {
      maxTimestamp = getCandleHumanTime(timeframe, new Date(start));
    } else {
      if (timeframe === TIMEFRAME.D1) {
        maxTimestamp = await this.getMaxTimestampD1({
          exchangeId,
          symbolId,
          timeframe,
        });
        if (maxTimestamp) {
          Logger.debug(
            `${exchange} ${symbol} ${timeframe} continue from ${maxTimestamp?.toISOString()} = ${getCandleHumanTime(
              TIMEFRAME.D1,
              maxTimestamp,
            ).toISOString()}`,
          );
          maxTimestamp = getCandleHumanTime(TIMEFRAME.D1, maxTimestamp);
        }
        if (!maxTimestamp) {
          switch (exchange) {
            case 'binance':
              maxTimestamp = await binanceFindFirstCandle({ synonym, timeframe });

              if (!maxTimestamp) {
                Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                await this.disableMarket({ exchangeId, symbolId });
                return [];
              }
              break;
            case 'bybit':
              maxTimestamp = await bybitFindFirstCandle({ synonym, timeframe });

              if (!maxTimestamp) {
                Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                await this.disableMarket({ exchangeId, symbolId });
                return [];
              }
              break;
            case 'okx':
              maxTimestamp = await okxFindFirstCandle({ synonym, timeframe });
              // console.log('okxFindFirstCandle', symbol, maxTimestamp);

              if (!maxTimestamp) {
                Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                await this.disableMarket({ exchangeId, symbolId });
                return [];
              }
              break;
            case 'poloniex':
              maxTimestamp = await poloniexFindFirstCandle({ synonym, timeframe });

              if (!maxTimestamp) {
                Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                await this.disableMarket({ exchangeId, symbolId });
                return [];
              }
              break;
            case 'huobi':
              break;
            default:
              return [];
          }
        }
      } else {
        maxTimestamp = await this.getMaxTimestamp({
          exchangeId,
          symbolId,
          timeframe,
        });
        if (maxTimestamp) {
          Logger.debug(
            `${exchange} ${symbol} ${timeframe} continue from ${maxTimestamp?.toISOString()} = ${getCandleHumanTime(
              timeframe,
              maxTimestamp,
            ).toISOString()}`,
          );
          maxTimestamp = getCandleHumanTime(timeframe, maxTimestamp);
        }
      }
    }

    let startTime = 0;
    let endTime = getCandleTime(timeframe);

    let candles: CandleDb[] | string;
    switch (exchange) {
      case 'binance':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        candles = await binanceFetchCandles(synonym, BINANCE_TIMEFRAME[timeframe], startTime, limit || 1000);
        break;
      case 'okx':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        endTime = Math.min(startTime + (limit || 64) * timeframeMSeconds(timeframe), getCandleTime(timeframe));
        candles = await okxFetchCandles(synonym, OKX_TIMEFRAME[timeframe], startTime, endTime, limit || 64);
        break;
      case 'huobi':
        candles = await huobiFetchCandles(synonym, HUOBI_TIMEFRAME[timeframe], limit || 2000);
        break;
      case 'poloniex':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        endTime = Math.min(startTime + (limit || 499) * timeframeMSeconds(timeframe), getCandleTime(timeframe));
        if (startTime >= endTime) {
          return [];
        }
        candles = await poloniexFetchCandles(synonym, POLONIEX_TIMEFRAME[timeframe], startTime, endTime, limit || 500);
        break;
      case 'bybit':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        if (startTime >= endTime) {
          return [];
        }
        candles = await bybitFetchCandles(synonym, BYBIT_TIMEFRAME[timeframe], startTime, limit || 999);
        break;
      default:
        return [];
    }

    if (typeof candles === 'string') {
      if (
        candles.toLowerCase().includes('invalid symbol') ||
        candles.toLowerCase().includes('could not get the candlesticks for symbol')
      ) {
        Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
        await this.disableMarket({ exchangeId, symbolId });
      }

      return `Error fetch candles ${exchange} ${symbol} ${timeframe}: ${candles}`;
    }
    if (!candles) {
      return `Error fetch candles ${exchange} ${symbol}} ${timeframe}`;
    }

    return candles.map((candle) => ({ ...candle, time: getCandleHumanTime(timeframe, candle.time) }));
  }

  async getTopCoins(): Promise<any[]> {
    // select top coins form prisma, which is not in the array STABLES, limit 30 records
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
            typeof coin[3] === 'string' && +coin[3].replaceAll('$', '').replaceAll(',', '')
              ? +coin[3].replaceAll('$', '').replaceAll(',', '')
              : coin[3],
          volumeCap:
            typeof coin[4] === 'string' && +coin[4].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              ? +coin[4].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              : 0,
          costCap:
            typeof coin[5] === 'string' && +coin[5].replaceAll('$', '').replaceAll(',', '')
              ? +coin[5].replaceAll('$', '').replaceAll(',', '')
              : 0,
          volume24:
            typeof coin[6] === 'string' && +coin[6].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              ? +coin[6].replace(` ${coin[0]}`, '').replaceAll(',', '').trim()
              : 0,
          cost24:
            typeof coin[7] === 'string' && +coin[7].replace('$', '').replaceAll(',', '')
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
