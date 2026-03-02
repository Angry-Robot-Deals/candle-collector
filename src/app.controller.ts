import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Exchange as ExchangeModel, Market as MarketModel } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AppService } from './app.service';
import { TIMEFRAME } from './timeseries.interface';
import { CandleDb } from './interface';
import { timeframeMinutes } from './timeseries.constant';

/** Timeframe values supported by the state machine. */
const VALID_TF_MINUTES = new Set([
  timeframeMinutes(TIMEFRAME.M1),
  timeframeMinutes(TIMEFRAME.M15),
  timeframeMinutes(TIMEFRAME.H1),
  timeframeMinutes(TIMEFRAME.D1),
]);

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

  // ---------------------------------------------------------------------------
  // Candle update status — pause / resume
  // ---------------------------------------------------------------------------

  @Patch('market/:marketId/candle-status/:tf/pause')
  @HttpCode(200)
  async pauseCandleStatus(
    @Param('marketId') marketId: string,
    @Param('tf') tf: string,
  ): Promise<{ ok: boolean; status: number }> {
    return this.setCandleStatus(+marketId, +tf, -200);
  }

  @Patch('market/:marketId/candle-status/:tf/resume')
  @HttpCode(200)
  async resumeCandleStatus(
    @Param('marketId') marketId: string,
    @Param('tf') tf: string,
  ): Promise<{ ok: boolean; status: number }> {
    return this.setCandleStatus(+marketId, +tf, 0);
  }

  private async setCandleStatus(
    marketId: number,
    tf: number,
    newStatus: number,
  ): Promise<{ ok: boolean; status: number }> {
    if (!Number.isInteger(marketId) || marketId <= 0) {
      throw new BadRequestException(`Invalid marketId: ${marketId}`);
    }
    if (!VALID_TF_MINUTES.has(tf)) {
      throw new BadRequestException(`Invalid tf=${tf}. Valid values: ${[...VALID_TF_MINUTES].join(', ')}`);
    }

    const market = await this.prisma.market.findUnique({ where: { id: marketId }, select: { id: true } });
    if (!market) {
      throw new NotFoundException(`Market ${marketId} not found`);
    }

    const rec = await this.prisma.getCandleUpdateStatus(marketId, tf);
    if (!rec) {
      throw new NotFoundException(`CandleUpdateStatus for market=${marketId} tf=${tf} not found`);
    }

    await this.prisma.updateCandleStatusFields(marketId, tf, { status: newStatus });
    return { ok: true, status: newStatus };
  }
}
