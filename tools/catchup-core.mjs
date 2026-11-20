// The catch-up clock (owner, 2026-11-20: "look through whats automatic and make it more and better"). GitHub's scheduler drops and delays
// this repo's crons: on 2026-11-20 pages-guard.yml ('*/15') fired 3 times in 24 hours instead of 96, site-test.yml (hourly) 3 times, and the
// daily jobs started 7 to 10 hours after their hour. The conductor (tools/conductor.mjs) ticks every 10 minutes on its own chain, so each
// tick it reads the crons of the loops below from their workflow files and starts any loop whose newest slot has come and gone with no run
// since (any trigger). When GitHub's late scheduled run for a slot the clock already covered turns up still running, the clock cancels it,
// so a slot runs once. Pure: no fetch, no git, no clock of its own.

const MIN = 60000;
/** the loops the clock keeps on time: each is safe to run again (a read, a check, or a snapshot that rewrites the same file), and none is a
 *  loop another lane owns (the merge sweep, the podcast and films, the brain and will, the games and the wants have their own clocks).
 *  inputs: what a hand run needs to do the scheduled run's job. grace: minutes after the slot before the clock steps in. counts: the
 *  triggers whose runs do the scheduled job (tower-gate's deploy runs measure one floor, not the sweep); unset, every trigger counts. */
export const CATCHUP = Object.freeze([
  { wf: 'pages-guard.yml', grace: 10, what: 'the site is up and only the real deploy can deploy it' },
  { wf: 'site-test.yml', grace: 20, what: 'the hourly live test in headless Chrome' },
  { wf: 'exam.yml', grace: 30, what: 'the daily outcome exam on the live site' },
  { wf: 'tower-gate.yml', grace: 30, inputs: { floor: 'all' }, counts: ['schedule', 'workflow_dispatch'], what: 'the daily tower sweep of every floor' },
  { wf: 'tower-size.yml', grace: 30, what: 'the daily tower size check' },
  { wf: 'review-main.yml', grace: 30, what: 'the daily review of main' },
  { wf: 'treasury.yml', grace: 30, what: 'the daily found-money scan and wallet read' },
  { wf: 'store-check.yml', grace: 30, what: 'the daily store check' },
  { wf: 'key-keeper.yml', grace: 30, what: 'the daily key check' },
  { wf: 'traffic.yml', grace: 30, what: 'the daily traffic read' },
  { wf: 'trialwatch.yml', grace: 30, what: 'the daily trial watch' },
  { wf: 'reefwatch.yml', grace: 30, what: 'the daily reef watch' },
  { wf: 'site-history.yml', grace: 30, what: 'the daily site history' },
  { wf: 'rides-live.yml', grace: 30, what: 'the daily live rides check' },
  { wf: 'baggage-live.yml', grace: 30, what: 'the daily live baggage check' },
  { wf: 'jobs-snapshot.yml', grace: 30, what: 'the daily jobs snapshot' },
  { wf: 'misses-snapshot.yml', grace: 30, what: 'the daily missed-asks snapshot' },
  { wf: 'coins-snapshot.yml', grace: 30, what: 'the daily coins snapshot' },
  { wf: 'rea-study.yml', grace: 30, what: 'the daily study' },
  { wf: 'subject-eval.yml', grace: 30, what: 'the daily subject exam' },
  { wf: 'better.yml', grace: 30, what: 'the daily better pass' },
  { wf: 'lab-sync.yml', grace: 30, what: 'the daily lab sync' },
  { wf: 'dispatcher.yml', grace: 30, what: 'the daily dispatcher' },
  { wf: 'autosalvage.yml', grace: 30, what: 'the daily salvage' },
  { wf: 'trading-bots-data.yml', grace: 30, what: 'the daily trading bots data' },
  { wf: 'pages-ai-keys.yml', grace: 30, what: 'the daily AI keys push to the site' },
  { wf: 'store-gap.yml', grace: 30, what: 'the store gap pass every 4 hours' },
  { wf: 'word-sweep.yml', grace: 30, what: 'the wording sweep every 6 hours' },
  { wf: 'verse-watch.yml', grace: 20, what: 'the hourly watch' },
  { wf: 'growth-fold.yml', grace: 20, what: 'the hourly growth fold' },
  { wf: 'arb-record.yml', grace: 15, what: 'the half-hourly record' },
  { wf: 'gaps.yml', grace: 60, what: 'the weekly gaps pass' },
  { wf: 'genre-refs.yml', grace: 60, what: 'the weekly genre references' },
  { wf: 'visual.yml', grace: 60, what: 'the weekly visual check' },
  { wf: 'mirror.yml', grace: 60, what: 'the weekly mirror' },
  { wf: 'site-re.yml', grace: 60, what: 'the weekly site read' },
  { wf: 'review-bench.yml', grace: 60, what: 'the weekly review bench' },
  { wf: 'free-pics-probe.yml', grace: 60, what: 'the weekly free pictures probe' },
  { wf: 'tower-rank.yml', grace: 60, what: 'the monthly tower rank' },
]);
/** the most loops one tick starts, so a long outage does not start 40 runs at once (the rest start on the next ticks). */
export const PER_TICK = 6;

