import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exchangeData = [
  {
    name: 'binance',
    apiUri: 'https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data',
  },
  {
    name: 'bitmart',
    apiUri: 'https://developer-pro.bitmart.com/en/spot/#get-history-k-line-v3',
  },
  {
    name: 'bybit',
    apiUri: 'https://bybit-exchange.github.io/docs/v5/market/kline',
  },
  {
    name: 'poloniex',
    apiUri: 'https://docs.poloniex.com/#public-endpoints-market-data-candles',
  },
  {
    name: 'htx',
    apiUri: 'https://huobiapi.github.io/docs/spot/v1/en/#get-klines-candles',
  },
  {
    name: 'kucoin',
    apiUri: 'https://www.kucoin.com/docs/rest/spot-trading/market-data/get-klines',
  },
  {
    name: 'mexc',
    apiUri: 'https://mexcdevelop.github.io/apidocs/spot_v3_en/#kline-candlestick-data',
  },
  {
    name: 'gateio',
    apiUri: 'https://www.gate.io/docs/developers/apiv4/en/#market-candlesticks',
  },
  {
    name: 'okx',
    apiUri: 'https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks',
  },
  {
    name: 'bitget',
    apiUri: 'https://bitgetlimited.github.io/apidoc/en/spot/#get-candlestick-data',
  },
  {
    name: 'coinbasepro',
    apiUri: '',
  },
];

async function main() {
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
