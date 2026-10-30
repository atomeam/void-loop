// /markets/'s stage card: the coin open on the page, as an ask the stage's crypto skill reads back (skills/crypto.js coinOf), so "See it as a
// card on the stage" shows that coin's price, not the board of top coins. The ask names the coin by its CoinGecko id ("bitcoin price") or, when
// the skill does not know that word, by its ticker ("bnb price"), and only when the skill prices the same coin the page shows. A stock, an index,
// a currency pair or a coin the skill does not price gives '', so the example ask (the crypto board) stays. Pure: tools/toolkit.test.mjs.
import { COINS, resolve } from './markets.js';
import { coinOf } from '../skills/crypto.js';

/** the stage ask for the symbol open on the page, or ''. Pure. */
export function cardAsk(sym) {
  const r = resolve(sym); if (!r || r.kind !== 'crypto' || !COINS[r.sym]) return '';
  for (const w of [r.coin, r.sym.toLowerCase()]) { const ask = w + ' price', c = coinOf(ask); if (c && c.id === r.coin) return ask; }
  return '';
}

