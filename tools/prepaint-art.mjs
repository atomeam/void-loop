// The Art Forge backfill (owner, 2026-10-17: "fix the art for everything once Verse can generate its own unique art that fits"): walks every skill card (skills/index.json),
// every miniature (skills/mini/*.js; the Book of Verse's pages are these same skills), and any subjects in --file, and paints what is not painted yet, a few at a time, under the
// route's own daily cap (30) and kill switch. The record of what is painted IS the server's cache (D1 void_art), so a rerun never repaints and any machine can resume.
// Real art stays real: a name that is a film, show, song, album or book is skipped (its poster or cover is the art, as the card frame already does).
//   node tools/prepaint-art.mjs --status           "N of M cards painted", what is left and how many days that takes at the cap (reads only, free)
//   node tools/prepaint-art.mjs --dry              list the subjects (nothing is sent)
//   node tools/prepaint-art.mjs --go [--max 10]    paint up to --max (default 10) missing ones, then stop; stops early at 'cap' or 'off'
//   --file subjects.txt   extra subjects, one per line     VOID_URL=... another origin (default https://a-to-mind.com)
// It uses no key and does not raise the cap: /api/card-art is public by design and bounded on the server.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { subjectKey, refusal } from '../void-live-deploy/lib/art-rules.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DAILY_CAP = 30;
const REAL = /\b(films?|movies?|shows?|series|songs?|music|albums?|bands?|books?|posters?|covers?|trailers?)\b/;
/** every card name that can be painted: skills and miniatures, from the repo. */
export function known(dir = resolve(root, 'void-live-deploy/skills')) {
  const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8')).map(String);
  const mini = resolve(dir, 'mini');
  if (existsSync(mini)) for (const f of readdirSync(mini)) if (f.endsWith('.js')) names.push(f.slice(0, -3));
  return names;
}
/** the subjects to paint: names as the card sends them (dashes to spaces), folded, de-duplicated, real-art kinds and refused ones dropped. Pure. */
export function plan(list) {
  const seen = new Set(), out = [], dropped = [];
  for (const raw0 of list) {
    const raw = String(raw0).replace(/[-_]+/g, ' '), k = subjectKey(raw); if (!k || seen.has(k)) continue; seen.add(k);
    if (REAL.test(k)) { dropped.push([k, 'real art']); continue; }
    const why = refusal(raw, 'skill'); if (why) dropped.push([k, why]); else out.push(k);
  }
  return { out, dropped };
}
/** days to finish at the daily cap. Pure. */
export const daysLeft = (left, cap = DAILY_CAP) => Math.ceil(left / Math.max(1, cap));

const base = () => process.env.VOID_URL || 'https://a-to-mind.com';
async function painted(k) { try { const j = await (await fetch(base() + '/api/card-art?key=' + encodeURIComponent(k) + '&kind=skill', { signal: AbortSignal.timeout(30000) })).json(); return j.state === 'art' ? 1 : j.state === 'none' ? 0 : -1; } catch (_) { return -1; } }
async function main() {
  const a = process.argv.slice(2), has = (f) => a.includes(f), fi = a.indexOf('--file'), mi = a.indexOf('--max');
  if (fi >= 0 && (!a[fi + 1] || a[fi + 1].startsWith('--'))) { console.error('usage: node tools/prepaint-art.mjs --file subjects.txt (one subject per line)'); process.exitCode = 2; return; }
  const list = known().concat(fi >= 0 ? readFileSync(a[fi + 1], 'utf8').split('\n') : []);
  const { out, dropped } = plan(list), max = mi >= 0 ? Math.max(1, +a[mi + 1] || 10) : 10;
  console.log(out.length + ' cards to paint' + (dropped.length ? ', ' + dropped.length + ' left as they are (' + dropped.map((d) => d.join(': ')).join('; ') + ')' : ''));
  if (has('--dry')) { console.log(out.join('\n')); return; }
  const todo = []; let done = 0, unknown = 0;
  for (const k of out) { const r = await painted(k); if (r === 1) done++; else if (r === 0) todo.push(k); else { unknown++; todo.push(k); } } // void-review: ok (sequential on purpose: one painted card per request keeps the daily free-allowance cap)
  console.log(done + ' of ' + out.length + ' cards painted; ' + todo.length + ' left' + (unknown ? ' (' + unknown + ' unreadable, counted as left)' : '') + '; about ' + daysLeft(todo.length) + ' day(s) at the cap of ' + DAILY_CAP + ' a day');
  if (!has('--go')) return;
  let n = 0;
  for (const k of todo) {
    if (n >= max) break;
    for (let tries = 0; tries < 4; tries++) {
      const r = await fetch(base() + '/api/card-art', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: k, kind: 'skill', rarity: 'common' }), signal: AbortSignal.timeout(30000) }).catch(() => null); // void-review: ok (sequential on purpose: one painted card per request keeps the daily free-allowance cap)
      if (!r) { console.log('skip  ' + k + ' (unknown: no answer in 30s, retry later)'); break; }
      const j = await r.json().catch(() => ({}));
      if (j.state === 'art') { if (!j.cached) n++; console.log((j.cached ? 'had   ' : 'paint ') + k); break; }
      if (j.why === 'slow') { await new Promise((ok) => setTimeout(ok, 21000)); continue; }
      if (j.why === 'cap' || j.why === 'off') { console.log('stop: ' + j.why + ' (' + n + ' painted this run)'); return; }
      console.log('skip  ' + k + ' (' + (j.why || r.status) + ')'); break;
    }
  }
  console.log('done: ' + n + ' painted this run; rerun tomorrow for the rest');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
