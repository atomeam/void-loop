// The board for the hourly run: Void's real misses, newest first, minus the ones already beaten or benched.
// Reads the owner-only GET /api/misses (D1 void_misses + old KV rows) with VOID_MISSES_TOKEN (= the Pages READ_TOKEN),
// or a JSON file of the same rows. It only prints: misses are what people typed, so they never get written into this
// (public) repo; a run adds the ask it beat to tools/grown.json by hand, after reading it.
// Asks that look like they carry a secret (unlock lines, long key-like strings) are dropped, emails and long digit runs
// are masked, before anything is printed.
//   node tools/misses.mjs                    misses from the last 2 days not yet in grown.json or bench.json
//   node tools/misses.mjs --since 2026-10-03T06:41 --all     a different window; --all keeps beaten/benched ones
//   node tools/misses.mjs --file rows.json   read rows from a file instead of the site
// Exit 0 with rows or "no new misses"; exit 3 when the board can't be read (no token, site unreachable, 401).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

// a token-ish run: 16+ characters of letters/digits/_- that mixes letters and digits
const KEYLIKE = /(?=[A-Za-z0-9_-]{16,})(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}/;
export function redact(ask) {
  const a = String(ask || '');
  if (/^\s*unlock\b/i.test(a) || a.split(/\s+/).some((w) => KEYLIKE.test(w))) return null;
  return a.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(/\d[\d\s().-]{7,}\d/g, '[number]').slice(0, 200);
}
export function fresh(rows, { since, known, all = false }) {
  const out = [];
  for (const r of rows) {
    if (since && String(r.last || '') < since) continue;
    const ask = redact(r.ask);
    if (ask == null) continue;
    if (!all && known.has(String(r.ask).trim().toLowerCase())) continue;
    out.push({ ask, count: r.count || 1, last: r.last || '', fallback: r.fallback || '' });
  }
  return out.sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : b.count - a.count));
}
async function rowsFromSite() {
  const tok = process.env.VOID_MISSES_TOKEN;
  if (!tok) throw new Error('VOID_MISSES_TOKEN is not set in this environment');
  const res = await fetch('https://a-to-mind.com/api/misses', { headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-misses/1.0' } });
  if (!res.ok) throw new Error('GET /api/misses: HTTP ' + res.status);
  return res.json();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const since = opt('--since') || new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 16);
  const known = new Set(['tools/grown.json', 'tools/bench.json'].flatMap((f) => JSON.parse(readFileSync(resolve(root, f), 'utf8')).map((x) => String(x.ask).trim().toLowerCase())));
  let rows;
  try { rows = opt('--file') ? JSON.parse(readFileSync(resolve(opt('--file')), 'utf8')) : await rowsFromSite(); }
  catch (e) { console.error('board not read: ' + (e.cause ? e.cause.code || e.cause.message : e.message)); process.exit(3); }
  const out = fresh(rows, { since, known, all: args.includes('--all') });
  if (!out.length) console.log(`no new misses since ${since} (${rows.length} on the board)`);
  for (const r of out) console.log(`${String(r.count).padStart(3)}  ${r.last.slice(0, 16)}  ${r.ask}${r.fallback ? '   [' + r.fallback + ']' : ''}`);
}
