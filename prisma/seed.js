import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const symbolData = [
  {
    symbol: 'BTC/USDT',
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
  console.log(`Start seeding ...`);
  for (const u of symbolData) {
    const symbol = await prisma.symbol.create({
      data: u,
    });
    console.log(`Created user with id: ${symbol.id}`);
  }
  for (const u of exchangeData) {
    const exchange = await prisma.exchange.create({
      data: u,
    });
    console.log(`Created exchange with id: ${exchange.id}`);
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
