/**
 * CMC page JSON: coin object as embedded in CoinMarketCap HTML (e.g. __NEXT_DATA__ or listing payload).
 */
export interface CmcQuote {
  name: string;
  price: number;
  volume24h?: number;
  marketCap?: number;
  percentChange1h?: number;
  percentChange24h?: number;
  percentChange7d?: number;
  lastUpdated?: string;
}

export interface CmcCoinRaw {
  id: number;
  name: string;
  symbol: string;
  slug?: string;
  cmcRank?: number;
  circulatingSupply?: number;
  totalSupply?: number | null;
  maxSupply?: number | null;
  ath?: number;
  atl?: number;
  high24h?: number;
  low24h?: number;
  isActive?: number;
  lastUpdated?: string;
  dateAdded?: string;
  quotes?: CmcQuote[];
}

export const CMC_BASE_URL = 'https://coinmarketcap.com/';
export const CMC_PAGE_URL = CMC_BASE_URL;
/** Number of CMC listing pages to fetch (page=1..N, ~100 coins per page). */
export const CMC_DEFAULT_PAGES = 10;
export const CMC_MAX_COINS = 5000;
export const CMC_USER_AGENT =
  'Mozilla/5.0 (compatible; CandlesBot/1.0; +https://github.com/angry/candles)';

export function getCmcPageUrl(page: number): string {
  return page <= 1 ? CMC_BASE_URL : `${CMC_BASE_URL}?page=${page}`;
}
