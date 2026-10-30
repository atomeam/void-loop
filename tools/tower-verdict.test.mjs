// node --test tools/tower-verdict.test.mjs: the scout's aspect verdicts (tools/tower-verdict.mjs).
import test from 'node:test'; import assert from 'node:assert/strict';
import { verdicts, cleanReport } from './tower-verdict.mjs';
import { FLOORS, gate } from '../void-live-deploy/lib/tower.js';
const calc = FLOORS[0], at = '2026-10-23T23:00:00Z';
test('a pass is signed and counts; a measured row is never overwritten by a vote', () => {
  const prev = { speed: { verdict: 'worse', verse: 3341, best: 908, evidence: 'measured' }, accessibility: { verdict: 'better', verse: 0, best: 6, evidence: 'measured' } };
  const r = verdicts(calc, prev, { pass: ['design polish', 'history', 'speed'] }, 'argon', 'compared on the live sites', at);
  assert.deepEqual(r.skipped, ['speed']); assert.equal(r.rows.speed.verdict, 'worse');
  assert.equal(r.rows.history.verdict, 'better'); assert.match(r.rows.history.evidence, /^verified by argon on 2026-10-23: compared/);
  assert.equal(gate(calc, r.rows).n, 3);
});
test('a pass must be an aspect of the floor; a lost aspect may be new, and keeps what it was', () => {
  assert.deepEqual(verdicts(calc, {}, { pass: ['vibes'] }, 'argon', 'x', at).unknown, ['vibes']);
  const r = verdicts(calc, { history: { verdict: 'better', evidence: 'e' } }, { lost: ['history', 'voice input'] }, 'argon', 'they added it', at);
  assert.deepEqual(r.unknown, []); assert.equal(r.rows.history.was, 'better'); assert.equal(r.rows['voice input'].verdict, 'worse');
});
test('the report is one line of at most 200 characters', () => { assert.equal(cleanReport(' a\\n b '.replace('\\n', '\n')), 'a b'); assert.equal(cleanReport('x'.repeat(300)).length, 200); assert.equal(cleanReport(''), null); });
test('a person can sign a floor beaten: every aspect passes, and keeps what it was', async () => {
  const { called } = await import('./tower-verdict.mjs');
  const rows = called(calc, { speed: { verdict: 'worse', verse: 3341, best: 908, evidence: 'm' } }, 'argon', 'owner\'s call', at);
  assert.equal(gate(calc, rows).beaten, true); assert.equal(rows.speed.was, 'worse');
});
test('a row Verse awarded itself never counts, whoever writes it (taken back 2026-10-24)', async () => {
  const { selfCalled } = await import('../void-live-deploy/lib/tower.js');
  const self = { verdict: 'better', called: true, evidence: 'called beaten by verse on 2026-10-24: Verse\'s own calc skill answered' };
  assert.equal(selfCalled(self), true); assert.equal(selfCalled({ verdict: 'better', called: true, evidence: 'called beaten by argon: owner\'s call' }), false);
  const rows = Object.fromEntries(gate(calc, {}).left.map((a) => [a, self]));
  assert.equal(gate(calc, rows).n, 0); assert.equal(gate(calc, rows).beaten, false);
});
