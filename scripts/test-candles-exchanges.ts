#!/usr/bin/env ts-node
/**
 * Integration test: fetchLastCandles for all 9 exchanges.
 *
 * Checks step-by-step for each exchange + timeframe:
 *   1. API responds without error
 *   2. At least LIMIT candles returned
 *   3. Current candle (getCandleTime) is present in the batch (hasCurrent)
 *   4. Candles are sorted oldest-first
 *
 * Run:
 *   pnpm test:exchanges                         — all exchanges, M1 + M15
 *   pnpm test:exchanges -- --exchange binance   — only binance
 *   pnpm test:exchanges -- --tf M1              — only M1
 *
 * Note: real API calls, no mocks. Requires internet access.
 */

import { fetchLastCandles } from '../src/exchange-fetch-last-candles';
import { getCandleTime } from '../src/timeseries';
import { timeframeMSeconds } from '../src/timeseries.constant';
import { TIMEFRAME } from '../src/timeseries.interface';
import type { CandleDb } from '../src/interface';

// ─── ANSI colors ──────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const G = '\x1b[32m';
const RD = '\x1b[31m';
const Y = '\x1b[33m';
const C = '\x1b[36m';
const B = '\x1b[1m';
const DIM = '\x1b[2m';

const green = (s: string) => `${G}${s}${R}`;
const red   = (s: string) => `${RD}${s}${R}`;
const cyan  = (s: string) => `${C}${s}${R}`;
const bold  = (s: string) => `${B}${s}${R}`;
const dim   = (s: string) => `${DIM}${s}${R}`;

const PASS = green('✓ PASS');
const FAIL = red('✗ FAIL');
const SKIP = `${Y}⚠ SKIP${R}`;

