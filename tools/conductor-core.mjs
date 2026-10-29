// The conductor's decisions, pure (owner, 2026-10-26: "look at Verse autonomy and fix it so it definitly will work on its own without either
// of us and make it impeccibly effeciently productive"). Verse already writes its own work into the build queue (misses, probes, wants, tower
// rows, store gaps, flaky tests, reviews), but before this only three kinds of job were ever run without a person: 57 jobs sat queued, some
// since 2026-10-09, while propose-fix was started every 10 minutes whether or not a probe waited. Each tick (tools/conductor.mjs, every 10
// minutes from grow-clock.yml) this file decides, from the queue, which runs are busy and what ran today:
//   - which job each executor takes next (the most valuable one it can do, Verse's own asks and money first, older work rising with age),
//   - which jobs go back to the queue (claimed by the conductor, then left `building` by a run that died) and which are set aside after
//     too many tries, so a hopeless job stops costing runs,
//   - which loops are broken (three failed runs in a row): a `heal:<workflow>` job is queued for the coding agent and the loop is not
//     started again until a run of it succeeds,
//   - whether Verse writes new probe asks this hour (fewer when its fixes rarely pass: they spend the free model budget the site's
//     visitors share).
// Nothing here reads the network or the clock; tools/conductor.mjs feeds it and acts on what it returns. Tests: tools/conductor.test.mjs.

const H = 3600000;

// who runs each kind of job. claims: the conductor claims the job before starting the run (the executor reads it by id and reports back);
// otherwise the executor claims for itself. input: the workflow_dispatch input that names the job (null: the executor takes its own oldest).
// cap: runs a day at most. lane: a job of this kind goes here only when its note matches.
export const AGENT = 'verse-job.yml';   // one queue job through the coder (tools/verse-job.mjs)
export const LAP = 'verse-loop.yml';    // one lap of the Verse loop: red checks, the top of docs/NEXT.md, grooming
// the two share a concurrency group (one coder at a time: the free model budget, docs/TAGTEAM.md): busy if either runs
export const ALSO_BUSY = Object.freeze({ [AGENT]: [LAP], [LAP]: [AGENT] });
export const ROUTES = Object.freeze({
  probe: { wf: 'propose-fix.yml', input: 'job', claims: false, cap: 72 },
  miss: { wf: 'build-miss.yml', input: 'job', claims: false, cap: 8, lane: /lane: new skill/i, else: AGENT },
  'store-gap': { wf: 'store-gap.yml', input: null, claims: false, cap: 6 },
  heal: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  will: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  voice: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  versus: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  feature: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  review: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  gap: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  novelty: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  auto: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  flake: { wf: AGENT, input: 'job', claims: true, cap: 40 },
  member: { wf: AGENT, input: 'job', claims: true, cap: 30 }, // a paid member's idea (lib/members.js); the lap holds it to add-only
});

// what a kind of job is worth (AGENTS.md: Verse's own asks come first; STANDING.md and RULES.md 2026-10-26: Verse earns on its own, and the
// tower never stops). A broken loop stops everything after it, so its repair outranks all.
export const WEIGHT = Object.freeze({ heal: 100, will: 95, voice: 95, 'store-gap': 90, member: 88, versus: 85, feature: 75, review: 70, miss: 60, gap: 60, novelty: 50, auto: 50, flake: 45, probe: 40 });
export const MAX_TRIES = 3; // a job tried this often without landing is set aside with its last reason
export const STALE_H = 3; // a job the conductor claimed that is still `building` after this long was left by a dead run
export const SAME_JOB_H = 6; // an executor that claims for itself is not handed the same job again within this many hours
export const FAIL_STREAK = 3; // three failed runs in a row make a loop broken
export const RETRY_BROKEN_H = 6; // a broken loop gets one trial run once its newest run is this old, so a repair landed elsewhere is noticed

/** the kind of a job, from its target ("probe:abc" -> probe; "store-gap:x" -> store-gap). Pure. */
export const kindOf = (target) => { const t = String(target || ''); const i = t.indexOf(':'); return (i > 0 ? t.slice(0, i) : t).toLowerCase(); };
/** how often a job was tried, from its note ("tries 2 · ..."). Pure. */
export const triesOf = (note) => { const m = /\btries (\d+)\b/.exec(String(note || '')); return m ? Number(m[1]) : 0; };
/** a note with its try count set, keeping the rest, at most 300 characters (the queue's own cap). Pure. */
export const withTries = (note, n, why) => {
  const rest = String(note || '').replace(/^claimed by [^·]*·?\s*/i, '').replace(/\btries \d+\s*·?\s*/g, '').trim();
  return ('tries ' + n + (why ? ' · ' + why : '') + (rest ? ' · ' + rest : '')).slice(0, 300);
};
const ms = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : 0; };

