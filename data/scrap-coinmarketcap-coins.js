// https://coinmarketcap.com/coins/?page=1
const table = document.querySelector('table');

const coinsData = [];

const rows = table.querySelectorAll('tbody tr');

rows.forEach((row) => {
  const symbol = row.querySelector('.hide-ranking-number p.coin-item-symbol');
  const name = row.querySelector('.hide-ranking-number p[font-weight]');
  const logo = row.querySelector('.coin-logo');
  const price = row.querySelector('a.cmc-link span');

  const volumeCap = row.querySelector('td div div p[font-weight="medium"]');

  const costCap = row.querySelector('p span[data-nosnippet]');

  const cost24 = row.querySelector('a.cmc-link p.font_weight_500');
  const volume24 = row.querySelector('div[data-nosnippet] p[color="text2"]');

  if (symbol && name) {
    coinsData.push([
      symbol.textContent,
      name.textContent,
      logo.src,
      price?.textContent || 0,
      volumeCap?.textContent || 0,
      costCap?.textContent || 0,
      volume24?.textContent || 0,
      cost24?.textContent || 0,
    ]);
  }
});

console.log(coinsData);
