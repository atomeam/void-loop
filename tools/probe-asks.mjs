// V01D writes its own probe asks (frontier #28, step 2 of docs/playbooks/probe-and-fix.md): the probe is V01D's, the fix still a
// builder's. Picks the family V01D is least proven in (void-live-deploy/skills/families.json, or --family <id>), asks the live
// site's owner-only /api/probe-asks for 25 asks in that family (V01D's own model writes them; lib/probe-asks.js keeps only plain,
// bench-shaped ones), runs them through the everyday benchmark (tools/bench.mjs --probe, the real page, outside services
// stubbed) and queues the misses for the builders at /api/queue as `probe:<slug>` jobs, at most PROBE_OPEN_MAX open at once, a
// target never queued twice. The asks are V01D's words, not a visitor's; still, none are committed here: the probe file lives
// in the temp folder and the job summary carries the asks only as quoted data.
//   node tools/probe-asks.mjs                 write, probe and queue (owner token VOID_OWNER_TOKEN)
//   node tools/probe-asks.mjs --family words  a named family instead of the least proven one
//   node tools/probe-asks.mjs --dry           write and probe, queue nothing
//   node tools/probe-asks.mjs --asks c.json   skip the model: probe the asks in a file (always dry unless --queue-too)
//   node tools/probe-asks.mjs --no-probe      write the asks only (prints them; for a look at what V01D writes)
// Exit 0 when it ran (misses or not), 1 when the probe could not run, 3 when the site could not be reached or had no asks.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import crypto from 'node:crypto';
import { pickFamily, allowedWants, examplesFor } from '../void-live-deploy/lib/probe-asks.js';
import { slug } from '../void-live-deploy/lib/learn.js';

export const PROBE_OPEN_MAX = 2; // open probe jobs at once
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

/** The file tools/bench.mjs writes the last probe's misses to (one per checkout); read here after the probe. */
export const againFile = (toolsDir = here) => join(os.tmpdir(), 'void-probe-misses-' + crypto.createHash('sha1').update(toolsDir).digest('hex').slice(0, 10) + '.json');

/** What the route is asked: the family, the shape examples and the wants, from the repo's own data. */
export function requestFor(fam, bench, family = '') {
  const f = pickFamily(fam, family);
  if (!f) return null;
  return { family: f.id, examples: examplesFor(f, bench), wants: allowedWants(f, bench) };
}

/** Candidates not already in the benchmark (those are answered already; bench.mjs skips them, and a skipped ask would read as a miss in its again file). */
export const freshOnly = (asks, bench) => { const have = new Set((bench || []).map((x) => String(x.ask).trim().toLowerCase())); return (asks || []).filter((a) => !have.has(String(a.ask).trim().toLowerCase())); };

/** The job for one miss: V01D's own words as quoted data, a target from the ask's slug. */
export const jobOf = (m, family) => ({
  ask: ('learn to handle "' + m.ask + '"').slice(0, 120),
  target: 'probe:' + slug(m.ask),
  note: ('Verse wrote this ask for its ' + family + ' family and missed it (wanted ' + m.want + '); from the daily probe (tools/probe-asks.mjs), not a visitor\'s words').slice(0, 300),
});

/** the things a probe asked the forge to make and it missed (frontier #14): the misses that wanted the forge, "make me a giraffe" ->
 * "giraffe"; only the thing's name. */
export const forgeWants = (misses) => [...new Set((misses || []).filter((m) => m && /\bforge\b/.test(String(m.want || '')))
  .map((m) => String(m.ask).toLowerCase().replace(/^.*?(?:make|build|forge|3d[\s-]?print|print|sculpt)\s+(?:me\s+)?(?:an?\s+)?(?:3d\s+)?/, '').replace(/[^a-z -]+/g, ' ').trim().replace(/\s+(?:in 3d|i can print|for me|please)$/, '').replace(/\s+/g, ' ').trim().slice(0, 30))
  .filter((t) => /^[a-z][a-z -]{1,30}$/.test(t)))].slice(0, 8);

/** What to queue: the misses in order, within the open limit, skipping targets already in the queue. */
export function plan(misses, queue, family, { openMax = PROBE_OPEN_MAX } = {}) {
  const items = (queue && queue.items) || [];
  const open = items.filter((i) => /^probe:/.test(i.target) && /^(queued|building)$/.test(i.state)).length;
  const taken = new Set(items.map((i) => i.target));
  const jobs = [], seen = new Set();
  for (const m of misses || []) { const j = jobOf(m, family); if (taken.has(j.target) || seen.has(j.target)) continue; seen.add(j.target); jobs.push(j); }
  const room = Math.max(0, openMax - open);
  return { open, room, queue: jobs.slice(0, room), later: jobs.slice(room) };
}

