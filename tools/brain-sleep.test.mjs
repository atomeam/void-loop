// Sleep (lib/brain-sleep.js; GET /api/brain sleeps when due; the hourly will run wakes it). Run: node --test tools/brain-sleep.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sleepNote, consolidate, due, sleepIfDue, SLEEP_GAP_MS, LESSON_MIN } from '../void-live-deploy/lib/brain-sleep.js';
const now = Date.parse('2026-11-21T08:30:00Z'), h = 36e5;
test('it sleeps when the last note is 20 hours old, or there is none', () => {
  assert.equal(due(null, now), true);
  assert.equal(due({ at: new Date(now - SLEEP_GAP_MS + h).toISOString() }, now), false);
  assert.equal(due({ at: new Date(now - SLEEP_GAP_MS).toISOString() }, now), true);
});
test('the night note counts the last day only, and names tomorrow\'s focus', () => {
  const S = { now, routes: { today: 120, close: 4 },
    crew: { wants: [{ title: 'Raise sports', state: 'met', met: now - 2 * h }, { title: 'Old met', state: 'met', met: now - 50 * h }, { title: 'Stuck', state: 'set aside' }],
      priorities: { bets: [{ title: 'Fix definitions' }] } },
    voice: [{ at: new Date(now - h).toISOString() }, { at: new Date(now - 30 * h).toISOString() }], unbidden: [{ at: new Date(now - 3 * h).toISOString() }],
    lessons: [{ at: new Date(now - h).toISOString(), kind: 'reopened', text: 'did not move' }, { at: new Date(now - h).toISOString(), kind: 'met', text: 'worked' }] };
  const n = sleepNote(S);
  assert.equal(n.summary, 'In the last day: 120 asks routed (4 close calls), 1 want met, 1 want reopened, 1 want set aside in all, 1 reflection, 1 line said on its own, 2 new lessons.');
  assert.equal(n.focus, 'Bet 1: Fix definitions'); assert.deepEqual(n.met, ['Raise sports']);
  assert.equal(sleepNote({ now, exam: { domains: { sports: { score: 92.6 }, videos: { score: 97 } } } }).focus, 'Raise the sports exam area from 92.6');
  assert.match(sleepNote({ now }).summary, /0 wants met/);
});
test('consolidation merges duplicate lessons and drops the old tail past the newest ones', () => {
  const old = new Date(now - 40 * 864e5).toISOString();
  const L = [...Array.from({ length: LESSON_MIN + 3 }, (_, i) => ({ id: 'l' + i, at: i < LESSON_MIN ? new Date(now).toISOString() : old })), { id: 'l0', at: old }];
  const c = consolidate(L, now);
  assert.equal(c.merged, 1); assert.equal(c.dropped, 3); assert.equal(c.lessons.length, LESSON_MIN);
});
test('the hourly will run wakes the sleep check, so a night is never skipped for want of a viewer', () => {
  const w = readFileSync(new URL('../void-live-deploy/functions/api/will.js', import.meta.url), 'utf8');
  assert.match(w, /waitUntil\(import\('\.\/brain\.js'\)\.then\(\(m\) => m\.readBrain\(request, env\)\)/);
});

test('sleepIfDue claims the night once, keeps the log and the consolidated lessons in one batch', async () => {
  const kv = {}, batches = [];
  const DB = { prepare: (q) => ({ bind: (...a) => ({ a, run: async () => { const prev = kv[a[0]] ? JSON.parse(kv[a[0]]).at : null; if (prev !== a[2]) return { meta: { changes: 0 } }; kv[a[0]] = a[1]; return { meta: { changes: 1 } }; } }) }), batch: async (b) => { batches.push(b.map((x) => x.a[0])); for (const x of b) kv[x.a[0]] = x.a[1]; } };
  const now = Date.parse('2026-11-21T08:30:00Z'), S = { now, crew: { wants: [] }, routes: { today: 3, close: 1 }, lessons: [], voice: [], unbidden: [], last: null, log: [] };
  const note = await sleepIfDue({ DB }, S);
  assert.ok(note && /3 asks routed/.test(note.summary));
  assert.deepEqual(batches, [['sleep-log', 'lessons']]);
  assert.equal(await sleepIfDue({ DB }, { ...S, last: null }), null, 'a second viewer with a stale read does not sleep again');
  assert.equal(await sleepIfDue({ DB }, { ...S, last: note }), null, 'not due');
});
