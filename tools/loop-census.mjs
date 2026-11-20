// Every loop Verse runs, in one list (owner, 2026-11-20: "look through whats automatic and make it more and better"; 2026-11-13: log each
// loop's cost so he can see spending). Every 3 hours the conductor's tick (tools/conductor.mjs) reads the newest 30 runs on main of every
// workflow in .github/workflows and writes one row per loop into its record (domains/conductor.json, `census`): what it is, its schedule,
// how many runs its crons asked for in the last 24 hours and how many happened, how late GitHub started the scheduled ones, its last
// result, its success rate, the runner minutes it held and what it cost. The owner reads it on /progress/ (GET /api/loops, owner only).
// The repository is public, so standard GitHub Actions minutes are not billed: the cost of a run is $0 and the minutes are still shown.
//   node tools/loop-census.mjs            print the census as JSON (needs gh signed in, read only)
import { readFileSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cronsOf, parseCron, lastSlot, newestSlot, CATCHUP } from './catchup-core.mjs';

const H = 3600000, MIN = 60000;
export const CENSUS_EVERY_H = 3;
/** the first sentence of a workflow's header comment, as plain words (what the loop is for). Pure. */
export function whatOf(yaml) {
  const lines = String(yaml || '').split('\n'), out = [];
  for (const l of lines) { if (!/^#/.test(l)) break; out.push(l.replace(/^#\s?/, '')); }
  const text = out.join(' ').replace(/\s+/g, ' ').trim();
  const first = (/^(.*?\.)(\s|$)/.exec(text) || [, text])[1];
  return first.length > 160 ? first.slice(0, 159).replace(/\s+\S*$/, '') + '…' : first;
}
/** the workflow's display name. Pure. */
export function nameOf(yaml, file) { const m = /^name:\s*['"]?(.+?)['"]?\s*$/m.exec(String(yaml || '')); return m ? m[1] : file; }
/** how many times the crons fire in the 24 hours before now. Pure. */
export function slots24(crons, now) {
  let n = 0;
  for (const c of crons) { const p = parseCron(c); if (!p) continue; for (let t = now; ; ) { const s = lastSlot(p, t, 2); if (!s || s <= now - 24 * H) break; n++; t = s - MIN; } }
  return n;
}
const mins = (r) => { const a = Date.parse(r.run_started_at || r.created_at), b = Date.parse(r.updated_at); return Number.isFinite(a) && Number.isFinite(b) && b > a ? (b - a) / MIN : 0; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

/** one row for a loop. runs: its newest runs on main, newest first. Pure. */
export function rowOf({ file, yaml, runs = [], now, unread = false }) {
  const crons = cronsOf(yaml), done = runs.filter((r) => r.status === 'completed' && !['skipped', 'cancelled'].includes(r.conclusion));
  const ok = done.filter((r) => r.conclusion === 'success' || r.conclusion === 'neutral').length, fail = done.length - ok;
  const day = runs.filter((r) => now - Date.parse(r.created_at) < 24 * H), sched = day.filter((r) => r.event === 'schedule');
  const late = !crons.length ? [] : runs.filter((r) => r.event === 'schedule').map((r) => (Date.parse(r.created_at) - newestSlot(crons, Date.parse(r.created_at))) / MIN).filter((x) => x >= 0);
  const avg = done.length ? done.reduce((n, r) => n + mins(r), 0) / done.length : 0;
  const last = runs[0] || null, lastDone = done[0] || null;
  const expected = crons.length ? slots24(crons, now) : 0;
  let streak = 0; for (const r of done) { if (r.conclusion === 'success' || r.conclusion === 'neutral') break; streak++; }
  const full = runs.length >= 30 && day.length === runs.length; // every run read is from today: it ran at least this often
  const prOnly = !runs.length && /^\s*pull_request(_target)?:/m.test(yaml);
  const status = unread ? 'unread' : prOnly ? 'on pull requests' : !runs.length ? 'never ran' : streak >= 3 ? 'failing' : lastDone && lastDone.conclusion === 'failure' ? 'last run failed'
    : now - Date.parse(last.created_at) > 30 * 24 * H ? 'idle' : crons.length && expected >= 2 && !full && day.length < expected / 2 ? 'behind' : 'working';
  return {
    wf: file, name: nameOf(yaml, file), what: whatOf(yaml), crons, onClock: CATCHUP.some((c) => c.wf === file),
    expected24: expected, ran24: day.length, scheduled24: sched.length, lateMin: late.length ? Math.round(median(late)) : null,
    last: last ? { at: last.created_at, event: last.event, result: last.conclusion || last.status, url: last.html_url } : null,
    seen: runs.length, ok, fail, rate: done.length ? Math.round((ok / done.length) * 100) : null, streak,
    minutesPerRun: Math.round(avg * 10) / 10, minutesPerDay: Math.round(avg * day.length), costCentsPerDay: 0, status,
  };
}
const ORDER = { unread: 7, failing: 0, 'last run failed': 1, behind: 2, 'never ran': 3, working: 4, 'on pull requests': 5, idle: 6 };
/** the census: rows sorted problems first, and totals. Pure. */
export function census(rows, now) {
  const sorted = [...rows].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || b.ran24 - a.ran24);
  const count = (s) => rows.filter((r) => r.status === s).length;
  return {
    at: new Date(now).toISOString(), loops: rows.length, working: count('working'), failing: count('failing') + count('last run failed'), behind: count('behind'), idle: count('idle') + count('never ran'),
    runs24: rows.reduce((n, r) => n + r.ran24, 0), minutes24: rows.reduce((n, r) => n + r.minutesPerDay, 0), costCents24: rows.reduce((n, r) => n + r.costCentsPerDay, 0),
    note: 'GitHub Actions on a public repository: standard runner minutes are not billed, so each run costs $0. Models are the free ones first; a paid call is logged by the treasury.',
    rows: sorted,
  };
}

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
/** read every workflow and its runs (gh, read only) and build the census. */
const ghAsync = (...a) => new Promise((ok, no) => execFile('gh', a, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 << 20 }, (e, out) => (e ? no(e) : ok(out))));
export async function readCensus({ repo = process.env.GITHUB_REPOSITORY || 'atomeam/void-loop', now = Date.now(), gh = ghAsync, at = 6 } = {}) {
  const dir = resolve(ROOT, '.github', 'workflows');
  const files = readdirSync(dir).filter((x) => /\.ya?ml$/.test(x)).sort(), rows = new Array(files.length);
  let next = 0;
  await Promise.all(Array.from({ length: at }, async () => {
    while (next < files.length) {
      const i = next++, f = files[i], yaml = readFileSync(resolve(dir, f), 'utf8');
      let runs = [], unread = false;
      try { runs = JSON.parse(await gh('api', `repos/${repo}/actions/workflows/${f}/runs?branch=main&per_page=30`)).workflow_runs || []; } catch (_) { unread = true; } // void-review: ok (one read per workflow, 6 at once, every 3 hours: GitHub has no one call for every workflow's runs)
      rows[i] = rowOf({ file: f, yaml, runs, now, unread });
    }
  }));
  return census(rows.filter(Boolean), now);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await readCensus(), null, 1));
