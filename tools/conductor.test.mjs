// The conductor's decisions (tools/conductor-core.mjs): what each executor takes next, what goes back to the queue or aside, which loops
// are broken, and when Verse writes new probe asks. Run: node --test tools/conductor.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, score, kindOf, triesOf, withTries, routeOf, streakOf, probeDue, growDue, willDue, lapDue, AGENT, LAP, ALSO_BUSY, MAX_TRIES, FIRST } from './conductor-core.mjs';

const H = 3600000, NOW = Date.parse('2026-10-26T08:00:00Z');
const iso = (hAgo) => new Date(NOW - hAgo * H).toISOString();
const job = (id, target, o = {}) => ({ id, target, state: 'queued', note: '', at: iso(24), updated: iso(24), ...o });
const live = (o = {}) => ({ exists: true, busy: false, today: 0, fails: 0, last: NOW - H, ...o });
const all = (o = {}) => ({ [AGENT]: live(o[AGENT]), 'propose-fix.yml': live(o['propose-fix.yml']), 'build-miss.yml': live(o['build-miss.yml']), 'store-gap.yml': live(o['store-gap.yml']) });

test('kinds, tries and notes', () => {
  assert.equal(kindOf('probe:abc'), 'probe'); assert.equal(kindOf('store-gap:mugs'), 'store-gap'); assert.equal(kindOf('next'), 'next');
  assert.equal(triesOf('tries 2 · the run died'), 2); assert.equal(triesOf('asked 3x'), 0);
  assert.equal(withTries('claimed by conductor · asked 3x', 1, 'the run stopped'), 'tries 1 · the run stopped · asked 3x', 'the claim is dropped, the old note kept');
  assert.equal(withTries('tries 1 · x', 2, 'again'), 'tries 2 · again · x', 'one try count, not two');
  assert.ok(withTries('a'.repeat(400), 1, 'b').length <= 300);
});

test('Verse\'s own asks and money outrank old flakes; age lifts a job; tries lower it', () => {
  assert.ok(score(job('a', 'will:x'), NOW) > score(job('b', 'flake:y', { at: iso(24 * 10) }), NOW), 'a want beats a ten-day-old flake');
  assert.ok(score(job('a', 'feature:x', { at: iso(24 * 5) }), NOW) > score(job('b', 'feature:y'), NOW), 'the older feature first');
  assert.ok(score(job('a', 'feature:x', { note: 'tries 2' }), NOW) < score(job('b', 'feature:y'), NOW));
  assert.ok(score(job('a', 'will:x', { note: 'tries 2', at: iso(24 * 2) }), NOW) > score(job('b', 'versus:y', { at: iso(24) }), NOW), 'a two-day-old want tried twice still beats a day-old versus job');
  assert.ok(score(job('a', 'versus:x', { note: 'tries 1' }), NOW) < score(job('b', 'versus:y'), NOW), 'any other job still sinks 25 a try');
});

test('each executor takes its most valuable job, one a tick, and the agent claims while self-claiming executors do not', () => {
  const jobs = [job('f1', 'flake:t1', { at: iso(24 * 13) }), job('w1', 'will:paint'), job('p1', 'probe:q'), job('m1', 'miss:x', { note: 'lane: new skill' }), job('s1', 'store-gap:mugs')];
  const p = plan({ jobs, wf: all(), now: NOW });
  const by = Object.fromEntries(p.start.map((s) => [s.wf, s]));
  assert.equal(by[AGENT].id, 'w1', 'the want, not the old flake');
  assert.equal(by[AGENT].claims, true);
  assert.equal(by['propose-fix.yml'].id, 'p1'); assert.equal(by['propose-fix.yml'].claims, false);
  assert.equal(by['build-miss.yml'].id, 'm1');
  assert.equal(by['store-gap.yml'].id, 's1'); assert.equal(by['store-gap.yml'].input, null, 'store-gap takes its own oldest job');
  assert.equal(p.start.length, 4, 'one start per executor');
});

