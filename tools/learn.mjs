// Void learns skills by itself: what people asked and Void could not answer becomes a job for the builders, with no one
// in between (Void's own want, domains/void.will.md #1; frontier item 2). Reads the miss board (/api/misses), keeps the
// asks real people typed, ranks them by how often and how recently they were asked, and queues the top ones at
// /api/queue as `miss:<slug>` jobs. Builders claim them like any other job (`python tools/void_queue.py claim`).
//   node tools/learn.mjs            queue the top missed asks (owner token VOID_OWNER_TOKEN or VOID_MISSES_TOKEN)
//   node tools/learn.mjs --dry      show what would be queued, queue nothing
//   node tools/learn.mjs --json     print the result as JSON (the workflow reads `queued` from it)
//   node tools/learn.mjs --file rows.json [--queue queue.json]   rank rows from files instead of the site
// At most OPEN_MAX miss jobs are open at once, so the queue never floods; a miss already queued, built or benched is
// skipped. Asks are redacted (tools/misses.mjs) and kept short before they go anywhere: the queue is mirrored into the
// public repo (domains/void.queue.md), so a long pasted transcript is never read as a miss worth learning.
// Exit 0 always when the board was read (even with nothing to queue); exit 3 when the site can't be reached.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redact } from './misses.mjs';
import { isNoise } from '../void-live-deploy/lib/noise.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const OPEN_MAX = 3; // open miss jobs at once
export const DAYS = 7; // how far back the board is read
const MAX_WORDS = 12, MAX_CHARS = 80; // what a person types in Void's input; longer is pasted text, not an ask

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34);
export const targetOf = (ask) => 'miss:' + slug(ask);

// one row from the board -> a learnable ask, or null (noise, secrets, pasted transcripts, test traffic)
export function learnable(r) {
  const ask = redact(r && r.ask);
  if (ask == null) return null;
  const a = ask.trim();
  if (!a || isNoise(a) || String(r.fallback || '') === 'test') return null;
  if (a.length > MAX_CHARS || a.split(/\s+/).length > MAX_WORDS) return null;
  if (/[⏎\n]|\bthought\s*[·:]|^\$ |https?:\/\//i.test(a)) return null; // agent chatter pasted into the input
  if (/\b(?:asdf|qwert|zxcv)\w*|\b[bcdfghjklmnpqrstvwxz]{6,}\b/i.test(a)) return null; // keyboard mash inside a longer line
  return { ask: a, count: +r.count || 1, last: String(r.last || ''), fallback: String(r.fallback || ''), variants: (r.variants || []).map((v) => redact(v)).filter(Boolean) };
}

// rank: asked more, asked recently, and a game or a thing Void itself said it hasn't built yet
export function score(c, now = Date.now()) {
  const age = (now - Date.parse(c.last || 0)) / 864e5;
  return c.count + (c.variants.length ? 1 : 0) + (age < 2 ? 2 : age < 4 ? 1 : 0) + (/not built yet|^none$/i.test(c.fallback) ? 2 : 0);
}

// rows: the board (GET /api/misses); queue: { items } (GET /api/queue); known: asks already beaten or benched
export function plan(rows, queue, { known = new Set(), now = Date.now(), days = DAYS, openMax = OPEN_MAX } = {}) {
  const since = new Date(now - days * 864e5).toISOString();
  const items = (queue && queue.items) || [];
  const open = items.filter((i) => /^miss:/.test(i.target) && /^(queued|building)$/.test(i.state)).length;
  const taken = new Set(items.map((i) => i.target));
  const asked = new Set(items.map((i) => String(i.ask || '').toLowerCase()));
  const cands = [], skipped = [];
  for (const r of rows || []) {
    const c = learnable(r);
    if (!c) continue;
    if (c.last && c.last < since) continue;
    const t = targetOf(c.ask);
    if (known.has(c.ask.toLowerCase()) || taken.has(t) || asked.has(`learn to handle "${c.ask.toLowerCase()}"`)) { skipped.push({ ask: c.ask, why: taken.has(t) ? 'already a job' : 'already beaten or benched' }); continue; }
    cands.push({ ...c, target: t, score: score(c, now) });
  }
  cands.sort((a, b) => b.score - a.score || (b.last > a.last ? 1 : -1));
  const room = Math.max(0, openMax - open);
  return { open, room, queue: cands.slice(0, room), later: cands.slice(room), skipped };
}

export const jobOf = (c) => ({
  ask: `learn to handle "${c.ask}"`,
  target: c.target,
  note: `asked ${c.count}× (${c.variants.length + 1} phrasing${c.variants.length ? 's' : ''}), last ${c.last.slice(0, 10)}${c.fallback ? '; fallback ' + c.fallback : ''}; from the miss board (tools/learn.mjs)`.slice(0, 300),
});

async function api(path, method = 'GET', body) {
  const tok = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN;
  if (!tok) throw new Error('VOID_OWNER_TOKEN is not set in this environment');
  const res = await fetch(SITE + path, {
    method, headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-learn/1.0', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

export function knownAsks() {
  const out = new Set();
  for (const f of ['tools/grown.json', 'tools/bench.json']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    try { for (const x of JSON.parse(readFileSync(p, 'utf8'))) if (x && x.ask) out.add(String(x.ask).trim().toLowerCase()); } catch (_) {}
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const dry = args.includes('--dry') || !!opt('--file'), json = args.includes('--json');
  let rows, queue;
  try {
    rows = opt('--file') ? JSON.parse(readFileSync(resolve(opt('--file')), 'utf8')) : await api('/api/misses');
    queue = opt('--queue') ? JSON.parse(readFileSync(resolve(opt('--queue')), 'utf8')) : opt('--file') ? { items: [] } : await api('/api/queue');
  } catch (e) { console.error('learn: board not read: ' + (e.cause ? e.cause.code || e.cause.message : e.message)); process.exit(3); }
  const p = plan(rows, queue, { known: knownAsks() });
  const queued = [];
  for (const c of p.queue) {
    const job = jobOf(c);
    if (dry) { queued.push({ ...job, dry: true }); continue; }
    try {
      const r = await api('/api/queue', 'POST', { ask: job.ask, target: job.target });
      const it = r.item || {};
      if (it.id && it.ask === job.ask) { await api('/api/queue', 'PATCH', { id: it.id, note: job.note }); queued.push({ ...job, id: it.id }); }
      else queued.push({ ...job, id: it.id, skipped: 'a job with this target was already open' });
    } catch (e) { console.error('learn: could not queue "' + job.ask + '": ' + e.message); }
  }
  if (json) { console.log(JSON.stringify({ at: new Date().toISOString(), open: p.open, queued, later: p.later.map((c) => c.ask), skipped: p.skipped })); }
  else {
    console.log(`miss jobs open: ${p.open} of ${OPEN_MAX}; ${rows.length} rows on the board, ${p.queue.length + p.later.length} worth learning`);
    for (const q of queued) console.log(`  ${q.dry ? 'would queue' : q.skipped ? 'already open' : 'queued ' + q.id}: ${q.ask}  [${q.target}]  ${q.note}`);
    for (const c of p.later) console.log(`  later: ${c.ask} (score ${c.score})`);
    if (!queued.length && !p.later.length) console.log('  nothing new to learn from the last ' + DAYS + ' days');
  }
}
