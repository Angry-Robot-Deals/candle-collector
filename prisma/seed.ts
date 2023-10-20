import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const marketData = [
  {
    symbol: 'BTC/USDT',
    synonym: 'BTCUSDT',
    exchange: 'binance',
    description: '',
  },
];

const exchangeData = [
  {
    name: 'binance',
    api: 'https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data',
  },
];

async function main() {
  for (const u of exchangeData) {
    const exchange = await prisma.exchange.create({
      data: u,
    });
    console.log(`Created exchange with id: ${exchange.id}`);
  }
  for (const u of marketData) {
    const market = await prisma.market.create({
      data: u,
    });
    console.log(`Created market with id: ${market.id}`);
  }
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