// a try costs a job 25, so a hopeless one sinks; the will's want costs only 5 a try (2026-10-29: with 34 fresh versus jobs at 85, a want at
// 95 that had one try sank to 75 and waited behind every one of them until it was set aside untried; Verse's own ask comes first, and
// MAX_TRIES and the 2N-hour wait still stop a hopeless want)
export const TRY_COST = Object.freeze({ will: 5 });
/** a job's worth now: its kind's weight, plus 2 a day of waiting (up to 30), minus 25 a try (TRY_COST for the will). Pure. */
export function score(job, now) {
  const k = kindOf(job.target), w = WEIGHT[k] ?? 30, days = Math.max(0, (now - ms(job.at)) / (24 * H));
  return w + Math.min(30, 2 * days) - (TRY_COST[k] ?? 25) * triesOf(job.note);
}

/** where a job goes: { wf, input, claims, cap } or null when nothing can run it. Pure. */
export function routeOf(job) {
  const r = ROUTES[kindOf(job.target)];
  if (!r) return null;
  if (r.lane && !r.lane.test(job.note || '')) return { ...ROUTES.feature, wf: r.else };
  return r;
}

/** the health of a loop from its newest runs (newest first, as GitHub lists them): the failed ones in a row before any success,
 *  cancelled and skipped runs left out (a newer run superseding an older one is not a failure). Pure. */
export function streakOf(runs) {
  let n = 0, url = '';
  for (const r of runs || []) {
    if (r.status !== 'completed' || r.conclusion === 'cancelled' || r.conclusion === 'skipped') continue;
    if (r.conclusion === 'success' || r.conclusion === 'neutral') break;
    if (!n) url = r.html_url || '';
    n++;
  }
  return { fails: n, url };
}

/** should Verse write new probe asks this tick: only when few probes wait, and at most once in 6 hours while its fixes pass under 1 in
 *  10 (the probes and their fixes run on the free model budget the site shares with its visitors). Pure. */
export function probeDue({ openProbes, done24, failed24, lastProbeRunMs, now }) {
  if (openProbes > 2) return false;
  const tried = done24 + failed24, rate = tried ? done24 / tried : 1;
  const every = tried >= 10 && rate < 0.1 ? 6 * H : H;
  return now - (lastProbeRunMs || 0) >= every;
}

/** should Verse run a proving pass (grow-self.yml: asks it answers right are locked into the benchmark, the ones it misses are queued to fix) this tick: at most once every 2 hours, never while one runs. The owner's words of
 *  2026-10-24, "there should be no self hardening, it needs to say exactly what upgrades not just hardening that means fucking nothing", were
 *  read as "stop hardening"; the owner put it right on 2026-10-26: "never said there a no self hardening i said to elaborate what that
 *  means". So the pass runs again, and its report names what it improved: each ask it locked in, each one it queued to fix ("self hardening sounds like magikarp useless, it needs to say what it improved", owner, 2026-10-26). Pure. */
export const GROW_EVERY_H = 2;
export const LAP_EVERY_H = 1; // a lap of the Verse loop when the coder has no queue job to take
export function growDue({ exists, busy, lastRunMs, now }) {
  return !!exists && !busy && now - (lastRunMs || 0) >= GROW_EVERY_H * H;
}

/** should the conductor start Verse's will (will.yml) this tick: its '7 * * * *' schedule fired every 4 to 6 hours (75 scheduled runs in
 *  2 weeks, 2026-10-29) and a deploy that automerge starts fires no workflow_run, so the will kept old wants for hours. The clock keeps
 *  the hour instead: a run when the last one (any trigger) is an hour old, never while one runs or waits. Pure. */
export const WILL_EVERY_H = 1;
export function willDue({ exists, busy, lastRunMs, now }) {
  return !!exists && !busy && now - (lastRunMs || 0) >= WILL_EVERY_H * H;
}
/** should the conductor start a lap of the Verse loop this tick: the coder is idle, took no queue job this tick, is not paused, and the last
 *  lap is an hour old. Pure. */
