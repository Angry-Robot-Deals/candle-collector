import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Exchange as ExchangeModel, Market as MarketModel } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AppService } from './app.service';
import { TIMEFRAME } from './timeseries.interface';
import { CandleDb } from './interface';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get() getHello(): string {
    return this.appService.getHello();
  }

  @Get('exchange')
  async getAllExchanges(): Promise<ExchangeModel[]> {
    return this.prisma.exchange.findMany();
  }

  @Get('market')
  async getAllMarkets(): Promise<MarketModel[]> {
    return this.prisma.market.findMany();
  }

  @Get('updateTopCoins')
  async updateTopCoins(): Promise<any[]> {
    return this.appService.updateTopCoins();
  }

  @Get('updateTopCoinsFromCmc')
  async updateTopCoinsFromCmc(): Promise<{ ok: boolean; message: string }> {
    await this.appService.updateTopCoinsFromCmc();
    return { ok: true, message: 'CMC top coins updated' };
  }

  @Get('getTopCoins')
  async getTopCoins(): Promise<any[]> {
    return this.prisma.getTopCoins();
  }

  @Get('getTopCoinMarkets')
  async getTopCoinMarkets(): Promise<any[]> {
    return this.prisma.getTopCoinMarkets();
  }

  @Get('getTopCoinFirstExchange')
  async getTopCoinFirstExchange(): Promise<any> {
    const data = await this.prisma.getTopCoinFirstExchange();
    return { count: (data as any[]).length, data };
  }

  @Get('getTopCoinCounts')
  async getTopCoinCounts(): Promise<{ topCoinFromCmc: number; topCoin: number }> {
    return this.prisma.getTopCoinCounts();
  }

  @Get('getATHL')
  async getATHL(): Promise<any[]> {
    return this.appService.getATHL();
  }

  @Get('getATHL/:symbol')
  async getATHLSymbol(@Param('symbol') symbol: string): Promise<any> {
    return this.appService.getATHLSymbol(symbol);
  }

  @Get('getTopTradeCoins') // show top coins by turnover in USD
  // example: http://localhost:3000/getTopTradeCoins?turnover=1000000
  async getTopTradeCoins(@Query('turnover') turnover: string): Promise<any[]> {
    return this.appService.getTopTradeCoins(+turnover || undefined);
  }

  @Get('market/fetch-all')
  async fetchAllMarkets(): Promise<string[]> {
    await this.appService.fetchAllMarkets();
    return ['ok'];
  }

  @Get('market/fetch/:exchange')
  async fetchMarkets(@Param('exchange') exchange: string): Promise<string[]> {
    return this.appService.fetchMarkets(exchange);
  }

  @Post('candle/list')
  async getCandles(@Body() body: { exchange: string; symbol: string; timeframe: TIMEFRAME }): Promise<CandleDb[]> {
    return this.appService.getCandles(body);
  }

  @Post('candle/download')
  async fetchCandles(
    @Body() body: { exchange: string; symbol: string; timeframe: TIMEFRAME; start: number; limit: number },
  ): Promise<any[] | string> {
    return this.appService.fetchCandles(body);
  }
}
