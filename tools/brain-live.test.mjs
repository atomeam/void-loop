// The live brain (docs/brain.md, lib/brain-live.js, functions/api/brain.js): every region is a real part with real numbers, nothing guessed.
// Run: node --test tools/brain-live.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brainOf, chainOf, drivesOf, examOf, REGIONS, FLOW } from '../void-live-deploy/lib/brain-live.js';
const now = Date.parse('2026-11-20T21:00:00Z');
const S = {
  now,
  will: { at: '2026-11-20T20:10:46Z', wants: [{ title: 'teach my self skill "what are you working on"' }], lastRun: { title: 'Overhaul site:email', state: 'set aside' } },
  crew: { open: 10, met: 11, lastRun: { run: 1286, jobs: 1 }, crew: [{ name: 'ExamCoach', did: 'exam: lowest sports 92.6', didAt: now - 6e5 }],
    priorities: { at: now - 5e7, why: 'the evidence moved', bets: [{ title: 'Repair helper/a until it lands', ask: 'Repair helper/a until it lands: x', score: 4 }, { title: 'Fix definitions', ask: 'Fix definitions', score: 3 }] },
    wants: [{ key: 'exam-definitions', title: 'Raise the definitions exam score from 96.7', state: 'open', filed: now - 2 * 864e5, cite: [{ what: 'outcome exam', url: 'https://a-to-mind.com/exam/latest.json' }] }, { key: 'm', title: 'Met one', state: 'met', met: now - 864e5, filed: now - 9 * 864e5, latest: 99 }] },
  status: { overall: 'degraded', guards: [{ name: 'a-to-mind.com', now: 'up', lastAt: '2026-11-20T20:12:18Z' }, { name: 'Main CI', now: 'down', lastAt: '2026-11-20T20:02:00Z' }] },
  selfcheck: { report: { at: '2026-11-20T12:11:46Z', checked: 252, fine: 247, broken: 5 } },
  exam: { at: '2026-11-20T18:48:29Z', domains: { videos: { score: 96.9 }, sports: { score: 92.6 }, weather: { score: 100 } } },
  routes: { today: 200, skill: 120, fallback: 50, simple: 30, close: 7 },
  knows: { counts: { skill: 472, page: 73 }, builtWith: 25 }, knowledge: { count: 61, newest: { at: '2026-11-17T08:25:32Z', retain: 'video-gen depends on /api/clip' } }, skills: { count: 472 },
  voice: [{ at: '2026-11-20T20:09:56Z', kind: 'build', shipped: 'Receipts stay quiet', thoughts: 'The skill index has expanded.' }],
  unbidden: [{ at: '2026-11-20T20:17:59Z', say: 'It bothers me that the browser suite failed.' }],
  lessons: [{ at: '2026-11-20T19:00:00Z', job: 'j1', text: 'Fixing the sports card moved sports from 90 to 92.6: it worked.' }],
  chainRow: { key: 'exam-sports', title: 'Raise the sports exam score', lane: 'exam', label: 'sports exam score', cite: '[{"what":"outcome exam","url":"https://a-to-mind.com/exam/latest.json"}]', baseline: 90, latest: 92.6, wstate: 'met', private: 0, job: 'j1', qstate: 'live', note: 'review by team:x · PR: https://github.com/atomeam/void-loop/pull/3200', updated: '2026-11-20T18:00:00Z' },
};
test('every region of docs/brain.md is drawn, each with a real state, and the flow joins only real regions', () => {
  const b = brainOf(S), ids = REGIONS.map((r) => r.id);
  assert.equal(b.regions.length, 13);
  for (const r of b.regions) assert.ok(r.state.length, r.id + ' has a state');
  for (const [a, c] of FLOW) assert.ok(ids.includes(a) && ids.includes(c));
  const doc = readFileSync(new URL('../docs/brain.md', import.meta.url), 'utf8');
  for (const r of REGIONS) assert.ok(doc.includes('| ' + r.name.replace(' (the will)', '')), 'docs/brain.md names ' + r.name);
  const s = b.regions.find((r) => r.id === 'senses');
  assert.match(s.state[0], /200 asks routed today \(120 to a skill, 50 to the general answer, 7 close calls\)/);
  assert.ok(s.last, 'senses fired');
  assert.match(b.regions.find((r) => r.id === 'attention').state[0], /2 bets this week \(1 of them repairs\)/);
});
test('the chain is the real one, and a missing link says not yet', () => {
  const c = chainOf(S.chainRow, S.lessons);
  assert.equal(c.sense.text, 'outcome exam'); assert.equal(c.sense.value, 90);
  assert.equal(c.pr.url, 'https://github.com/atomeam/void-loop/pull/3200');
  assert.match(c.result.text, /met: sports exam score moved to 92.6/);
  assert.match(c.lesson.text, /it worked/);
  const bare = chainOf({ ...S.chainRow, note: '', wstate: 'open', qstate: 'queued' }, []);
  assert.equal(bare.pr, null); assert.equal(bare.result, null); assert.equal(bare.lesson, null);
  assert.equal(chainOf({ ...S.chainRow, private: 1 }, []).sense.value, null, 'a private want shows no number');
});
test('drives carry measured numbers or say not measured; nothing is guessed', () => {
  const d = Object.fromEntries(drivesOf(S).map((x) => [x.id, x]));
  assert.equal(d.competence.value, examOf(S.exam).mean); assert.equal(examOf(S.exam).mean, 96.5);
  assert.equal(d.integrity.value, 98); assert.equal(d.care.value, 75); assert.equal(d.curiosity.value, 1);
  assert.equal(d.life.value, null);
  const empty = drivesOf({ now });
  for (const x of empty) assert.equal(x.value, null, x.id);
  const b = brainOf({ now });
  assert.match(b.regions[0].state[0], /could not be read just now/);
  assert.match(b.regions.find((r) => r.id === 'sleep').state[0], /has not slept yet/);
});
test('the endpoint reads counts from the route log, never an ask', () => {
  const f = readFileSync(new URL('../void-live-deploy/functions/api/brain.js', import.meta.url), 'utf8');
  const sql = /ROUTES_SQL = "([^"]+)"/.exec(f)[1];
  assert.ok(!/\bask\b/.test(sql), 'no ask column read');
  assert.match(f, /WHAT A STRANGER COULD MAKE THIS DO/);
});
