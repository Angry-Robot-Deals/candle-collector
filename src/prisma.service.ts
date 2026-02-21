import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { STABLES, TOP_COIN_EXCHANGES } from './exchange.constant';

const DB_CONNECT_RETRIES = 10;
const DB_CONNECT_RETRY_DELAY_MS = 3000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt === DB_CONNECT_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, DB_CONNECT_RETRY_DELAY_MS));
      }
    }
  }

  /** True if TopCoinFromCmc has at least one row (use CMC as source for top coins). */
  async hasTopCoinFromCmcData(): Promise<boolean> {
    const count = await this.topCoinFromCmc.count({ take: 1 });
    return count > 0;
  }

  async getTopCoins(): Promise<any[]> {
    const useCmc = await this.hasTopCoinFromCmcData();
    if (useCmc) {
      const rows = await this.topCoinFromCmc.findMany({
        where: { symbol: { notIn: STABLES } },
        orderBy: { volume24h: 'desc' },
      });
      return rows.map((r) => ({
        id: r.id,
        coin: r.symbol,
        name: r.name,
        logo: r.logo,
        price: r.price,
        volume24: r.volume24h,
        cost24: r.volume24h * r.price || 0,
        volumeCap: r.circulatingSupply ?? 0,
        costCap: r.marketCap,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }
    return this.topCoin.findMany({
      where: { NOT: { coin: { in: STABLES } } },
      orderBy: { cost24: 'desc' },
    });
  }

  async getTopCoinMarkets(): Promise<any[]> {
    const useCmc = await this.hasTopCoinFromCmcData();
    if (useCmc) {
      return this.$queryRaw`
        SELECT tc.symbol AS coin, s.id as "symbolId", s.name as symbol, e.id as "exchangeId", e.name as exchange
        FROM public."TopCoinFromCmc" AS tc
        INNER JOIN public."Symbol" AS s ON s."name" = tc.symbol || '/USDT'
        INNER JOIN public."Market" AS m ON m."symbolId" = s.id
        INNER JOIN public."Exchange" AS e ON m."exchangeId" = e.id
        WHERE s.disabled != true
        ORDER BY tc.symbol ASC, e.priority
      `;
    }
    return this.$queryRaw`
      SELECT tc.coin, s.id as "symbolId", s.name as symbol, e.id as "exchangeId", e.name as exchange
      FROM public."TopCoin" AS tc
      INNER JOIN public."Symbol" AS s ON s."name" = tc.coin || '/USDT'
      INNER JOIN public."Market" AS m ON m."symbolId" = s.id
      INNER JOIN public."Exchange" AS e ON m."exchangeId" = e.id
      WHERE s.disabled != true
      ORDER BY tc.coin ASC, e.priority
    `;
  }

  async getTopCoinFirstExchange(): Promise<any[]> {
    const useCmc = await this.hasTopCoinFromCmcData();
    if (useCmc) {
      const query = Prisma.sql`
        WITH RankedExchanges AS (
          SELECT
            tc.symbol AS coin,
            s.id AS "symbolId",
            s.name AS symbol,
            e.id AS "exchangeId",
            e.name AS exchange,
            ROW_NUMBER() OVER(PARTITION BY s.id ORDER BY e.priority ASC) AS rn
          FROM public."TopCoinFromCmc" AS tc
          INNER JOIN public."Symbol" AS s ON s."name" = tc.symbol || '/USDT'
          INNER JOIN public."Market" AS m ON m."symbolId" = s.id
          INNER JOIN public."Exchange" AS e ON m."exchangeId" = e.id
          WHERE s.disabled != true AND m.disabled != true AND LOWER(e.name) IN (${Prisma.join(TOP_COIN_EXCHANGES.map((ex) => ex.toLowerCase()))})
          ORDER BY tc."volume24h" DESC
        )
        SELECT coin, "symbolId", symbol, "exchangeId", exchange
        FROM RankedExchanges
        WHERE rn = 1 AND NOT coin IN (${Prisma.join(STABLES)})
        ORDER BY coin ASC
      `;
      return this.$queryRaw(query);
    }
    const query = Prisma.sql`
      WITH RankedExchanges AS (
        SELECT
          tc.coin AS coin,
          s.id AS "symbolId",
          s.name AS symbol,
          e.id AS "exchangeId",
          e.name AS exchange,
          ROW_NUMBER() OVER(PARTITION BY s.id ORDER BY e.priority ASC) AS rn
        FROM public."TopCoin" AS tc
        INNER JOIN public."Symbol" AS s ON s."name" = tc.coin || '/USDT'
        INNER JOIN public."Market" AS m ON m."symbolId" = s.id
        INNER JOIN public."Exchange" AS e ON m."exchangeId" = e.id
        WHERE s.disabled != true AND m.disabled != true AND LOWER(e.name) IN (${Prisma.join(TOP_COIN_EXCHANGES.map((exchange) => exchange.toLowerCase()))})
        ORDER BY tc."cost24" DESC
      )
      SELECT coin, "symbolId", symbol, "exchangeId", exchange
      FROM RankedExchanges
      WHERE rn = 1 AND NOT coin IN (${Prisma.join(STABLES)})
      ORDER BY coin ASC
    `;
    return this.$queryRaw(query);
  }
}