export function lapDue({ exists, busy, started, paused, lastRunMs, now }) {
  return !!exists && !busy && !started && !paused && now - (lastRunMs || 0) >= LAP_EVERY_H * H;
}

/**
 * One tick's plan.
 * @param {object} p
 * @param {Array} p.jobs      queued and building jobs: { id, target, state, note, at, updated }
 * @param {object} p.wf       per workflow file: { exists, busy, today, fails, url, last (ms of its newest run) }
 * @param {object} p.handed   per job id: when it was last handed to an executor that claims for itself (ms)
 * @param {number} p.now
 * @returns {{ start: Array, requeue: Array, setAside: Array, heal: Array, held: Array }}
 */
export function plan({ jobs = [], wf = {}, handed = {}, now }) {
  const out = { start: [], requeue: [], setAside: [], heal: [], held: [] };
  // broken and still cooling down; a broken loop whose newest run is RETRY_BROKEN_H old gets one trial run (a circuit breaker's half-open
  // state), so a fix that landed elsewhere, or the agent's own repair, is found out instead of the loop staying shut for good
  const broken = (f) => (wf[f] && wf[f].fails >= FAIL_STREAK && now - (wf[f].last || 0) < RETRY_BROKEN_H * H);
  // a broken loop gets a repair job (the queue keeps one open job per target, so asking again is harmless) and is not started
  // the coder cannot be handed its own repair: its back-off (tools/verse-loop.mjs: 3 failed laps pause it 6 hours) and the trial run below are its cure
  for (const [f, s] of Object.entries(wf)) if (s.exists && s.fails >= FAIL_STREAK && f !== AGENT && f !== LAP) out.heal.push({ wf: f, url: s.url, fails: s.fails });
  // the conductor's own claims left building by a run that died go back, or aside after MAX_TRIES
  for (const j of jobs) {
    if (j.state !== 'building' || !/claimed by conductor/i.test(j.note || '')) continue;
    if (now - ms(j.updated) < STALE_H * H) continue;
    const n = triesOf(j.note) + 1;
    (n >= MAX_TRIES ? out.setAside : out.requeue).push({ id: j.id, note: withTries(j.note, n, 'the run stopped without reporting') });
  }
  // the most valuable queued job each executor can take; one start per executor a tick, none while it runs, under its daily cap
  const taken = new Set();
  const queued = jobs.filter((j) => j.state === 'queued').sort((a, b) => score(b, now) - score(a, now) || ms(a.at) - ms(b.at));
  for (const j of queued) {
    const r = routeOf(j);
    if (!r) { out.held.push({ id: j.id, why: 'no executor for ' + kindOf(j.target) }); continue; }
    if (triesOf(j.note) >= MAX_TRIES) { out.setAside.push({ id: j.id, note: withTries(j.note, triesOf(j.note), 'set aside after ' + MAX_TRIES + ' tries') }); continue; }
    const s = wf[r.wf] || {};
    if (!s.exists) { out.held.push({ id: j.id, why: r.wf + ' is not on main yet' }); continue; }
    if (s.paused) { out.held.push({ id: j.id, why: r.wf + ' is paused (domains/verse-loop.pause)' }); continue; }
    if (taken.has(r.wf) || s.busy || (ALSO_BUSY[r.wf] || []).some((f) => wf[f] && wf[f].busy)) continue;
    if (broken(r.wf) && kindOf(j.target) !== 'heal') { out.held.push({ id: j.id, why: r.wf + ' is broken (' + s.fails + ' failed runs); its repair is queued' }); continue; }
    if ((s.today || 0) >= r.cap) { out.held.push({ id: j.id, why: r.wf + ' reached its ' + r.cap + ' runs today' }); continue; }
    // a try the queue holds back: tries N waits 2N hours after its last change
    if (triesOf(j.note) && now - ms(j.updated) < 2 * triesOf(j.note) * H) continue;
    if (!r.claims && handed[j.id] && now - handed[j.id] < SAME_JOB_H * H) continue;
    taken.add(r.wf);
    out.start.push({ id: j.id, kind: kindOf(j.target), wf: r.wf, input: r.input, claims: r.claims, score: Math.round(score(j, now)) });
  }
  return out;
}