test('a miss that is not on the new-skill lane goes to the agent, not build-miss', () => {
  assert.equal(routeOf(job('m', 'miss:x', { note: 'lane: fix matcher' })).wf, AGENT);
  assert.equal(routeOf(job('m', 'miss:x', { note: 'lane: new skill' })).wf, 'build-miss.yml');
  assert.equal(routeOf(job('s', 'sale:acme')), null, 'a sale is a person\'s, never the conductor\'s');
});

test('a busy executor, one over its daily cap, or one not on main yet takes nothing, and says why', () => {
  const jobs = [job('w1', 'will:paint'), job('p1', 'probe:q')];
  const busy = plan({ jobs, wf: all({ [AGENT]: { busy: true }, 'propose-fix.yml': { today: 72 } }), now: NOW });
  assert.equal(busy.start.length, 0);
  assert.ok(busy.held.some((h) => /72 runs today/.test(h.why)));
  const missing = plan({ jobs: [job('w1', 'will:paint')], wf: { [AGENT]: { exists: false } }, now: NOW });
  assert.match(missing.held[0].why, /not on main yet/);
});

test('a job the conductor claimed and a dead run left building goes back with a try counted, and aside at the last try', () => {
  const jobs = [job('b1', 'feature:x', { state: 'building', note: 'claimed by conductor', updated: iso(4) }),
    job('b2', 'feature:y', { state: 'building', note: 'claimed by conductor · tries 2', updated: iso(5) }),
    job('b3', 'feature:z', { state: 'building', note: 'claimed by conductor', updated: iso(1) }),
    job('b4', 'feature:w', { state: 'building', note: 'claimed by laptop', updated: iso(9) })];
  const p = plan({ jobs, wf: all(), now: NOW });
  assert.deepEqual(p.requeue.map((r) => r.id), ['b1']); assert.match(p.requeue[0].note, /^tries 1 · the run stopped/);
  assert.deepEqual(p.setAside.map((r) => r.id), ['b2']);
  assert.ok(!p.requeue.concat(p.setAside).some((r) => r.id === 'b3' || r.id === 'b4'), 'a fresh claim and a person\'s claim are left alone');
});

test('a retried job waits 2 hours a try; one at MAX_TRIES is set aside instead of started', () => {
  const soon = plan({ jobs: [job('t1', 'feature:x', { note: 'tries 1', updated: iso(1) })], wf: all(), now: NOW });
  assert.equal(soon.start.length, 0, 'still cooling down');
  const later = plan({ jobs: [job('t1', 'feature:x', { note: 'tries 1', updated: iso(3) })], wf: all(), now: NOW });
  assert.equal(later.start[0].id, 't1');
  const done = plan({ jobs: [job('t2', 'feature:x', { note: 'tries ' + MAX_TRIES })], wf: all(), now: NOW });
  assert.equal(done.setAside[0].id, 't2'); assert.equal(done.start.length, 0);
});

test('a self-claiming executor is not handed the same job again within 6 hours', () => {
  const jobs = [job('p1', 'probe:q'), job('p2', 'probe:r', { at: iso(2) })];
  const p = plan({ jobs, wf: all(), handed: { p1: NOW - 2 * H }, now: NOW });
  assert.equal(p.start.find((s) => s.wf === 'propose-fix.yml').id, 'p2');
});

