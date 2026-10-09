// Void learns by itself (void-live-deploy/lib/learn.js, tools/learn.mjs): misses become builder jobs, and only the right
// ones. node --test tools/learn.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { learnable, plan, jobOf, targetOf, learnFromMiss, queueMiss, OPEN_MAX, MIN_COUNT } from '../void-live-deploy/lib/learn.js';

const now = Date.parse('2026-10-09T18:00:00Z');
const d = (daysAgo) => new Date(now - daysAgo * 864e5).toISOString();
const row = (ask, count = 1, daysAgo = 1, fallback = 'answer', variants = []) => ({ ask, count, last: d(daysAgo), first: d(daysAgo + 1), fallback, variants });

test('a short ask a person typed is learnable; noise, pasted transcripts and secrets are not', () => {
  assert.equal(learnable(row('play sorry', 2, 0, 'game not built yet: Sorry!')).ask, 'play sorry');
  assert.equal(learnable(row('asdfghjkl qwerty')), null, 'keyboard mash');
  assert.equal(learnable(row('zz kv write probe 7', 1, 1, 'test')), null, 'test traffic');
  assert.equal(learnable(row('thought · 717ms ⏎ i don\'t have a will that chooses goals for itself')), null, 'agent chatter');
  assert.equal(learnable(row('ci on dcc0518 is still running, so meanwhile i will prepare the canon file locally to include in the pr')), null, 'too long to be an ask');
  assert.equal(learnable(row('unlock abcdef1234567890abcdef')), null, 'a key never becomes a job');
  assert.equal(learnable(row('email me at someone@example.com')).ask, 'email me at [email]', 'redacted, still learnable');
});

test('the most-asked, most recent misses are queued first, up to the open limit', () => {
  const rows = [row('what time is it', 2, 6), row('play sorry', 2, 0, 'game not built yet: Sorry!', ['play sorry!']), row('connect 4', 2, 6), row('a figure that sits on the chair', 1, 1), row('weather in lakeland', 2, 6, 'skill:weather')];
  const p = plan(rows, { items: [] }, { now });
  assert.equal(p.open, 0);
  assert.equal(p.queue.length, OPEN_MAX);
  assert.equal(p.queue[0].ask, 'play sorry', 'asked twice, today, two phrasings, and Void said it is not built yet');
  assert.ok(p.later.length >= 1, 'the rest wait for the next run');
  assert.equal(p.queue.map((c) => c.target).every((t) => t.startsWith('miss:') && t.length <= 40), true);
});

test('open miss jobs take up the room; built, queued and benched asks are skipped', () => {
  const rows = [row('play sorry', 3, 0), row('connect 4', 2, 1), row('clear calendar', 1, 1)];
  const queue = { items: [
    { id: 'a', ask: 'learn to handle "connect 4"', target: targetOf('connect 4'), state: 'live' },
    { id: 'b', ask: 'something else', target: 'miss:other', state: 'building' },
    { id: 'c', ask: 'older', target: 'miss:older', state: 'queued' },
  ] };
  const p = plan(rows, queue, { now, known: new Set(['clear calendar']) });
  assert.equal(p.open, 2);
  assert.equal(p.room, OPEN_MAX - 2);
  assert.deepEqual(p.queue.map((c) => c.ask), ['play sorry']);
  assert.deepEqual(p.skipped.map((s) => s.ask).sort(), ['clear calendar', 'connect 4']);
});

test('no room, nothing queued; misses older than the window are left alone', () => {
  const full = { items: Array.from({ length: OPEN_MAX }, (_, i) => ({ id: String(i), ask: 'x', target: 'miss:x' + i, state: 'queued' })) };
  assert.equal(plan([row('play sorry', 5, 0)], full, { now }).queue.length, 0);
  assert.equal(plan([row('play sorry', 5, 20)], { items: [] }, { now }).queue.length, 0);
});

test('the job tells the builder what was asked, how often, and where it came from, in under 300 chars', () => {
  const c = plan([row('play sorry', 2, 0, 'game not built yet: Sorry!', ['play sorry!'])], { items: [] }, { now }).queue[0];
  const j = jobOf(c);
  assert.equal(j.ask, 'learn to handle "play sorry"');
  assert.equal(j.target, 'miss:play-sorry');
  assert.match(j.note, /asked 2× \(2 phrasings\), last 2026-10-09; fallback game not built yet: Sorry!/);
  assert.ok(j.note.length <= 300 && j.ask.length <= 200);
});

// a tiny D1 stand-in: enough of prepare().bind().first()/run() for lib/learn.js's two queries and one insert
function fakeDB(rows = []) {
  const q = (sql, args) => ({
    first: async (col) => {
      if (/COUNT\(\*\)/.test(sql)) { const n = rows.filter((r) => /^miss:/.test(r.target) && /^(queued|building)$/.test(r.state)).length; return col ? n : { n }; }
      if (/WHERE target = \?/.test(sql)) return rows.find((r) => r.target === args[0]) || null;
      throw new Error('unexpected query: ' + sql);
    },
    run: async () => { if (/INSERT INTO void_queue/.test(sql)) rows.push({ id: args[0], ask: args[1], target: args[2], state: args[3], note: args[4], at: args[5] }); return { meta: { changes: 1 } }; },
  });
  return { rows, DB: { prepare: (sql) => ({ bind: (...args) => q(sql, args), ...q(sql, []) }) } };
}

test('at miss time: the second miss of an ask queues it, the first does not, and never twice', async () => {
  const db = fakeDB();
  assert.equal(await learnFromMiss(db, row('play back to start', 1, 0)), null, 'once is not a pattern');
  const id = await learnFromMiss(db, row('play back to start', MIN_COUNT, 0));
  assert.ok(id, 'twice is');
  assert.deepEqual(db.rows.map((r) => [r.ask, r.target, r.state]), [['learn to handle "play back to start"', 'miss:play-back-to-start', 'queued']]);
  assert.equal(await learnFromMiss(db, row('play back to start', 3, 0)), null, 'already a job');
  assert.equal(await learnFromMiss(db, row('asdfghjkl qwerty', 9, 0)), null, 'mash never becomes a job');
});

test('at miss time: what Void itself says is not built yet is queued on the first miss, until the room is full', async () => {
  const db = fakeDB();
  assert.ok(await learnFromMiss(db, row('play sorry', 1, 0, 'game not built yet: Sorry!')));
  assert.ok(await learnFromMiss(db, row('play aggravation', 1, 0, 'game not built yet: Aggravation')));
  assert.ok(await learnFromMiss(db, row('play ludo', 1, 0, 'game not built yet: Ludo')));
  assert.equal(db.rows.length, OPEN_MAX);
  assert.equal(await queueMiss(db, learnable(row('play star marbles', 4, 0))), null, 'room is full: the sweep or the next miss after a job closes gets it');
  db.rows[0].state = 'live';
  assert.ok(await learnFromMiss(db, row('play star marbles', 4, 0)), 'a job closed, so there is room again');
});
