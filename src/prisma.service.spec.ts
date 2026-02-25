import { PrismaService } from './prisma.service';

// Mock @prisma/client so PrismaService can be instantiated without a DB connection
jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
    $queryRaw = jest.fn();
    topCoinFromCmc = { count: jest.fn(), findMany: jest.fn() };
    topCoin = { count: jest.fn(), findMany: jest.fn() };
  }
  return {
    PrismaClient: MockPrismaClient,
    Prisma: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
        ({ text: strings.raw.join('?'), values } as unknown),
      join: (arr: unknown[]) => arr,
    },
  };
});

function makeService(): PrismaService {
  const svc = new PrismaService();
  return svc;
}

describe('PrismaService.hasTopCoinFromCmcData', () => {
  it('returns true when CMC table has rows', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(5);

    expect(await svc.hasTopCoinFromCmcData()).toBe(true);
    expect(svc.topCoinFromCmc.count).toHaveBeenCalledWith({ take: 1 });
  });

  it('returns false when CMC table is empty', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(0);

    expect(await svc.hasTopCoinFromCmcData()).toBe(false);
  });
});

describe('PrismaService.getTopCoinCounts', () => {
  it('returns counts from both tables', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(150);
    (svc.topCoin.count as jest.Mock).mockResolvedValue(500);

    const result = await svc.getTopCoinCounts();

    expect(result).toEqual({ topCoinFromCmc: 150, topCoin: 500 });
  });
});

describe('PrismaService.getTopCoins', () => {
  it('returns CMC-mapped coins when CMC table has data', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(2);
    (svc.topCoinFromCmc.findMany as jest.Mock).mockResolvedValue([
      { id: 1, symbol: 'BTC', name: 'Bitcoin', logo: null, price: 42000, volume24h: 1e9, circulatingSupply: 19e6, marketCap: 8e11, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, symbol: 'ETH', name: 'Ethereum', logo: null, price: 3500, volume24h: 500e6, circulatingSupply: 120e6, marketCap: 4e11, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const result = await svc.getTopCoins();

    expect(result).toHaveLength(2);
    expect(result[0].coin).toBe('BTC');
    expect(result[0].price).toBe(42000);
    expect(result[0].volume24).toBe(1e9);
    expect(result[0].cost24).toBe(1e9 * 42000);
    expect(result[0].costCap).toBe(8e11);
  });

  it('falls back to TopCoin table when CMC table is empty', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(0);
    (svc.topCoin.findMany as jest.Mock).mockResolvedValue([{ id: 1, coin: 'BTC', cost24: 1e9 }]);

    const result = await svc.getTopCoins();

    expect(svc.topCoin.findMany).toHaveBeenCalled();
    expect(result[0].coin).toBe('BTC');
  });

  it('queries CMC with STABLES excluded and ordered by volume24h desc', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(1);
    (svc.topCoinFromCmc.findMany as jest.Mock).mockResolvedValue([]);

    await svc.getTopCoins();

    const args = (svc.topCoinFromCmc.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.symbol.notIn).toContain('USDT');
    expect(args.orderBy).toEqual({ volume24h: 'desc' });
  });
});

describe('PrismaService.getTopCoinMarkets', () => {
  it('executes $queryRaw when CMC has data', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(5);
    (svc.$queryRaw as jest.Mock).mockResolvedValue([{ coin: 'BTC', exchange: 'binance' }]);

    const result = await svc.getTopCoinMarkets();

    expect(svc.$queryRaw).toHaveBeenCalled();
    expect(result[0].coin).toBe('BTC');
  });

  it('falls back to TopCoin $queryRaw when CMC is empty', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(0);
    (svc.$queryRaw as jest.Mock).mockResolvedValue([{ coin: 'ETH', exchange: 'okx' }]);

    const result = await svc.getTopCoinMarkets();

    expect(svc.$queryRaw).toHaveBeenCalled();
    expect(result[0].coin).toBe('ETH');
  });
});

describe('PrismaService.getTopCoinFirstExchange', () => {
  it('returns CMC-based query result when CMC has data', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(10);
    (svc.$queryRaw as jest.Mock).mockResolvedValue([
      { coin: 'BTC', symbol: 'BTC/USDT', exchange: 'binance', exchangeId: 1, symbolId: 1 },
    ]);

    const result = await svc.getTopCoinFirstExchange();

    expect(svc.$queryRaw).toHaveBeenCalled();
    expect(result[0].coin).toBe('BTC');
    expect(result[0].exchange).toBe('binance');
  });

  it('falls back to TopCoin query when CMC is empty', async () => {
    const svc = makeService();
    (svc.topCoinFromCmc.count as jest.Mock).mockResolvedValue(0);
    (svc.$queryRaw as jest.Mock).mockResolvedValue([
      { coin: 'ETH', symbol: 'ETH/USDT', exchange: 'okx', exchangeId: 9, symbolId: 2 },
    ]);

    const result = await svc.getTopCoinFirstExchange();

    expect(svc.$queryRaw).toHaveBeenCalled();
    expect(result[0].coin).toBe('ETH');
  });
});
