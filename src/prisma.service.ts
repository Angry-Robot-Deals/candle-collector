import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { STABLES, TOP_COIN_EXCHANGES } from './exchange.constant';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async getTopCoins(): Promise<any[]> {
    // select top coins form prisma, which is not in the array STABLES, limit 30 records
    return this.topCoin.findMany({
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

  async getTopCoinMarkets(): Promise<any[]> {
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
        WHERE s.disabled != true AND LOWER(e.name) IN (${Prisma.join(TOP_COIN_EXCHANGES.map((exchange) => exchange.toLowerCase()))})
        order by tc."cost24" desc
      )
      SELECT
        coin,
        "symbolId",
        symbol,
        "exchangeId",
        exchange
      FROM RankedExchanges
      WHERE
        rn = 1
        AND NOT coin IN (${Prisma.join(STABLES)})
      ORDER BY coin ASC
    `;

    return this.$queryRaw(query);
  }
}
