// /markets/'s stage card: the symbol open on the page, as an ask a stage skill reads back, so "See it as a card on the stage" shows that
// price, not the board of top coins. A coin goes to the crypto skill (skills/crypto.js coinOf) by its CoinGecko id ("bitcoin price") or, when
// the skill does not know that word, by its ticker ("bnb price"). A stock, an ETF or an index goes to the stocks skill (skills/stocks.js
// stockAsk): a stock by its ticker ("AAPL stock price"), an index by its name ("s&p 500 today"). Each only when the skill reads back the same symbol the page shows. A currency
// pair or a coin no skill prices gives '', so the example ask (the crypto board) stays. Pure: tools/toolkit.test.mjs.
import { COINS, INDICES, resolve } from './markets.js';
import { coinOf } from '../skills/crypto.js';
import { stockAsk } from '../skills/stocks.js';

/** the stage ask for the symbol open on the page, or ''. Pure. */
export function cardAsk(sym) {
  const r = resolve(sym); if (!r) return '';
  if (r.kind === 'stock' || r.kind === 'index') {
    for (const ask of r.kind === 'index' ? [...(INDICES.find(([x]) => x === r.sym) || [[], [], [], [], []])[4], r.sym].map((w) => w + ' today') : [r.sym + ' stock price']) { const s = stockAsk(ask); if (s && s.sym === r.sym) return ask; }
    return '';
  }
  if (r.kind !== 'crypto' || !COINS[r.sym]) return '';
  for (const w of [r.coin, r.sym.toLowerCase()]) { const ask = w + ' price', c = coinOf(ask); if (c && c.id === r.coin) return ask; }
  return '';
}

