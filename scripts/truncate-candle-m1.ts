/**
 * Truncate the 1-minute candles table (Candle).
 * Run: DATABASE_URL="..." npx ts-node scripts/truncate-candle-m1.ts
 * Or from repo root: docker compose -p cc run --rm candles node -e "
 *   const { PrismaClient } = require('@prisma/client');
 *   const p = new PrismaClient();
 *   p.candle.deleteMany({}).then(r => { console.log('Deleted', r.count); p.\$disconnect(); });
 * "
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const result = await prisma.candle.deleteMany({});
  console.log('Deleted', result.count, 'rows from Candle (1m)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
