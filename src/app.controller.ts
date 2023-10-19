import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Exchange, Market, Symbol as SymbolModel } from '@prisma/client';
import { AppService } from './app.service';
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

  @Get('updateTopCoins')
  async updateTopCoins(): Promise<Market[]> {
    return this.appService.updateTopCoins();
  }

  @Get('market/fetch/:exchange')
  async fetchMarkets(@Param('exchange') exchange: string): Promise<string[]> {
    return this.appService.fetchMarkets(exchange);
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
