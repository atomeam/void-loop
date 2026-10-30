// Stand-ins for outside services the benchmark (tools/bench.mjs) has no network for, in the exact shapes the skills parse.
// 2026-10-30: Wikiquote got the Wikipedia search stand-in (any "/w/api.php"), so the quote and proverb skills found no quote and
// 14 asks read "(none)"; /api/markets got a 204, so the stocks asks did too. These answer as the real services do. Pure.

// Wikiquote's parse API: the sections of a page, and one section's HTML in the shape each skill reads
// (skills/proverb.js proverbsFrom, skills/quote.js themeQuotes and qotdFrom). The lines are real: a proverb Wikiquote lists, and a line from Measure for Measure, Act 1 Scene 4.
const PROVERB = '<ul><li>A cat may look at a king.<ul><li>Hazlitt (1869)</li></ul></li></ul>';
const THEME = '<ul><li>Our doubts are traitors, and make us lose the good we oft might win, by fearing to attempt.<ul><li>William Shakespeare, Measure for Measure</li></ul></li></ul>';
const QOTD = '<table class="cquote"><tr><td>“</td><td>Our doubts are traitors, and make us lose the good we oft might win, by fearing to attempt.</td><td>”</td></tr></table><cite>&#8212; William Shakespeare</cite>';

/** a Wikiquote parse request -> the JSON body the real API sends, or null for any other address. Pure. */
export function wikiquote(u) {
  if (!/^https:\/\/en\.wikiquote\.org\/w\/api\.php\?/.test(u)) return null;
  const q = new URL(u).searchParams, page = q.get('page') || '';
  if (q.get('prop') === 'sections') return { parse: { title: page, sections: [{ level: '2', line: page === 'English proverbs' ? 'Cat' : 'Sourced', index: '1', anchor: page === 'English proverbs' ? 'Cat' : 'Sourced' }] } };
  const text = page === 'English proverbs' ? PROVERB : /^Wikiquote:Quote of the day\//.test(page) ? QOTD : THEME;
  return { parse: { title: page, text } };
}

/** Verse's own /api/markets (functions/api/markets.js answer shape) -> one delayed quote with five days of points, or null. Pure. */
export function markets(u) {
  const m = /\/api\/markets\?(.*)$/.exec(u); if (!m) return null;
  const sym = new URLSearchParams(m[1]).get('s') || 'X';
  return { ok: true, sym, kind: 'stock', name: sym, currency: 'USD', range: '5d', price: 201.5, change: 1.25, pct: 0.62,
    points: [[1, 198], [2, 199.4], [3, 200.1], [4, 200.25], [5, 201.5]], source: 'Stooq', delayed: true, asOf: '2026-10-29' };
}