/** the crons in a workflow file's text, in order. Pure. */
export function cronsOf(yaml) {
  return [...String(yaml || '').matchAll(/(?:^\s*-\s*|\{\s*)cron:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1].trim());
}
function field(spec, lo, hi) {
  const set = new Set();
  for (const part of spec.split(',')) {
    const [range, stepS] = part.split('/'), step = stepS ? Number(stepS) : 1;
    let a = lo, b = hi;
    if (range !== '*') { const [x, y] = range.split('-').map(Number); a = x; b = y === undefined ? (stepS ? hi : x) : y; }
    if (![a, b, step].every(Number.isFinite) || step < 1 || a < lo || b > hi || a > b) return null;
    for (let v = a; v <= b; v += step) set.add(v);
  }
  return set;
}
/** a five-field cron as sets (minute, hour, day of month, month, day of week; 7 is Sunday too), or null when it cannot be read. Pure. */
export function parseCron(cron) {
  const f = String(cron || '').trim().split(/\s+/);
  if (f.length !== 5) return null;
  const sets = [field(f[0], 0, 59), field(f[1], 0, 23), field(f[2], 1, 31), field(f[3], 1, 12), field(f[4], 0, 7)];
  if (sets.some((s) => !s)) return null;
  if (sets[4].has(7)) sets[4].add(0);
  return { min: sets[0], hour: sets[1], dom: sets[2], mon: sets[3], dow: sets[4], anyDom: f[2] === '*', anyDow: f[4] === '*' };
}
/** the newest UTC minute at or before `now` the cron fires, looking back at most `days`; 0 when none. Pure. */
export function lastSlot(cron, now, days = 32) {
  const c = typeof cron === 'string' ? parseCron(cron) : cron; if (!c) return 0;
  let t = Math.floor(now / MIN) * MIN;
  for (const stop = now - days * 1440 * MIN; t >= stop;) {
    const d = new Date(t);
    const dayOk = c.anyDom && c.anyDow ? true : c.anyDom ? c.dow.has(d.getUTCDay()) : c.anyDow ? c.dom.has(d.getUTCDate()) : (c.dom.has(d.getUTCDate()) || c.dow.has(d.getUTCDay()));
    if (!c.mon.has(d.getUTCMonth() + 1) || !dayOk) { t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MIN; continue; }
    if (!c.hour.has(d.getUTCHours())) { t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()) - MIN; continue; }
    if (c.min.has(d.getUTCMinutes())) return t;
    t -= MIN;
  }
  return 0;
}
/** the newest slot of any of a workflow's crons. Pure. */
export function newestSlot(crons, now) { return Math.max(0, ...crons.map((c) => lastSlot(c, now))); }

/** should the clock start this loop now: its newest slot is older than the grace, no run (any trigger) was created since that slot, and
 *  none runs or waits. runs: the workflow's newest runs [{ created_at, status }]. Pure. */
export function catchupDue({ crons, runs, now, grace = 30, busy, counts }) {
  const slot = newestSlot(crons || [], now);
  if (!slot || busy || now - slot < grace * MIN) return false;
  return !(runs || []).some((r) => (!counts || counts.includes(r.event)) && Date.parse(r.created_at) >= slot);
}
/** GitHub's late scheduled runs to cancel: a scheduled run still queued or running whose slot another run (any other trigger, not a
 *  failure) already started after. Pure. */
export function lateDuplicates({ crons, runs, counts, busy = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']) }) {
  const out = [];
  for (const r of runs || []) {
    if (r.event !== 'schedule' || !busy.has(r.status)) continue;
    const at = Date.parse(r.created_at), slot = newestSlot(crons || [], at);
    if (!slot) continue;
    const covered = (runs || []).some((x) => x.id !== r.id && x.event !== 'schedule' && (!counts || counts.includes(x.event)) && Date.parse(x.created_at) >= slot && Date.parse(x.created_at) < at && x.conclusion !== 'failure' && x.conclusion !== 'cancelled');
    if (covered) out.push(r.id);
  }
  return out;
}
