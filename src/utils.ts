import { STABLES } from './constant';

export function isCorrectSymbol(symbol: string): boolean {
  const abc: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

  const [coin, stable] = symbol.split('/');

  if (!coin || !stable) {
    return false;
  }

  if (coin.length > 10 || stable.length > 10) {
    return false;
  }

  if (STABLES.includes(coin)) {
    return false;
  }

  // if (!STABLES.includes(stable)) {
  //   return false;
  // }

  for (const char of coin) {
    if (!abc.includes(char)) {
      return false;
    }
  }

  for (const char of stable) {
    if (!abc.includes(char)) {
      return false;
    }
  }

  return true;
}
