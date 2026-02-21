import { extractCoinListingFromHtml, getUsdQuote } from './cmc.service';
import type { CmcCoinRaw } from './cmc.types';

describe('extractCoinListingFromHtml', () => {
  it('should extract coins from __NEXT_DATA__ script', () => {
    const nextData = JSON.stringify({
      props: {
        pageProps: {
          initialState: {
            cryptocurrency: {
              listingLatest: {
                data: [
                  { id: 1, name: 'Bitcoin', symbol: 'BTC', slug: 'bitcoin', quotes: [{ name: 'USD', price: 68000, volume24h: 1e9, marketCap: 1.3e12 }] },
                  { id: 1027, name: 'Ethereum', symbol: 'ETH', slug: 'ethereum', quotes: [{ name: 'USD', price: 3500, volume24h: 500e6, marketCap: 400e9 }] },
                ],
              },
            },
          },
        },
      },
    });
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${nextData}</script></body></html>`;
    const coins = extractCoinListingFromHtml(html);
    expect(coins).toHaveLength(2);
    expect(coins[0].id).toBe(1);
    expect(coins[0].symbol).toBe('BTC');
    expect(coins[0].name).toBe('Bitcoin');
    expect(coins[1].symbol).toBe('ETH');
  });

  it('should return empty array when no listing found', () => {
    const html = '<html><body>no data</body></html>';
    expect(extractCoinListingFromHtml(html)).toEqual([]);
  });
});

describe('getUsdQuote', () => {
  it('should return USD quote when present', () => {
    const coin: CmcCoinRaw = {
      id: 1,
      name: 'Bitcoin',
      symbol: 'BTC',
      quotes: [
        { name: 'BTC', price: 1 },
        { name: 'USD', price: 68000, volume24h: 1e9, marketCap: 1.3e12 },
      ],
    };
    const usd = getUsdQuote(coin);
    expect(usd).not.toBeNull();
    expect(usd?.name).toBe('USD');
    expect(usd?.price).toBe(68000);
  });

  it('should return null when no quotes', () => {
    const coin: CmcCoinRaw = { id: 1, name: 'X', symbol: 'X' };
    expect(getUsdQuote(coin)).toBeNull();
  });
});