test('a loop failing 3 runs in a row gets a repair job, is shut while it cools, and gets one trial run after 6 hours', () => {
  const runs = [{ status: 'completed', conclusion: 'failure', html_url: 'u3' }, { status: 'completed', conclusion: 'cancelled' }, { status: 'completed', conclusion: 'failure' }, { status: 'completed', conclusion: 'failure' }, { status: 'completed', conclusion: 'success' }];
  assert.deepEqual(streakOf(runs), { fails: 3, url: 'u3' }, 'a cancelled run is not a failure');
  assert.equal(streakOf([{ status: 'in_progress' }, { status: 'completed', conclusion: 'success' }]).fails, 0);
  const shut = plan({ jobs: [job('p1', 'probe:q'), job('h1', 'heal:propose-fix.yml')], wf: all({ 'propose-fix.yml': { fails: 3, url: 'u3', last: NOW - H } }), now: NOW });
  assert.deepEqual(shut.heal, [{ wf: 'propose-fix.yml', url: 'u3', fails: 3 }]);
  assert.ok(!shut.start.some((s) => s.wf === 'propose-fix.yml'));
  assert.equal(shut.start.find((s) => s.wf === AGENT).id, 'h1', 'the repair goes to the agent first');
  const trial = plan({ jobs: [job('p1', 'probe:q')], wf: all({ 'propose-fix.yml': { fails: 3, last: NOW - 7 * H } }), now: NOW });
  assert.equal(trial.start.find((s) => s.wf === 'propose-fix.yml').id, 'p1', 'half-open: one trial run');
  const agentDown = plan({ jobs: [job('w1', 'will:x')], wf: all({ [AGENT]: { fails: 4, last: NOW - H } }), now: NOW });
  assert.equal(agentDown.heal.length, 0, 'the agent cannot be handed its own repair');
  assert.ok(agentDown.held.some((h) => /broken/.test(h.why)));
});

test('new probe asks only when few wait, hourly at most, every 6 hours while fixes pass under 1 in 10', () => {
  assert.equal(probeDue({ openProbes: 5, done24: 5, failed24: 5, lastProbeRunMs: 0, now: NOW }), false, 'plenty waiting');
  assert.equal(probeDue({ openProbes: 0, done24: 3, failed24: 7, lastProbeRunMs: NOW - 2 * H, now: NOW }), true, 'healthy rate, an hour passed');
  assert.equal(probeDue({ openProbes: 0, done24: 0, failed24: 30, lastProbeRunMs: NOW - 2 * H, now: NOW }), false, 'failing rate: wait 6 hours');
  assert.equal(probeDue({ openProbes: 0, done24: 0, failed24: 30, lastProbeRunMs: NOW - 7 * H, now: NOW }), true);
});

test('the proving pass (grow-self.yml) runs again, at most every 2 hours and never twice at once (owner, 2026-10-26: "never said there a no self hardening")', () => {
  assert.equal(growDue({ exists: true, busy: false, lastRunMs: NOW - 3 * H, now: NOW }), true);
  assert.equal(growDue({ exists: true, busy: false, lastRunMs: NOW - H, now: NOW }), false, 'ran an hour ago');
  assert.equal(growDue({ exists: true, busy: true, lastRunMs: NOW - 9 * H, now: NOW }), false, 'one at a time');
  assert.equal(growDue({ exists: false, busy: false, lastRunMs: 0, now: NOW }), false);
  // the will: hourly from the clock, whatever started the last run (its own cron comes hours late, a deploy start counts too)
  assert.equal(willDue({ exists: true, busy: false, lastRunMs: NOW - 61 * 60000, now: NOW }), true);
  assert.equal(willDue({ exists: true, busy: false, lastRunMs: NOW - 20 * 60000, now: NOW }), false, 'ran 20 minutes ago');
  assert.equal(willDue({ exists: true, busy: true, lastRunMs: NOW - 9 * H, now: NOW }), false, 'one at a time');
  assert.equal(willDue({ exists: false, busy: false, lastRunMs: 0, now: NOW }), false);
});

