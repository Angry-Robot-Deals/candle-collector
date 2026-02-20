import { Logger } from '@nestjs/common';

/**
 * Fetch URL and parse JSON. On HTTP error or invalid/empty body, log the real
 * status and response body so we can fix API usage instead of hiding errors.
 */
export async function fetchJsonSafe<T = unknown>(
  url: string,
  context?: string,
): Promise<{ data: T | null; error: string | null }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    Logger.error(`[${context || 'fetchJsonSafe'}] Fetch failed: ${msg} ${url}`);
    return { data: null, error: msg };
  }

  const text = await res.text();

  if (!res.ok) {
    Logger.error(
      `[${context || 'fetchJsonSafe'}] HTTP ${res.status} ${url} body: ${text.slice(0, 400)}`,
    );
    return { data: null, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  if (!text.trim()) {
    Logger.error(`[${context || 'fetchJsonSafe'}] Empty response ${url}`);
    return { data: null, error: 'Empty response' };
  }

  try {
    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    Logger.error(
      `[${context || 'fetchJsonSafe'}] Invalid JSON ${url} parse: ${msg} body: ${text.slice(0, 400)}`,
    );
    return { data: null, error: msg };
  }
}

/** Exchange API symbol formats: CCXT uses "BTC/USDT", APIs use different separators. */
export const toExchangeSymbol = {
  /** Binance, MEXC, Bybit: BTCUSDT */
  noSeparator: (s: string) => s.replace(/\//g, ''),
  /** Gate.io, Poloniex: BTC_USDT */
  underscore: (s: string) => s.replace(/\//g, '_'),
  /** OKX: BTC-USDT */
  hyphen: (s: string) => s.replace(/\//g, '-'),
};
