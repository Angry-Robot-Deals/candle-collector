import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Exchange as ExchangeModel, Market as MarketModel } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AppService } from './app.service';
import { TIMEFRAME } from './timeseries.interface';

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

  @Get('market/fetch/:exchange')
  async fetchMarkets(@Param('exchange') exchange: string): Promise<string[]> {
    return this.appService.fetchMarkets(exchange);
  }

  @Post('candle/download')
  async fetchCandles(
    @Body() body: { exchange: string; symbol: string; timeframe: TIMEFRAME; start: number; limit: number },
  ): Promise<any[] | string> {
    return this.appService.fetchCandles(body);
  }
}
