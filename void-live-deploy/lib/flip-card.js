// /flip/'s stage card: the coin open on the page (its ?q= ask, "flip 3 coins", "flip a Morgan dollar"), as the same ask on the stage, so
// "See it as a card on the stage" flips that coin, not always a plain one. Only an ask the coin skill takes (skills/coin.js match) and that
// is already in the page's address: nothing the visitor typed elsewhere goes into it. Else '', so the example ask stays. Pure: tools/coin.test.mjs.
import coin from '../skills/coin.js';

/** the stage ask for the coin in the page's query (location.search), or ''. Pure. */
export function cardAsk(search) {
  let q = ''; try { q = new URLSearchParams(String(search || '')).get('q') || ''; } catch (_) { return ''; }
  const t = q.trim().replace(/\s+/g, ' ');
  return t && t.length <= 80 && coin.match(t.toLowerCase(), t) ? t : '';
}