export const summary = ({ family, wrote, probed, misses, queued, dry }) => [
  '### Verse probed its ' + family + ' family',
  '',
  '| What | How many |', '|:--|--:|',
  '| asks Verse wrote | ' + wrote + ' |', '| new to the benchmark, probed | ' + probed + ' |', '| missed | ' + misses.length + ' |',
  '| queued for the builders | ' + (dry ? 'none (dry)' : queued.length) + ' |',
  ...(misses.length ? ['', 'Missed (Verse\'s own words, as data): ' + misses.map((m) => '"' + m.ask + '" (wanted ' + m.want + ')').join('; ')] : []),
].join('\n');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const fromFile = opt('--asks'), dry = args.includes('--dry') || (!!fromFile && !args.includes('--queue-too')), noProbe = args.includes('--no-probe');
  const api = async (path, method = 'GET', body) => {
    const tok = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN; if (!tok) throw new Error('VOID_OWNER_TOKEN is not set in this environment');
    const res = await fetch(SITE + path, { method, headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-probe-asks/1.0', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`); return res.json();
  };
  const bench = JSON.parse(readFileSync(join(here, 'bench.json'), 'utf8'));
  const fam = JSON.parse(readFileSync(join(root, 'void-live-deploy/skills/families.json'), 'utf8'));
  let family, asks;
  try {
    if (fromFile) { asks = JSON.parse(readFileSync(resolve(fromFile), 'utf8')); family = opt('--family') || (pickFamily(fam) || {}).id || 'named'; }
    else {
      const req = requestFor(fam, bench, opt('--family') || '');
      if (!req) { console.error('probe-asks: no family called ' + opt('--family')); process.exit(3); }
      const r = await api('/api/probe-asks', 'POST', req);
      family = (r.family && r.family.id) || req.family; asks = r.asks || [];
    }
  } catch (e) { console.error('probe-asks: Verse did not write asks: ' + e.message); process.exit(3); }
  const fresh = freshOnly(asks, bench);
  if (noProbe) { console.log(JSON.stringify({ family, asks }, null, 1)); process.exit(0); }
  // one record per run in V01D's probe ledger (lib/probe-log.js, the growth card's "My probes"): counts only, never the asks
  const logRun = async (probed, missed, queuedN, forge = []) => { if (dry) return; try { await api('/api/probe-log', 'POST', { kind: 'probe', family: family && family.id, wrote: asks.length, probed, misses: missed, queued: queuedN, forge }); } catch (e) { console.error('probe-asks: the probe ledger was not written: ' + e.message); } };
  if (!fresh.length) { await logRun(0, 0, 0); console.log(summary({ family, wrote: asks.length, probed: 0, misses: [], queued: [], dry })); process.exit(asks.length ? 0 : 3); }
  const file = join(os.tmpdir(), 'void-probe-asks-' + Date.now().toString(36) + '.json');
  writeFileSync(file, JSON.stringify(fresh, null, 1));
  const run = spawnSync(process.execPath, [join(here, 'bench.mjs'), '--probe', file], { stdio: 'inherit', timeout: 20 * 60000 });
  if (run.status !== 0 || !existsSync(againFile())) { console.error('probe-asks: the probe did not run (exit ' + run.status + ')'); process.exit(1); }
  const misses = JSON.parse(readFileSync(againFile(), 'utf8'));
  let queued = [];
  if (!dry && misses.length) {
    try {
      const q = await api('/api/queue'), p = plan(misses, q, family);
      for (const job of p.queue) {
        const r = await api('/api/queue', 'POST', { ask: job.ask, target: job.target }), it = r.item || {};
        if (it.id && it.ask === job.ask) { await api('/api/queue', 'PATCH', { id: it.id, note: job.note }); queued.push({ ...job, id: it.id }); }
      }
      if (p.later.length) console.log(p.later.length + ' more miss(es) wait: ' + PROBE_OPEN_MAX + ' probe jobs open at once');
    } catch (e) { console.error('probe-asks: could not queue: ' + e.message); }
  }
  await logRun(fresh.length, misses.length, queued.length, forgeWants(misses));
  console.log('\n' + summary({ family, wrote: asks.length, probed: fresh.length, misses, queued, dry }));
}
