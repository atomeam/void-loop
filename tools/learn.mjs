// The sweep door of Void learning by itself (void-live-deploy/lib/learn.js has the brain and the miss-time door):
// reads the whole miss board (/api/misses), ranks what people typed in the last week, and queues the top ones for the
// builders at /api/queue as `miss:<slug>` jobs, at most OPEN_MAX open at once. Misses already queued, built, or beaten
// (tools/grown.json, tools/bench.json) are skipped.
//   node tools/learn.mjs            queue the top missed asks (owner token VOID_OWNER_TOKEN or VOID_MISSES_TOKEN)
//   node tools/learn.mjs --dry      show what would be queued, queue nothing
//   node tools/learn.mjs --json     print the result as JSON (a workflow reads `queued` from it)
//   node tools/learn.mjs --file rows.json [--queue queue.json]   rank rows from files instead of the site (always dry)
// Exit 0 when the board was read (even with nothing to queue); exit 3 when the site can't be reached.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, jobOf, OPEN_MAX, DAYS } from '../void-live-deploy/lib/learn.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

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
