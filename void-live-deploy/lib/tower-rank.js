// Versus by size (owner, 2026-10-26: "rank every tower site by real traffic so the order is easiest first, giants last, from data, not guesses").
// Pure helpers shared by tools/tower-rank.mjs (writes tower.rank.json), skills/tower.js (the size column and the "By size" view) and the tests.
// Rank = position in the Tranco top-million list (tranco-list.eu; Le Pochat et al., "Tranco: A Research-Oriented Top Sites Ranking Hardened Against
// Manipulation", NDSS 2019); 1 is the most visited. The smallest sites have the biggest numbers, and a site outside the million has none (null).

// two-part public suffixes seen among tower rivals and the common neighbours; a real public-suffix list is not worth a dependency for ~170 hosts
const TWO_PART = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'ne.jp', 'or.jp', 'co.in', 'com.br', 'com.cn', 'com.mx',
  'com.tr', 'co.za', 'com.sg', 'com.hk', 'com.tw', 'co.kr', 'com.ar', 'co.il', 'com.ua', 'com.pl', 'com.es', 'com.ru', 'com.my', 'com.ph', 'com.vn', 'co.id', 'co.th']);
/** the registrable domain of a host or url: int.soccerway.com -> soccerway.com, www.bbc.co.uk -> bbc.co.uk. '' when it is not a host. Pure. */
export function regDomain(s) {
  let h = String(s || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, '').replace(/^[^@]*@/, '').replace(/:\d+$/, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return '';
  const p = h.split('.');
  if (p.length >= 3 && TWO_PART.has(p.slice(-2).join('.'))) return p.slice(-3).join('.');
  return p.slice(-2).join('.');
}
/** the effective size number of a floor: the hand override when there is one, else its rank, else null (unranked). Pure. */
export const sizeOf = (id, ranks = {}, order = {}) => (Number.isFinite(+order[id]) && order[id] !== null && order[id] !== '' ? +order[id] : Number.isFinite(+ranks[id]) && ranks[id] ? +ranks[id] : null);
/** floors by size, smallest first: unranked first, then the biggest rank number down to the leaders last; a hand override stands in for the rank;
 *  ties keep the order they came in. Returns a new array. Pure. */
export function bySize(floors, ranks = {}, order = {}) {
  return floors.map((f, i) => ({ f, i, s: sizeOf(f.id, ranks, order) })).sort((a, b) => ((b.s === null ? Infinity : b.s) - (a.s === null ? Infinity : a.s)) || a.i - b.i).map((x) => x.f);
}
const LOC = { en: { unranked: 'unranked', rank: 'Tranco rank', size: 'Size', bySize: 'By size', bySizeOn: 'By size: smallest first', ladder: 'Ladder order', note: 'Size is each site\'s place among the million most visited (Tranco); smaller sites first, unranked sites first of all.', hand: 'set by hand' },
  de: { unranked: 'ohne Rang', rank: 'Tranco-Rang', size: 'Grösse', bySize: 'Nach Grösse', bySizeOn: 'Nach Grösse: die kleinsten zuerst', ladder: 'Reihenfolge der Leiter', note: 'Die Grösse ist der Platz unter den eine Million meistbesuchten Seiten (Tranco); kleine Seiten zuerst, Seiten ohne Rang ganz vorn.', hand: 'von Hand gesetzt' } };
/** the strings for a language tag ('de-CH' -> German, anything else English). Pure. */
export const words = (lang) => (/^de\b/i.test(String(lang || '')) ? LOC.de : LOC.en);
/** a rank as a person reads it: "#1,234" (German "#1.234"), "unranked" outside the million, '' when no rank data was loaded. Pure. */
export function rankLabel(rank, lang = 'en', loaded = true) {
  if (!loaded) return '';
  const w = words(lang);
  if (!Number.isFinite(+rank) || !rank) return w.unranked;
  const n = String(Math.round(+rank)).replace(/\B(?=(\d{3})+(?!\d))/g, /^de\b/i.test(String(lang)) ? '.' : ',');
  return '#' + n;
}
/** the next `n` floors not yet surpassed, in size order: `floors` is lib/tower.js tower().floors (each has `beaten`), so a regressed site is back in. Pure. */
export const nextUnsurpassed = (floors, ranks = {}, order = {}, n = 10) => bySize(floors.filter((f) => !f.beaten), ranks, order).slice(0, n);
