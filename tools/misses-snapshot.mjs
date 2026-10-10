// The public miss snapshot: what people asked that Void could not answer, reduced to terms and counts that are safe in a
// public repo. A builder without the owner token (any cloud session) reads domains/void.misses.json instead of the
// board. Nothing a person typed is copied: only short, all-letter words, and only a word that at least MIN_ASKS different
// asks contain. Asks that look like they carry a secret are dropped first (misses.mjs redact).
//   node tools/misses-snapshot.mjs                 read the board (VOID_MISSES_TOKEN) and write domains/void.misses.json
//   node tools/misses-snapshot.mjs --file rows.json   the same from a file of board rows
// Exit 3 when the board can't be read; the reason (no token, HTTP status) is printed for the workflow log, the file is
// left as it was.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redact } from './misses.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(root, 'domains/void.misses.json');
export const MIN_ASKS = 3, MAX_TERMS = 60, WORD_MIN = 3, WORD_MAX = 16;
// words that say nothing about what was wanted
const STOP = new Set(('the and for you your are was were with what when where which who whom whose why how can could would should will '
  + 'shall may might must have has had does did doing done not but this that these those there here then than them they their '
  + 'its into onto from about over under some any all each every more most much many very just also only even please thanks '
  + 'thank hey hello want need like make made give show tell find get got let lets want me my mine our ours his her him she he '
  + 'one two out off our yes now today tomorrow yesterday void').split(' '));

/** the words of one ask that may be published: lower-case letters only, 3 to 16 long, not a stop word */
export function words(ask) {
  return [...new Set(String(ask || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= WORD_MIN && w.length <= WORD_MAX && !STOP.has(w)))];
}
/** "make me a <thing>" and its kin: the thing, if it is one short all-letter word or two */
export function madeThing(ask) {
  const m = /^\s*(?:please\s+)?(?:can\s+you\s+)?(?:make|build|forge|3d\s*print|print|model|create)\s+(?:me\s+)?(?:an?\s+)?(?:3d\s+)?([a-z]{3,16}(?:\s[a-z]{3,16})?)\s*[?!.]*\s*$/i.exec(String(ask || ''));
  if (!m) return null;
  const t = m[1].toLowerCase();
  return t.split(' ').some((w) => STOP.has(w)) ? null : t;
}

/** board rows -> the snapshot: every count is over distinct asks, and nothing seen in fewer than MIN_ASKS asks appears */
export function snapshot(rows, { at = new Date().toISOString(), since = null } = {}) {
  const asks = new Map(); // normalised ask -> times missed
  const lower = new Set(); // words someone wrote in lower case: a word only ever capitalised ("Priya", "Lisbon") may name a person or a place
  for (const r of rows || []) {
    if (since && String(r.last || '') < since) continue;
    const a = redact(r.ask);
    if (a == null) continue;
    for (const w of a.split(/[^A-Za-z]+/)) if (w && w === w.toLowerCase()) lower.add(w);
    const k = a.trim().toLowerCase().replace(/\s+/g, ' ');
    if (k) asks.set(k, (asks.get(k) || 0) + (Number(r.count) || 1));
  }
  const tally = (pick) => {
    const m = new Map();
    for (const [k, n] of asks) for (const term of pick(k)) { const e = m.get(term) || { asks: 0, misses: 0 }; e.asks++; e.misses += n; m.set(term, e); }
    return [...m].filter(([term, e]) => e.asks >= MIN_ASKS && term.split(' ').every((w) => lower.has(w))).sort((a, b) => b[1].asks - a[1].asks || b[1].misses - a[1].misses || (a[0] < b[0] ? -1 : 1))
      .slice(0, MAX_TERMS).map(([term, e]) => ({ term, asks: e.asks, misses: e.misses }));
  };
  return {
    schema: 'void.misses.v1', at, since,
    rule: 'Terms are lower-case words of 3-16 letters from asks Void could not answer, each listed only when at least ' + MIN_ASKS + ' different asks contain it and someone wrote it in lower case (a word only ever capitalised may be a name); no ask is copied. "make" lists the things in make/print asks the same way.',
    distinctAsks: asks.size,
    terms: tally(words),
    make: tally((k) => { const t = madeThing(k); return t ? [t] : []; }),
  };
}

async function rowsFromSite() {
  const tok = process.env.VOID_MISSES_TOKEN;
  if (!tok) throw new Error('VOID_MISSES_TOKEN is not set (the workflow passes the VOID_OWNER_TOKEN secret, the Pages READ_TOKEN)');
  const res = await fetch('https://a-to-mind.com/api/misses', { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-misses-snapshot/1.0' } });
  if (!res.ok) throw new Error('GET /api/misses: HTTP ' + res.status + (res.status === 401 || res.status === 403 ? ' (the token does not open the owner-only miss board)' : ''));
  return res.json();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), file = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  let rows;
  try { rows = file ? JSON.parse(readFileSync(resolve(file), 'utf8')) : await rowsFromSite(); }
  catch (e) { console.error('miss board not read: ' + (e.cause ? e.cause.code || e.cause.message : e.message)); process.exit(3); }
  const snap = snapshot(rows, { since });
  writeFileSync(OUT, JSON.stringify(snap, null, 2) + '\n');
  console.log(`void.misses.json: ${snap.distinctAsks} distinct asks since ${since}, ${snap.terms.length} terms, ${snap.make.length} make/print things`);
}