test('a paused coder (domains/verse-loop.pause) takes no job and says why; the other executors go on', () => {
  const jobs = [job('w1', 'will:paint'), job('p1', 'probe:q')];
  const p = plan({ jobs, wf: all({ [AGENT]: { paused: true } }), now: NOW });
  assert.ok(!p.start.some((s) => s.wf === AGENT));
  assert.ok(p.held.some((h) => /paused \(domains\/verse-loop\.pause\)/.test(h.why)));
  assert.equal(p.start.find((s) => s.wf === 'propose-fix.yml').id, 'p1', 'probes are not the coder\'s');
});

test('verse-job and verse-loop are one coder: a lap running holds the queue job back, and neither is handed its own repair', () => {
  const jobs = [job('w1', 'will:paint')];
  const busy = plan({ jobs, wf: { ...all(), [LAP]: live({ busy: true }) }, now: NOW });
  assert.equal(busy.start.length, 0, 'the lap is running: one coder at a time');
  assert.deepEqual(ALSO_BUSY[AGENT], [LAP]); assert.deepEqual(ALSO_BUSY[LAP], [AGENT]);
  const lapDown = plan({ jobs: [], wf: { ...all(), [LAP]: live({ fails: 5, last: NOW - H }) }, now: NOW });
  assert.equal(lapDown.heal.length, 0, 'the loop\'s own back-off is its cure, not a queue job for itself');
});

test('a lap of the Verse loop starts hourly when the coder is idle, took no job this tick and is not paused', () => {
  const base = { exists: true, busy: false, started: false, paused: false, lastRunMs: NOW - 2 * H, now: NOW };
  assert.equal(lapDue(base), true);
  assert.equal(lapDue({ ...base, lastRunMs: NOW - 30 * 60000 }), false, 'a lap ran 30 minutes ago');
  assert.equal(lapDue({ ...base, busy: true }), false); assert.equal(lapDue({ ...base, started: true }), false, 'a job took the coder this tick');
  assert.equal(lapDue({ ...base, paused: true }), false); assert.equal(lapDue({ ...base, exists: false }), false);
});

test('a paid member\'s idea goes before every free job however old, a repair before it, and 30 coder runs today do not hold it', () => {
  const free = [job('v1', 'versus:x', { at: iso(24 * 15) }), job('w1', 'will:paint', { at: iso(24 * 3) }), job('f1', 'feature:y', { at: iso(24 * 20) })];
  const member = job('m1', 'member:abc', { at: iso(0) });
  assert.ok(score(free[0], NOW) > score(member, NOW), 'by score alone the old versus job would win');
  assert.deepEqual(plan({ jobs: [...free, member], wf: all(), now: NOW }).start.filter((s) => s.wf === AGENT).map((s) => s.id), ['m1']);
  assert.deepEqual(plan({ jobs: [...free, member, job('h1', 'heal:will.yml', { at: iso(0) })], wf: all(), now: NOW }).start.filter((s) => s.wf === AGENT).map((s) => s.id), ['h1'], 'a repair still goes first');
  assert.deepEqual(plan({ jobs: [member], wf: all({ [AGENT]: { today: 60 } }), now: NOW }).start.map((s) => s.id), ['m1'], 'one run a tick all day');
  assert.equal(FIRST.versus, undefined, 'free jobs keep their score order');
});

test('a coder with no free model calls left is not started (no run spent on "no model answered"); it says until when; the rest go on', () => {
  const jobs = [job('w1', 'will:paint'), job('p1', 'probe:q')];
  const p = plan({ jobs, wf: all({ [AGENT]: { noModel: { until: '2026-10-27T00:00:00.000Z' } } }), now: NOW });
  assert.ok(!p.start.some((s) => s.wf === AGENT));
  assert.ok(p.held.some((h) => h.id === 'w1' && /free model calls until 00:00 UTC/.test(h.why)));
  assert.equal(p.start.find((s) => s.wf === 'propose-fix.yml').id, 'p1');
  const base = { exists: true, busy: false, started: false, paused: false, lastRunMs: NOW - 2 * H, now: NOW };
  assert.equal(lapDue({ ...base, noModel: true }), false, 'no lap either');
});
