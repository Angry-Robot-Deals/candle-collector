import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Exchange, Symbol as SymbolModel } from '@prisma/client';
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
  getSymbols(): Promise<SymbolModel[]> {
    return this.prisma.symbol.findMany();
  }

  @Get('exchange')
  async getAllUsers(): Promise<Exchange[]> {
    return this.prisma.exchange.findMany();
  }
}
