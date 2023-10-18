import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Exchange, Market, Symbol as SymbolModel } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('symbol')
  getAllSymbols(): Promise<SymbolModel[]> {
    return this.prisma.symbol.findMany();
  }

  @Get('exchange')
  async getAllExchanges(): Promise<Exchange[]> {
    return this.prisma.exchange.findMany();
  }

  @Get('market')
  async getAllMarkets(): Promise<Market[]> {
    return this.prisma.market.findMany();
  }

  @Post('candle/download')
  async fetchCandles(
    @Body()
    body: {
      exchange: string;
      symbol: string;
      timeframe: string;
      start: number;
      limit: number;
    },
  ): Promise<string> {
    return this.appService.fetchCandles(body);
  }
}