function fmtMs(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function step(label: string, value: string, status?: 'ok' | 'fail' | 'info') {
  const prefix = status === 'ok' ? green('  ✓') : status === 'fail' ? red('  ✗') : '   ';
  console.log(`${prefix} ${dim(label.padEnd(26))} ${value}`);
}

// ─── Config ───────────────────────────────────────────────────────────────────
const LIMIT = 20; // small for speed; still enough to catch off-by-one

const ALL_EXCHANGES = [
  { name: 'binance',  synonym: 'BTC/USDT' },
  { name: 'okx',      synonym: 'BTC/USDT' },
  { name: 'bybit',    synonym: 'BTC/USDT' },
  { name: 'mexc',     synonym: 'BTC/USDT' },
  { name: 'gateio',   synonym: 'BTC/USDT' },
  { name: 'htx',      synonym: 'BTC/USDT' },
  { name: 'kucoin',   synonym: 'BTC/USDT' },
  { name: 'bitget',   synonym: 'BTC/USDT' },
  { name: 'poloniex', synonym: 'BTC/USDT' },
];

const ALL_TIMEFRAMES: TIMEFRAME[] = [TIMEFRAME.M1, TIMEFRAME.M15];

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(key: string): string | undefined {
  const i = args.indexOf(key);
  return i !== -1 ? args[i + 1] : undefined;
}

const filterExchange = getArg('--exchange');
const filterTf       = getArg('--tf');

const exchanges = filterExchange
  ? ALL_EXCHANGES.filter(e => e.name === filterExchange)
  : ALL_EXCHANGES;

/** Accept both enum key (M1, M15) and enum value (1m, 15m) */
function parseTfFilter(raw: string): TIMEFRAME | undefined {
  if (!raw) return undefined;
  // direct match on value: '1m', '15m' …
  if (Object.values(TIMEFRAME).includes(raw as TIMEFRAME)) return raw as TIMEFRAME;
  // match on key: 'M1' → TIMEFRAME.M1 = '1m'
  const byKey = (TIMEFRAME as Record<string, string>)[raw.toUpperCase()];
  if (byKey) return byKey as TIMEFRAME;
  return undefined;
}

const tfFilter = filterTf ? parseTfFilter(filterTf) : undefined;
if (filterTf && !tfFilter) {
  console.error(red(`Unknown timeframe "${filterTf}". Use key (M1, M15, H1, D1) or value (1m, 15m, 1h, 1d).`));
  process.exit(1);
}

const timeframes = tfFilter ? [tfFilter] : ALL_TIMEFRAMES;

// ─── Per-case test ────────────────────────────────────────────────────────────
interface TestResult {
  label: string;
  pass: boolean;
  skip: boolean;
  reason?: string;
}

async function runCase(
  exchangeName: string,
  synonym: string,
  timeframe: TIMEFRAME,
): Promise<TestResult> {
  const label = `${exchangeName}/${timeframe}`;
  const tfMs = timeframeMSeconds(timeframe);

  console.log(`\n${bold(`── ${exchangeName.toUpperCase()} · ${synonym} · ${timeframe} ──`)}`);

  // Step 1: capture current candle time BEFORE the call so comparison is stable
  const nowCandleMs = getCandleTime(timeframe);
  step('getCandleTime()', `${fmtMs(nowCandleMs)}  ${dim(`(${nowCandleMs})`)}`, 'info');
  step('limit', String(LIMIT), 'info');

  // Step 2: call API
  const t0 = Date.now();
  const candles = await fetchLastCandles({ exchange: exchangeName, synonym, timeframe, limit: LIMIT });
  const elapsed = Date.now() - t0;

  if (typeof candles === 'string') {
    step('API call', red(`ERROR: ${candles}`) + dim(` (${elapsed}ms)`), 'fail');
    return { label, pass: false, skip: false, reason: candles };
  }

  step('API call', dim(`ok — ${elapsed}ms`), 'ok');

  // Step 3: basic sanity
  if (candles.length === 0) {
    step('candles returned', red('0  ← empty'), 'fail');
    return { label, pass: false, skip: false, reason: 'empty response' };
  }

  const times = candles.map(c => c.time.getTime());
  const firstMs = Math.min(...times);
  const lastMs  = Math.max(...times);

  step('candles returned', `${candles.length}`, candles.length >= LIMIT ? 'ok' : 'info');
  step('first candle',     `${fmtMs(firstMs)}  ${dim(`(${firstMs})`)}`, 'info');
  step('last candle',      `${fmtMs(lastMs)}   ${dim(`(${lastMs})`)}`, 'info');

  // Step 4: check sorted order
  const isSorted = times.every((t, i) => i === 0 || t >= times[i - 1]);
  step('sorted oldest-first', isSorted ? 'yes' : red('NO'), isSorted ? 'ok' : 'fail');

  // Step 5: hasCurrent — core check
  const lastAlignedMs = getCandleTime(timeframe, lastMs);
  const deltaCandles  = Math.round((nowCandleMs - lastAlignedMs) / tfMs);

  step('lastAligned',    `${fmtMs(lastAlignedMs)}`, 'info');
  step('expected current', `${fmtMs(nowCandleMs)}`, 'info');
  step('delta (periods behind)', deltaCandles === 0
    ? green('0 ← current candle is here')
    : red(`${deltaCandles} ← off by ${deltaCandles} candle(s)`),
    deltaCandles === 0 ? 'ok' : 'fail',
  );

  const hasCurrent = candles.some(c => getCandleTime(timeframe, c.time) === nowCandleMs);
  step('hasCurrent', hasCurrent ? green('true') : red('false'), hasCurrent ? 'ok' : 'fail');

  const pass = hasCurrent && isSorted;
  console.log(`  ${pass ? PASS : FAIL}`);

  return {
    label,
    pass,
    skip: false,
    reason: !hasCurrent
      ? `hasCurrent=false, last is ${deltaCandles} period(s) behind`
      : !isSorted ? 'not sorted' : undefined,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold('\n╔═══════════════════════════════════════╗'));
  console.log(bold('║  fetchLastCandles  integration test   ║'));
  console.log(bold('╚═══════════════════════════════════════╝'));
  console.log(dim(`exchanges : ${exchanges.map(e => e.name).join(', ')}`));
  console.log(dim(`timeframes: ${timeframes.join(', ')}`));
  console.log(dim(`limit     : ${LIMIT}`));
  console.log(dim(`time      : ${new Date().toISOString()}`));

  const results: TestResult[] = [];

  for (const tf of timeframes) {
    for (const { name, synonym } of exchanges) {
      try {
        const r = await runCase(name, synonym, tf);
        results.push(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ${red(`Exception: ${msg}`)}`);
        results.push({ label: `${name}/${tf}`, pass: false, skip: false, reason: msg });
      }
      // Brief pause to avoid rate-limiting across rapid successive requests
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(bold('\n╔═══════════════════════════════════════╗'));
  console.log(bold('║              Summary                  ║'));
  console.log(bold('╚═══════════════════════════════════════╝'));

  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);

  for (const r of results) {
    const marker = r.pass ? green('✓') : red('✗');
    const reason = r.reason ? dim(`  ← ${r.reason}`) : '';
    console.log(`  ${marker} ${r.label}${reason}`);
  }

  console.log(`\n${bold(`${passed.length}/${results.length} passed`)}`);

  if (failed.length > 0) {
    console.log(red(`\nFailed cases:`));
    for (const r of failed) {
      console.log(`  ${red('✗')} ${r.label}${r.reason ? `: ${r.reason}` : ''}`);
    }
    process.exit(1);
  } else {
    console.log(green('\nAll tests passed!'));
    process.exit(0);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
