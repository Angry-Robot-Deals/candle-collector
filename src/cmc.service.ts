import { Logger } from '@nestjs/common';
import {
  CmcCoinRaw,
  CmcQuote,
  CMC_MAX_COINS,
  CMC_PAGE_URL,
  CMC_USER_AGENT,
} from './cmc.types';

/**
 * Fetches CoinMarketCap homepage HTML.
 */
export async function fetchCmcPage(): Promise<string> {
  const res = await fetch(CMC_PAGE_URL, {
    headers: {
      'User-Agent': CMC_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`CMC fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Finds the first array in a nested object that looks like CMC listing (objects with id, name, symbol, quotes).
 */
function findCmcListingArray(obj: unknown): CmcCoinRaw[] | null {
  if (Array.isArray(obj)) {
    const first = obj[0];
    if (
      first &&
      typeof first === 'object' &&
      'id' in first &&
      'name' in first &&
      'symbol' in first &&
      'quotes' in first
    ) {
      return obj as CmcCoinRaw[];
    }
    return null;
  }
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    for (const v of Object.values(obj)) {
      const found = findCmcListingArray(v);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extracts CMC coin listing from HTML. Tries __NEXT_DATA__ script first, then regex fallback for JSON array.
 */
export function extractCoinListingFromHtml(html: string): CmcCoinRaw[] {
  const nextDataMatch = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">\s*([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]) as unknown;
      const list = findCmcListingArray(data);
      if (list && list.length > 0) {
        return list.slice(0, CMC_MAX_COINS);
      }
    } catch (e) {
      Logger.warn?.(
        `CMC __NEXT_DATA__ parse failed: ${e instanceof Error ? e.message : String(e)}`,
        'extractCoinListingFromHtml',
      );
    }
  }

  const regex = /"id"\s*:\s*\d+\s*,\s*"name"\s*:\s*"[^"]*"\s*,\s*"symbol"\s*:\s*"[^"]*"/;
  const idx = html.search(regex);
  if (idx === -1) return [];

  const start = html.lastIndexOf('[', idx);
  if (start === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = start; i < Math.min(html.length, start + 5_000_000); i++) {
    const ch = html[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  try {
    const arr = JSON.parse(html.slice(start, end + 1)) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      if (
        first &&
        typeof first === 'object' &&
        'id' in first &&
        'symbol' in first &&
        'quotes' in first
      ) {
        return arr.slice(0, CMC_MAX_COINS) as CmcCoinRaw[];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Returns USD quote from CMC coin quotes array.
 */
export function getUsdQuote(coin: CmcCoinRaw): CmcQuote | null {
  const quotes = coin.quotes;
  if (!Array.isArray(quotes)) return null;
  const usd = quotes.find((q) => q.name === 'USD');
  return usd ?? null;
}
