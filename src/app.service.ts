import * as process from 'node:process';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { Market as ExchangeMarket } from 'ccxt';
import { Exchange as ExchangeModel, Symbol as SymbolModel } from '@prisma/client';
import * as topCoins from '../data/coins-top-500.json';
import {
  binanceFetchCandles,
  binanceFindFirstCandle,
  bybitFetchCandles,
  bybitFindFirstCandle,
  htxFetchCandles,
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
  HTX_TIMEFRAME,
  OKX_TIMEFRAME,
  POLONIEX_TIMEFRAME,
} from './exchange.constant';
import { isCorrectSymbol, mapLimit } from './utils';
import { PrismaService } from './prisma.service';
import { TIMEFRAME } from './timeseries.interface';
import { CandleDb } from './interface';
import { timeframeMinutes, timeframeMSeconds, timeframeSeconds } from './timeseries.constant';
import {
  BAD_SYMBOL_CHARS,
  CALCULATE_ATHL_PERIOD,
  DAY_MSEC,
  FETCH_DELAY,
  getStartFetchTime,
  HOUR_MSEC,
  MARKET_UPDATE_TIMEOUT,
  MIN_MSEC,
} from './app.constant';
import { mexcFetchCandles, mexcFindFirstCandle } from './exchanges/mexc';
import { gateioFetchCandles, gateioFindFirstCandle } from './exchanges/gateio';
import { kucoinFetchCandles, kucoinFindFirstCandle } from './exchanges/kucoin';
import { GlobalVariablesDBService } from './global-variables-db.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private badCoins = [];
  private badSymbols = {};
  private delayCoin = {};

  private delayMarket_D1 = {};
  private delayMarket_H1 = {};
  private delayMarket_M15 = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly global: GlobalVariablesDBService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(() => this.fetchAllMarkets(), Math.random() * 3000);

    if (process.env.ENABLE_CANDLE_D1_FETCH === 'true' || process.env.ENABLE_CANDLE_D1_FETCH === '1') {
      setTimeout(() => this.fetchAllSymbolD1Candles(), Math.random() * 10000);
    }

    if (process.env.ENABLE_CANDLE_H1_FETCH === 'true' || process.env.ENABLE_CANDLE_H1_FETCH === '1') {
      setTimeout(() => this.fetchAllSymbolH1Candles(), Math.random() * 10000);
    }

    if (process.env.ENABLE_CANDLE_M15_FETCH === 'true' || process.env.ENABLE_CANDLE_M15_FETCH === '1') {
      setTimeout(
        () => this.fetchAllSymbolM15Candles(),
        process.env.NODE_ENV === 'development' ? 1 : Math.random() * 10000,
      );
    }

    if (process.env.ENABLE_TOP_COIN_FETCH === 'true' || process.env.ENABLE_TOP_COIN_FETCH === '1') {
      setTimeout(() => this.fetchTopCoinsM1Candles(), Math.random() * 10000);
    }

    if (process.env.ENABLE_ATHL_CALCULATION === 'true' || process.env.ENABLE_ATHL_CALCULATION === '1') {
      setTimeout(() => this.calculateAllATHL(), Math.random() * 10000);
    }
  }

  async fetchTopCoinsM1Candles() {
    const coins = (await this.prisma.getTopCoinFirstExchange()) || [];
    if (!coins?.length) {
      Logger.error('Error loading top coins', 'fetchTopCoinsM1Candles');
      return;
    }

    console.log('+++++ fetchTopCoinsM1Candles', coins.length);

    // for (const coin of coins.slice(0, 150) || []) {
    for (const row of coins) {
      if (this.badCoins.includes(row.coin)) {
        continue;
      }

      if (this.delayCoin?.[row.coin] && Date.now() - this.delayCoin?.[row.coin] < FETCH_DELAY) {
        continue;
      }

      if (this.badSymbols[row.exchange] && this.badSymbols[row.exchange].includes(row.symbol)) {
        continue;
      }

      const candles = await this.fetchCandles({
        exchange: row.exchange,
        symbol: row.symbol,
        timeframe: TIMEFRAME.M1,
      });

      if (typeof candles === 'string') {
        Logger.error(candles, 'fetchTopCoinsM1Candles');
        this.badCoins.push(row.coin);
      } else {
        const exchangeId = await this.getExchangeId(row.exchange);
        if (!exchangeId) {
          return `Error get an exchange id [${row.exchange}]`;
        }

        const symbolId = await this.getSymbolId(row.symbol);
        if (!symbolId) {
          return `Error get a symbol id ${row.symbol}`;
        }

        const saved = candles?.length
          ? await this.saveExchangeCandles({
              exchangeId,
              symbolId,
              tf: timeframeMinutes(TIMEFRAME.M1),
              candles,
            }).catch((err) => {
              Logger.error(
                `[${row.exchange}] ${row.symbol}.${TIMEFRAME.M1} Error save candles: ${err.message}`,
                'fetchTopCoinsM1Candles',
              );
              return { saved: 0 };
            })
          : { saved: 0 };

        if (candles?.length) {
          Logger.log(
            `Saved [${row.exchange}] ${row.coin}.${TIMEFRAME.M1}: ${saved?.count || 0} – ${new Date(candles[0].time).toISOString()} - ${new Date(candles[candles.length - 1].time).toISOString()}`,
            'fetchTopCoinsM1Candles',
          );
        }

        if (candles?.length <= 10) {
          this.delayCoin[row.coin] = Date.now();
          Logger.warn(`Delay COIN ${row.coin} ${candles.length}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setTimeout(() => this.fetchTopCoinsM1Candles(), 100);
  }

  async fetchAllSymbolD1Candles() {
    const exchanges = await this.getExchanges();
    if (!exchanges?.length) {
      Logger.error('No exchanges found', 'fetchAllSymbolD1Candles');
      return;
    }

    const jobs = [];
    for (const exchange of exchanges) {
      const lastFetchAllSymbolD1Candles = await this.global.getGlobalVariableTime(
        `LastFetchAllSymbolD1Candles_${exchange.name}`,
      );
      if (lastFetchAllSymbolD1Candles && Date.now() - lastFetchAllSymbolD1Candles < DAY_MSEC) {
        Logger.warn(
          `Delay fetch all symbol D1 candles ${Date.now() - lastFetchAllSymbolD1Candles} ms`,
          'fetchAllSymbolD1Candles',
        );
        return;
      }

      jobs.push(this.fetchExchangeAllSymbolD1Candles(exchange));
    }

    await Promise.all(jobs).catch((err) => {
      Logger.error(`Error fetch all symbol D1 candles: ${err.message}`, 'fetchAllSymbolD1Candles');
    });

    setTimeout(() => this.fetchAllSymbolD1Candles(), Math.random() * 1000 * 60 * 60);
  }

  async fetchAllSymbolH1Candles() {
    const exchanges = await this.getExchanges();
    if (!exchanges?.length) {
      Logger.error('No exchanges found', 'fetchAllSymbolH1Candles');
      return;
    }

    const jobs = [];
    for (const exchange of exchanges) {
      const lastFetchAllSymbolH1Candles = await this.global.getGlobalVariableTime(
        `LastFetchAllSymbolH1Candles_${exchange.name}`,
      );
      if (lastFetchAllSymbolH1Candles && Date.now() - lastFetchAllSymbolH1Candles < HOUR_MSEC) {
        Logger.warn(
          `Delay fetch all symbol H1 candles ${Date.now() - lastFetchAllSymbolH1Candles} ms`,
          `fetchAllSymbolH1Candles_${exchange.name}`,
        );
        return;
      }

      jobs.push(this.fetchExchangeAllSymbolH1Candles(exchange));
    }

    await Promise.all(jobs).catch((err) => {
      Logger.error(`Error fetch all symbol H1 candles: ${err.message}`, 'fetchAllSymbolH1Candles');
    });

    setTimeout(() => this.fetchAllSymbolH1Candles(), Math.random() * 1000 * 60);
  }

  async fetchAllSymbolM15Candles() {
    const exchanges = await this.getExchanges();
    if (!exchanges?.length) {
      Logger.error('No exchanges found', 'fetchAllSymbolM15Candles');
      return;
    }

    const jobs = [];
    for (const exchange of exchanges) {
      const lastFetchAllSymbolM15Candles = await this.global.getGlobalVariableTime(
        `LastFetchAllSymbolM15Candles_${exchange.name}`,
      );
      if (
        lastFetchAllSymbolM15Candles &&
        Date.now() - lastFetchAllSymbolM15Candles < MIN_MSEC * 15 &&
        process.env.NODE_ENV !== 'development'
      ) {
        console.log(process.env.NODE_ENV);
        Logger.warn(
          `Delay fetch all symbol M15 candles ${Date.now() - lastFetchAllSymbolM15Candles} ms`,
          `fetchAllSymbolM15Candles_${exchange.name}`,
        );
        return;
      }

      jobs.push(this.fetchExchangeAllSymbolM15Candles(exchange));
    }

    await Promise.all(jobs).catch((err) => {
      Logger.error(`Error fetch all symbol M15 candles: ${err.message}`, 'fetchAllSymbolM15Candles');
    });

    setTimeout(() => this.fetchAllSymbolM15Candles(), Math.random() * 1000 * 60);
  }

  async calculateAllATHL() {
    const lastCalculateAllATHL = await this.global.getGlobalVariableTime(`LastCalculateAllATHL`);
    if (lastCalculateAllATHL && Date.now() - lastCalculateAllATHL < CALCULATE_ATHL_PERIOD) {
      Logger.warn(`Delay calculate all ATHL ${Date.now() - lastCalculateAllATHL} ms`, 'calculateAllATHL');
      setTimeout(() => this.calculateAllATHL(), MIN_MSEC);
      return;
    }

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

    // console.log('daySymbols', daySymbols);

    const results = await mapLimit(daySymbols, 3, async (symbol) => {
      const lowTime = await this.prisma.candleD1.findFirst({
        where: {
          symbolId: symbol.symbolId,
          exchangeId: symbol.exchangeId,
          low: symbol._min.low,
        },
        select: {
          time: true,
        },
      });

      const highTime = await this.prisma.candleD1.findFirst({
        where: {
          symbolId: symbol.symbolId,
          exchangeId: symbol.exchangeId,
          high: symbol._max.high,
        },
        select: {
          time: true,
        },
      });

      return {
        ...symbol,
        lowTime: lowTime?.time,
        highTime: highTime?.time,
      };
    });

    // await this.prisma.aTHL.deleteMany({});

    Logger.log(`ATHL selected ${results.length} for ${(Date.now() - start) / 1000} sec`, 'calculateAllATHL');

    let i = 0;
    // for each symbolId and exchangeId
    for (const symbol of results) {
      i++;
      const firstCandle = await this.prisma.candleD1.findFirst({
        select: {
          open: true,
          time: true,
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
          time: true,
        },
        where: {
          symbolId: symbol.symbolId,
          exchangeId: symbol.exchangeId,
        },
        orderBy: {
          time: 'desc',
        },
      });

      const quantiles: Record<string, string | number>[] = await this.prisma.$queryRaw`
        select s."name"  as           symbol,
               e."name"  as           exchange,
               max(high) as           "ath",
               min(low)  as           "atl",
               percentile_cont(0.236) WITHIN GROUP (ORDER BY close) as "quantile236",
        percentile_cont(0.382) WITHIN
        GROUP (ORDER BY close) as "quantile382",
          percentile_cont(0.50) WITHIN
        GROUP (ORDER BY close) as "quantile50",
          percentile_cont(0.618) WITHIN
        GROUP (ORDER BY close) as "quantile618",
          percentile_cont(0.786) WITHIN
        GROUP (ORDER BY close) as "quantile786"
        FROM public."CandleD1" c
          INNER JOIN public."Symbol" s
        ON s.id = c."symbolId"
          INNER JOIN public."Exchange" e on e.id = c."exchangeId"
        WHERE
          e.id = ${symbol.exchangeId}
          AND
          s.id = ${symbol.symbolId}
        GROUP BY "symbol", "exchange"
        HAVING max (high) > 0.000000000001 AND min (low) > 0.000000000001
      `;
      // console.log(symbol.exchangeId, symbol.symbolId, quantiles);

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

      const ath = lastCandle.close / symbol._max.high - 1;

      await this.prisma.aTHL
        .upsert({
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
            highTime: symbol.highTime,
            low: symbol._min.low,
            lowTime: symbol.lowTime,
            quantile236: +quantiles?.[0]?.quantile236 || -1,
            quantile382: +quantiles?.[0]?.quantile382 || -1,
            quantile50: +quantiles?.[0]?.quantile50 || -1,
            quantile618: +quantiles?.[0]?.quantile618 || -1,
            quantile786: +quantiles?.[0]?.quantile786 || -1,
            start: firstCandle.open,
            startTime: firstCandle.time,
            close: lastCandle.close,
            closeTime: lastCandle.time,
            index,
            position,
            ath,
          },
          update: {
            high: symbol._max.high,
            highTime: symbol.highTime,
            low: symbol._min.low,
            lowTime: symbol.lowTime,
            quantile236: +quantiles?.[0]?.quantile236 || -1,
            quantile382: +quantiles?.[0]?.quantile382 || -1,
            quantile50: +quantiles?.[0]?.quantile50 || -1,
            quantile618: +quantiles?.[0]?.quantile618 || -1,
            quantile786: +quantiles?.[0]?.quantile786 || -1,
            start: firstCandle.open,
            startTime: firstCandle.time,
            close: lastCandle.close,
            closeTime: lastCandle.time,
            index,
            position,
            ath,
          },
        })
        .catch((err) => {
          Logger.error(
            `Error calculate all ATHL [${quantiles?.[0]?.exchange}] ${quantiles?.[0]?.symbol}: ${err.message}`,
            'calculateAllATHL',
          );
        });

      if (i % 100 === 0) {
        console.log(
          'ATHL',
          i,
          '/',
          daySymbols.length,
          '/',
          results.length,
          quantiles?.[0]?.exchange,
          quantiles?.[0]?.symbol,
          +quantiles?.[0]?.quantile618,
          quantiles?.[0]?.ath,
          (Date.now() - start) / 1000 / 60,
          'min',
        );
      }
    }

    await this.global.setGlobalVariable(`LastCalculateAllATHL`, 1);

    setTimeout(() => this.calculateAllATHL(), MIN_MSEC);
  }

  async fetchExchangeAllSymbolD1Candles(exchange: { id: number; name: string }): Promise<void> {
    const envExchanges =
      process.env.DAY_CANDLE_FETCH_EXCHANGES?.split(',')
        .map((e) => e.trim())
        .filter((e) => !!e) || [];
    const enabledExchanges = ENABLED_EXCHANGES.filter((e) => !envExchanges?.length || envExchanges.includes(e));

    if (!enabledExchanges.includes(exchange.name)) {
      Logger.warn(
        `[${exchange.name}] Exchange is not enabled: ${enabledExchanges.join(',')}`,
        'fetchAllSymbolD1Candles',
      );
      return;
    }

    Logger.debug(`[${exchange.name}] Prepare to fetch D1 candles`, 'fetchAllSymbolD1Candles');

    const markets = await this.prisma.market.findMany({
      select: {
        symbol: true,
        symbolId: true,
        synonym: true,
      },
      where: {
        exchangeId: exchange.id,
        disabled: false,
        symbol: {
          disabled: false, // Exclude markets for disabled symbols
        },
      },
      orderBy: {
        synonym: 'asc',
      },
    });
    // console.log('markets', exchange, markets.length);
    if (!markets?.length) {
      Logger.warn(`[${exchange.name}] No markets`, 'fetchAllSymbolD1Candles');
      return;
    }

    Logger.log(`[${exchange.name}] Fetching markets: ${markets.length}`, 'fetchAllSymbolD1Candles');

    for (const market of markets) {
      if (
        this.delayMarket_D1?.[exchange.id]?.[market.symbolId] &&
        Date.now() - this.delayMarket_D1[exchange.id][market.symbolId] < FETCH_DELAY
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
      if (exchange.name === 'htx') {
        const lastCandle = await this.prisma.candleD1.findFirst({
          select: {
            time: true,
          },
          where: {
            exchangeId: exchange.id,
            symbolId: market.symbolId,
            tf: timeframeMinutes(TIMEFRAME.D1),
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
            limit = 2;
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
          if (!this.delayMarket_D1[exchange.id]) {
            this.delayMarket_D1[exchange.id] = {};
          }

          Logger.warn(`Delay ${exchange.name} ${market.symbol.name}.D1 ${candles.length}`);
          this.delayMarket_D1[exchange.id][market.symbolId] = Date.now();
        }

        const saved = candles?.length
          ? await this.saveExchangeCandlesD1({
              exchangeId: exchange.id,
              symbolId: market.symbolId,
              timeframe: TIMEFRAME.D1,
              candles,
            })
          : { fetched: 0 };

        Logger.log(
          `Saved [${exchange.name}] ${market.symbol.name}.D1: ${saved?.count || 0}`,
          'fetchExchangeAllSymbolD1Candles',
        );
      }

      // 1-month candles
      if (exchange.name === 'htx') {
        limit = 0;
        const lastCandle = await this.prisma.candleD1.findFirst({
          select: {
            time: true,
          },
          where: {
            exchangeId: exchange.id,
            symbolId: market.symbolId,
            tf: timeframeMinutes(TIMEFRAME.MN1),
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
            if (!this.delayMarket_D1[exchange.id]) {
              this.delayMarket_D1[exchange.id] = {};
            }
            Logger.warn(`Delay ${exchange.name} ${market.symbol.name} ${candlesMN1.length}`);
            this.delayMarket_D1[exchange.id][market.symbolId] = Date.now();
          }

          const saved = candlesMN1?.length
            ? await this.saveExchangeCandlesD1({
                exchangeId: exchange.id,
                symbolId: market.symbolId,
                timeframe: TIMEFRAME.MN1,
                candles: candlesMN1,
              })
            : { fetched: 0 };

          Logger.log(
            `Saved [${exchange.name}] ${market.symbol.name}.D1: ${saved?.count || 0}`,
            'fetchExchangeAllSymbolD1Candles',
          );
        }
      }
    }

    await this.global.setGlobalVariable(`LastFetchAllSymbolD1Candles_${exchange.name}`, Date.now());
  }

  async fetchExchangeAllSymbolH1Candles(exchange: { id: number; name: string }): Promise<void> {
    const envExchanges =
      process.env.HOUR_CANDLE_FETCH_EXCHANGES?.split(',')
        .map((e) => e.trim())
        .filter((e) => !!e) || [];
    const enabledExchanges = ENABLED_EXCHANGES.filter((e) => !envExchanges?.length || envExchanges.includes(e));

    if (!enabledExchanges.includes(exchange.name)) {
      Logger.warn(
        `[${exchange.name}] Exchange is not enabled: ${enabledExchanges.join(',')}`,
        'fetchAllSymbolH1Candles',
      );
      return;
    }

    Logger.debug(`[${exchange.name}] Prepare to fetch H1 candles`, 'fetchAllSymbolH1Candles');

    const markets = await this.prisma.market.findMany({
      select: {
        symbol: true,
        symbolId: true,
        synonym: true,
      },
      where: {
        exchangeId: exchange.id,
        disabled: false,
        symbol: {
          disabled: false, // Exclude markets for disabled symbols
        },
      },
      orderBy: {
        synonym: 'asc',
      },
    });
    // console.log('markets', exchange, markets.length);
    if (!markets?.length) {
      Logger.warn(`[${exchange.name}] No markets`, 'fetchAllSymbolH1Candles');
      return;
    }

    Logger.log(`[${exchange.name}] Fetching markets: ${markets.length}`, 'fetchAllSymbolH1Candles');

    for (const market of markets) {
      if (
        this.delayMarket_H1?.[exchange.id]?.[market.symbolId] &&
        Date.now() - this.delayMarket_H1[exchange.id][market.symbolId] < MIN_MSEC * 15
      ) {
        continue;
      }

      if (!isCorrectSymbol(market.symbol.name)) {
        // Logger.debug(`Error symbol ${market.symbol.name}`, 'fetchAllSymbolH1Candles');
        continue;
      }

      if (this.badSymbols[exchange.id] && this.badSymbols[exchange.id].includes(market.symbol.name)) {
        continue;
      }

      // delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      let limit: number = 0;
      if (exchange.name === 'htx') {
        const lastCandle = await this.prisma.candleH1.findFirst({
          select: {
            time: true,
          },
          where: {
            exchangeId: exchange.id,
            symbolId: market.symbolId,
            tf: timeframeMinutes(TIMEFRAME.H1),
          },
          orderBy: {
            time: 'desc',
          },
        });

        if (lastCandle?.time) {
          if (
            getCandleTime(TIMEFRAME.H1, lastCandle.time) === getCandleTime(TIMEFRAME.H1) ||
            getCandleTime(TIMEFRAME.H1, lastCandle.time) === getCandleTimeByShift(TIMEFRAME.H1, 1)
          ) {
            limit = 2;
          }
        }
      }

      const candles = await this.fetchCandles({
        exchange: exchange.name,
        exchangeId: exchange.id,
        symbol: market.symbol.name,
        symbolId: market.symbolId,
        synonym: market.synonym,
        timeframe: TIMEFRAME.H1,
        limit,
      });

      if (typeof candles === 'string') {
        Logger.error(candles, 'fetchExchangeAllSymbolH1Candles');
      } else {
        if (candles.length <= 3) {
          if (!this.delayMarket_H1[exchange.id]) {
            this.delayMarket_H1[exchange.id] = {};
          }

          Logger.warn(`Delay ${exchange.name} ${market.symbol.name} ${candles.length}`);
          this.delayMarket_H1[exchange.id][market.symbolId] = Date.now();
        }

        const saved = candles?.length
          ? await this.saveExchangeCandlesH1({
              exchangeId: exchange.id,
              symbolId: market.symbolId,
              candles,
            })
          : { fetched: 0 };

        Logger.log(
          `Saved [${exchange.name}] ${market.symbol.name}.H1: ${saved?.count || 0}`,
          'fetchExchangeAllSymbolH1Candles',
        );
      }
    }

    await this.global.setGlobalVariable(`LastFetchAllSymbolH1Candles_${exchange.name}`, Date.now());
  }

  async fetchExchangeAllSymbolM15Candles(exchange: { id: number; name: string }): Promise<void> {
    const envExchanges =
      process.env.M15_CANDLE_FETCH_EXCHANGES?.split(',')
        .map((e) => e.trim())
        .filter((e) => !!e) || [];
    const enabledExchanges = ENABLED_EXCHANGES.filter((e) => !envExchanges?.length || envExchanges.includes(e));

    if (!enabledExchanges.includes(exchange.name)) {
      Logger.warn(
        `[${exchange.name}] Exchange is not enabled: ${enabledExchanges.join(',')}`,
        'fetchAllSymbolM15Candles',
      );
      return;
    }

    Logger.debug(`[${exchange.name}] Prepare to fetch M15 candles`, 'fetchAllSymbolM15Candles');

    const markets = await this.prisma.market.findMany({
      select: {
        symbol: true,
        symbolId: true,
        synonym: true,
      },
      where: {
        exchangeId: exchange.id,
        disabled: false,
        symbol: {
          disabled: false, // Exclude markets for disabled symbols
        },
      },
      orderBy: {
        synonym: 'asc',
      },
    });
    // console.log('markets', exchange, markets.length);
    if (!markets?.length) {
      Logger.warn(`[${exchange.name}] No markets`, 'fetchAllSymbolM15Candles');
      return;
    }

    Logger.log(`[${exchange.name}] Fetching markets: ${markets.length}`, 'fetchAllSymbolM15Candles');

    for (const market of markets) {
      if (
        this.delayMarket_M15?.[exchange.id]?.[market.symbolId] &&
        Date.now() - this.delayMarket_M15[exchange.id][market.symbolId] < MIN_MSEC * 5
      ) {
        continue;
      }

      if (!isCorrectSymbol(market.symbol.name)) {
        Logger.debug(`Error symbol ${market.symbol.name}`, 'fetchAllSymbolM15Candles');
        continue;
      }

      if (this.badSymbols[exchange.id] && this.badSymbols[exchange.id].includes(market.symbol.name)) {
        // Logger.debug(`Error symbol ${market.symbol.name}`, 'fetchAllSymbolM15Candles');
        continue;
      }

      // delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      let limit: number = 0;
      if (exchange.name === 'htx') {
        const lastCandle = await this.prisma.candleM15.findFirst({
          select: {
            time: true,
          },
          where: {
            exchangeId: exchange.id,
            symbolId: market.symbolId,
            tf: timeframeMinutes(TIMEFRAME.M15),
          },
          orderBy: {
            time: 'desc',
          },
        });

        if (lastCandle?.time) {
          if (
            getCandleTime(TIMEFRAME.M15, lastCandle.time) === getCandleTime(TIMEFRAME.M15) ||
            getCandleTime(TIMEFRAME.M15, lastCandle.time) === getCandleTimeByShift(TIMEFRAME.M15, 1)
          ) {
            limit = 2;
          }
        }
      }

      const candles = await this.fetchCandles({
        exchange: exchange.name,
        exchangeId: exchange.id,
        symbol: market.symbol.name,
        symbolId: market.symbolId,
        synonym: market.synonym,
        timeframe: TIMEFRAME.M15,
        limit,
      });

      if (typeof candles === 'string') {
        Logger.error(candles, 'fetchExchangeAllSymbolM15Candles');
      } else {
        if (candles.length <= 3) {
          if (!this.delayMarket_M15[exchange.id]) {
            this.delayMarket_M15[exchange.id] = {};
          }

          Logger.warn(`Delay ${exchange.name} ${market.symbol.name} ${candles.length}`);
          this.delayMarket_M15[exchange.id][market.symbolId] = Date.now();
        }

        const saved = candles?.length
          ? await this.saveExchangeCandlesM15({
              exchangeId: exchange.id,
              symbolId: market.symbolId,
              candles,
            })
          : { fetched: 0 };

        Logger.log(
          `Saved [${exchange.name}] ${market.symbol.name}.M15: ${saved?.count || 0}`,
          'fetchExchangeAllSymbolM15Candles',
        );
      }
    }

    await this.global.setGlobalVariable(`LastFetchAllSymbolM15Candles_${exchange.name}`, Date.now());
  }

  getHello(): string {
    const totalSeconds = Math.floor(process.uptime());
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    return `Works ${parts.join(' ')}`;
  }

  async getMaxTimestamp(body: { exchangeId: number; symbolId: number; tf: number }): Promise<Date | null> {
    const { exchangeId, symbolId, tf } = body;
    try {
      const maxTimestamp = await this.prisma.candle.findFirst({
        select: {
          time: true,
        },
        where: {
          exchangeId,
          symbolId,
          tf,
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

  async getMaxTimestampH1(body: { exchangeId: number; symbolId: number; timeframe: TIMEFRAME }): Promise<Date | null> {
    const { exchangeId, symbolId, timeframe } = body;
    try {
      const maxTimestamp = await this.prisma.candleH1.findFirst({
        select: {
          time: true,
        },
        where: {
          exchangeId,
          symbolId,
          tf: timeframeMinutes(timeframe),
        },
        orderBy: {
          time: 'desc',
        },
      });

      return maxTimestamp?.time || null;
    } catch (error) {
      Logger.error(`Error get a max timestamp: ${error.message}`, 'getMaxTimestampH1');
      return null;
    }
  }

  async getMaxTimestampD1(body: { exchangeId: number; symbolId: number; timeframe: TIMEFRAME }): Promise<Date | null> {
    const { exchangeId, symbolId, timeframe } = body;
    try {
      const maxTimestamp = await this.prisma.candleD1.findFirst({
        select: {
          time: true,
        },
        where: {
          exchangeId,
          symbolId,
          tf: timeframeMinutes(timeframe),
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
    const symbol = data.symbol.trim().toUpperCase().replace('-', '/');

    const exists = await this.prisma.symbol.findUnique({
      where: {
        name: symbol,
      },
    });

    if (exists) {
      return exists;
    }

    let newSymbol = null;
    try {
      Logger.log(`A new symbol [${symbol}]`, 'addSymbol');

      newSymbol = await this.prisma.symbol.create({
        data: {
          name: symbol,
          disabled: BAD_SYMBOL_CHARS.some((s) => symbol.includes(s)),
        },
      });
    } catch (e) {
      Logger.error(`Error add symbol [${symbol}]: ${e.message}`, 'addSymbol');
      return null;
    }

    // const value = await this.prisma.symbol.upsert({
    //   where: {
    //     name: symbol,
    //   } as any,
    //   create: {
    //     name: symbol,
    //   },
    //   update: {},
    // });

    return newSymbol;
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

  async getExchange(exchange: string): Promise<{ id: number; name: string } | null> {
    try {
      const row = await this.prisma.exchange.findUnique({
        select: {
          id: true,
          name: true,
        },
        where: {
          name: exchange,
        },
      });

      if (!row) {
        return null;
      }

      return { id: row.id, name: row.name };
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
    tf: number;
    candles: CandleDb[];
  }): Promise<any> {
    const { exchangeId, symbolId, tf, candles } = data;

    if (!candles?.length) {
      return { empty: true };
    }

    try {
      const timestamps = candles.map((candle) => candle.time);

      await this.prisma.candle.deleteMany({
        where: {
          exchangeId,
          symbolId,
          tf,
          time: {
            in: timestamps,
          },
        },
      });

      const candlesToSave = candles.map((candle) => ({
        ...candle,
        exchangeId,
        symbolId,
        tf,
      }));

      return this.prisma.candle.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error('Save Exchange Candles: ', error);
      return [];
    }
  }

  async saveExchangeCandlesH1(data: { exchangeId: number; symbolId: number; candles: CandleDb[] }): Promise<any> {
    const { exchangeId, symbolId, candles } = data;
    try {
      const timestamps = candles.map((candle) => candle.time);

      await this.prisma.candleH1.deleteMany({
        where: {
          exchangeId,
          symbolId,
          tf: 60,
          time: {
            in: timestamps,
          },
        },
      });

      const candlesToSave = candles.map((candle: CandleDb) => ({
        ...candle,
        exchangeId,
        symbolId,
        tf: 60,
      }));

      return this.prisma.candleH1.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
    } catch (error) {
      Logger.error(error.message, 'saveExchangeCandlesH1');
      return null;
    }
  }

  async saveExchangeCandlesM15(data: { exchangeId: number; symbolId: number; candles: CandleDb[] }): Promise<any> {
    const { exchangeId, symbolId, candles } = data;
    try {
      const timestamps = candles.map((candle) => candle.time);

      await this.prisma.candleM15.deleteMany({
        where: {
          exchangeId,
          symbolId,
          tf: 15,
          time: {
            in: timestamps,
          },
        },
      });

      const candlesToSave = candles.map((candle: CandleDb) => ({
        ...candle,
        exchangeId,
        symbolId,
        tf: 15,
      }));

      return this.prisma.candleM15.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
    } catch (error) {
      Logger.error(error.message, 'saveExchangeCandlesM15');
      return null;
    }
  }

  async saveExchangeCandlesD1(data: {
    exchangeId: number;
    symbolId: number;
    timeframe: TIMEFRAME;
    candles: CandleDb[];
  }): Promise<any> {
    const { exchangeId, symbolId, timeframe, candles } = data;
    try {
      const timestamps = candles.map((candle) => candle.time);

      await this.prisma.candleD1.deleteMany({
        where: {
          exchangeId,
          symbolId,
          tf: timeframeMinutes(timeframe),
          time: {
            in: timestamps,
          },
        },
      });

      const candlesToSave = candles.map((candle: CandleDb) => ({
        ...candle,
        exchangeId,
        symbolId,
        tf: timeframeMinutes(timeframe),
      }));

      return this.prisma.candleD1.createMany({
        data: candlesToSave,
        skipDuplicates: true,
      });
    } catch (error) {
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

    const exc = await this.getExchange(exchangeName);
    if (!exc) {
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
      counter++;

      symbols.push(market.symbol);
      const sym = await this.addSymbol({ symbol: market.symbol });
      if (!sym) {
        Logger.error(`Error loading symbol for [${exchangeName}] ${market.symbol}`, 'fetchMarkets');
        return;
      }

      if (!sym?.id) {
        Logger.error(
          `Error loading symbol for [${exchangeName}] ${market.symbol}: ${JSON.stringify(sym || {})}`,
          'fetchMarkets',
        );
        continue;
      }

      Logger.debug(`Check market ${exchangeName} ${market.symbol}: ${counter}/${totalMarkets}`, 'fetchMarkets');
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
        Logger.log(
          `A new market [${exchangeName}] symbol: ${market.symbol}, synonym: ${market.id} – ${counter}/${totalMarkets}`,
          'fetchMarkets',
        );

        await this.prisma.market.upsert({
          where: {
            symbolId_exchangeId: {
              symbolId: sym.id,
              exchangeId: exc.id,
            },
          },
          create: {
            symbolId: sym.id,
            synonym: market.id,
            exchangeId: exc.id,
            disabled: BAD_SYMBOL_CHARS.some((s) => market.id.includes(s)),
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

  async getCandles({
    exchange,
    symbol,
    timeframe,
  }: {
    exchange: string;
    symbol: string;
    timeframe: TIMEFRAME;
  }): Promise<CandleDb[]> {
    let collection = null;
    switch (timeframe) {
      case TIMEFRAME.M1:
        collection = this.prisma.candle;
        break;
      case TIMEFRAME.M15:
        collection = this.prisma.candleM15;
        break;
      case TIMEFRAME.H1:
        collection = this.prisma.candleH1;
        break;
      case TIMEFRAME.D1:
        collection = this.prisma.candleD1;
        break;
      default:
        Logger.error(`Error get a collection for timeframe ${timeframe}`, 'getCandles');
        return [];
    }

    return collection.findMany({
      where: {
        exchange: {
          name: exchange,
        },
        symbol: {
          name: symbol,
        },
        tf: timeframeMinutes(timeframe),
      },
      orderBy: {
        time: 'desc',
      },
      take: 1000,
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
          maxTimestamp = getCandleHumanTime(TIMEFRAME.D1, maxTimestamp);
          Logger.debug(
            `${exchange} ${symbol} ${timeframe} continue from ${maxTimestamp?.toISOString()}`,
            'fetchCandles',
          );
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
            case 'kucoin':
              maxTimestamp = await kucoinFindFirstCandle({ synonym, timeframe });

              if (!maxTimestamp) {
                Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                // await this.disableMarket({ exchangeId, symbolId });
                return [];
              }
              break;
            case 'okx':
              maxTimestamp = await okxFindFirstCandle({ synonym, timeframe });

              console.log('okxFindFirstCandle', symbol, new Date(maxTimestamp || 0).toISOString());

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
            case 'mexc':
              const firstResMexc = await mexcFindFirstCandle({ synonym, timeframe });

              if (typeof firstResMexc === 'string') {
                if (firstResMexc.toLowerCase().includes('Invalid symbol'.toLowerCase())) {
                  Logger.warn(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                  await this.disableMarket({ exchangeId, symbolId });
                }
                return [];
              }

              maxTimestamp = firstResMexc;
              break;
            case 'gateio':
              const firstResGateio = await gateioFindFirstCandle({ synonym, timeframe });

              if (typeof firstResGateio === 'string') {
                if (
                  firstResGateio.toLowerCase().includes('INVALID_CURRENCY_PAIR'.toLowerCase()) ||
                  firstResGateio.toLowerCase().includes('INVALID_CURRENCY'.toLowerCase())
                ) {
                  Logger.warn(`Disable market [${exchange}] ${symbol}`, 'fetchCandles');
                  await this.disableMarket({ exchangeId, symbolId });
                }
                return firstResGateio;
              }

              maxTimestamp = firstResGateio;
              break;
            case 'htx':
              break;
            default:
              return [];
          }
        }
      } else {
        maxTimestamp = await this.getMaxTimestamp({
          exchangeId,
          symbolId,
          tf: timeframeMinutes(timeframe),
        });

        if (maxTimestamp) {
          maxTimestamp = getCandleHumanTime(timeframe, maxTimestamp);
          Logger.debug(
            `${exchange} ${symbol} ${timeframe} continue from ${maxTimestamp?.toISOString()}`,
            'fetchCandles',
          );
        } else {
          switch (exchange) {
            case 'bybit':
              maxTimestamp = await bybitFindFirstCandle({
                synonym,
                timeframe,
              });

              if (!maxTimestamp) {
                Logger.error(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                await this.disableMarket({ exchangeId, symbolId });
                return [];
              }
              break;
            case 'mexc':
              const firstResMexc = await mexcFindFirstCandle({
                synonym,
                timeframe,
              });

              if (typeof firstResMexc === 'string') {
                if (firstResMexc.toLowerCase().includes('Invalid symbol'.toLowerCase())) {
                  Logger.warn(`Disable market ${exchange} ${symbol}`, 'fetchCandles');
                  await this.disableMarket({ exchangeId, symbolId });
                }
                return [];
              }

              maxTimestamp = firstResMexc;

              break;
            default:
              maxTimestamp = getStartFetchTime(timeframe);
          }
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
        endTime = Math.min(startTime + (limit || 100) * timeframeMSeconds(timeframe), getCandleTime(timeframe));
        candles = await okxFetchCandles(synonym, OKX_TIMEFRAME[timeframe], startTime, endTime, limit || 100);
        break;
      case 'kucoin':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        endTime = Math.min(startTime + (limit || 1500) * timeframeMSeconds(timeframe), getCandleTime(timeframe));
        candles = await kucoinFetchCandles({ synonym, timeframe, start: startTime, end: endTime });
        break;
      case 'htx':
        candles = await htxFetchCandles(synonym, HTX_TIMEFRAME[timeframe], limit || 2000);
        break;
      case 'poloniex':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        endTime = Math.min(startTime + (limit || 499) * timeframeMSeconds(timeframe), getCandleTime(timeframe));

        if (startTime >= endTime) {
          // always fetch last candle
          startTime = getCandleTimeByShift(timeframe, 1);
          // return [];
        }

        candles = await poloniexFetchCandles(synonym, POLONIEX_TIMEFRAME[timeframe], startTime, endTime, limit || 500);
        break;
      case 'gateio':
        // seconds
        startTime = start || (maxTimestamp ? Math.ceil(maxTimestamp.getTime() / 1000) : 0);
        if (startTime * 1000 < getCandleTimeByShift(timeframe, 9998)) {
          startTime = Math.ceil(getCandleTimeByShift(timeframe, 9998) / 1000);
        }
        endTime = Math.min(
          startTime + (limit || 500) * timeframeSeconds(timeframe),
          Math.ceil(getCandleTime(timeframe) / 1000),
        );
        if (startTime >= endTime) {
          // always fetch last candle
          startTime = Math.ceil(getCandleTimeByShift(timeframe, 1) / 1000); // seconds
          // return [];
        }
        candles = await gateioFetchCandles({ synonym, timeframe, start: startTime, end: endTime });

        if (typeof candles === 'string') {
          if (
            candles.toLowerCase().includes('INVALID_CURRENCY_PAIR'.toLowerCase()) ||
            candles.toLowerCase().includes('INVALID_CURRENCY'.toLowerCase())
          ) {
            Logger.warn(`Disable market [${exchange}] ${symbol}`, 'fetchCandles');
            await this.disableMarket({ exchangeId, symbolId });
          }
          return candles;
        }

        break;
      case 'mexc':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        endTime = startTime + (limit || 999) * timeframeMSeconds(timeframe);

        if (startTime >= endTime) {
          // always fetch the last candle
          startTime = getCandleTimeByShift(timeframe, 1);
          // return [];
        }

        candles = await mexcFetchCandles({ synonym, timeframe, start: startTime, end: endTime, limit: limit || 999 });
        break;
      case 'bybit':
        startTime = start || maxTimestamp ? maxTimestamp.getTime() : 0;
        if (startTime >= endTime) {
          // always fetch the last candle
          startTime = getCandleTimeByShift(timeframe, 1);
          // return [];
        }
        candles = await bybitFetchCandles(synonym, BYBIT_TIMEFRAME[timeframe], startTime, limit || 999);
        break;
      default:
        return [];
    }

    if (typeof candles === 'string') {
      if (
        candles.toLowerCase().includes('Instrument ID does not exist'.toLowerCase()) ||
        candles.toLowerCase().includes('invalid symbol') ||
        candles.toLowerCase().includes('could not get the candlesticks for symbol')
      ) {
        Logger.error(`[${exchange}] Disable market ${symbol}`, 'fetchCandles');

        await this.disableMarket({ exchangeId, symbolId });
      }

      return `[${exchange}] Error fetch candles ${symbol} ${timeframe}: ${candles}`;
    }
    if (!candles) {
      return `Error fetch candles ${exchange} ${symbol}} ${timeframe}`;
    }

    return candles
      .map((candle) => ({ ...candle, time: getCandleHumanTime(timeframe, candle.time) }))
      .sort((a, b) => {
        return a.time.getTime() - b.time.getTime();
      });
  }

  async getATHL(): Promise<any[]> {
    // select top coins form prisma, which is not in the array STABLES, limit 30 records
    return this.prisma.aTHL.findMany({
      select: {
        exchange: {
          select: { name: true },
        },
        symbol: {
          select: { name: true },
        },
        high: true,
        low: true,
        quantile236: true,
        quantile382: true,
        quantile50: true,
        quantile618: true,
        quantile786: true,
        highTime: true,
        lowTime: true,
        startTime: true,
        closeTime: true,
        index: true,
        position: true,
        ath: true,
      },
      where: {
        symbol: {
          name: {
            endsWith: '/USDT',
          },
          disabled: false,
        },
      },
      orderBy: [
        { symbol: { name: 'asc' } },
        { closeTime: 'desc' },
        { ath: 'desc' },
        { position: 'desc' },
      ],
    });
  }

  async getATHLSymbol(symbol: string): Promise<any> {
    // select top coins form prisma, which is not in the array STABLES, limit 30 records
    return this.prisma.aTHL.findMany({
      select: {
        exchange: {
          select: { name: true },
        },
        symbol: {
          select: { name: true },
        },
        high: true,
        low: true,
        quantile236: true,
        quantile382: true,
        quantile50: true,
        quantile618: true,
        quantile786: true,
        highTime: true,
        lowTime: true,
        startTime: true,
        closeTime: true,
        index: true,
        position: true,
        ath: true,
      },
      where: {
        symbol: {
          name: {
            equals: symbol.toUpperCase().replace('-', '/'),
          },
          disabled: false,
        },
      },
      orderBy: [
        { symbol: { name: 'asc' } },
        { closeTime: 'desc' },
        { ath: 'desc' },
        { position: 'desc' },
      ],
    });
  }

  async getTopTradeCoins(minTurnover?: number): Promise<any[]> {
    return this.prisma.$queryRaw`
      WITH LastCandles AS (SELECT a."time",
                                  a."symbolId",
                                  s."name"         as symbol,
                                  a."exchangeId",
                                  e."name"         as exchange,
                                  "exchangeId",
                                  "close",
                                  volume,
                                  "close" * volume AS cost,
                                  trades,
                                  ROW_NUMBER()        OVER (PARTITION BY "symbolId", "exchangeId" ORDER BY "time" DESC) AS rn
                           FROM public."CandleD1" as a
                                  INNER JOIN "Symbol" s
                                             ON s.id = a."symbolId"
                                  INNER JOIN "Exchange" e
                                             ON e.id = a."exchangeId"
                           where a.time < current_date
                             and a.time > current_date - interval '3 days' and
        a.tf = ${timeframeMinutes(TIMEFRAME.D1)} and
        (
        s."name" LIKE '%/USDT' or
        s."name" LIKE '%/BUSD' or
        s."name" LIKE '%/USDC' or
        s."name" LIKE '%/TUSD' or
        s."name" LIKE '%/USD'
        )
        )
      SELECT "symbol",
             "exchange",
             "time",
             "close",
             volume,
             cost,
             trades
      FROM LastCandles
      WHERE rn = 1
        and "cost" > ${minTurnover || 1000}
      ORDER BY cost desc;
    `;
  }

  async updateTopCoins(): Promise<any[]> {
    const coins: any[] = topCoins;

    for (const coin of coins) {
      try {
        const data = {
          name: coin[1],
          logo: coin[2],
          price:
            typeof coin[3] === 'string' && +coin[3].replaceAll('$', '').replaceAll(',', '').replaceAll('...', '')
              ? +coin[3].replaceAll('$', '').replaceAll(',', '').replaceAll('...', '')
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
        Logger.error(`Error update Top Coins: ${e.message}. ${JSON.stringify(coin)}`, 'updateTopCoins');
      }
    }

    return coins.map((coin) => coin[0]);
  }

  async fetchAllMarkets(): Promise<void> {
    const envExchanges =
      process.env.FETCH_EXCHANGES?.split(',')
        .map((e) => e.trim())
        .filter((e) => !!e) || [];
    const enabledExchanges = ENABLED_EXCHANGES.filter((e) => !envExchanges?.length || envExchanges.includes(e));

    for (const exchange of enabledExchanges) {
      const lastMarketsUpdate = await this.global.getGlobalVariableTime(`LastMarketsUpdate_${exchange}`);
      if (lastMarketsUpdate && Date.now() - lastMarketsUpdate < MARKET_UPDATE_TIMEOUT) {
        Logger.warn(`[${exchange}] Delay fetch markets`, 'fetchAllMarkets');
        continue;
      }

      Logger.log(`[${exchange}] Fetching markets`, 'fetchAllMarkets');

      await this.fetchMarkets(exchange);

      await this.global.setGlobalVariable(`LastMarketsUpdate_${exchange}`, 1);
    }
  }
}
