// The router's tie-break (lib/clef.js closeCall, tieBreak; functions/api/answer.js): a close call goes to Clef, which runs beside the router.
// Run: node --test tools/router-tie.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closeCall, tieBreak, TIE_BAND, skillQuestion } from '../void-live-deploy/lib/clef.js';
const near = (skill, score, held = 'too-close-to-non-skill') => ({ kind: 'simple', score: 0, scores: {}, nearest: { skill, score, bar: 0.7, held } });
test('"what are you working on": within 0.01 of the self skill, Clef says self, so it is the self skill', () => {
  const r = tieBreak(near('self', 0.69), { kind: 'skill', skill: 'self', p: 0.83 });
  assert.equal(r.kind, 'skill'); assert.equal(r.skill, 'self'); assert.equal(r.by, 'tie-break');
  assert.match(skillQuestion().skill.criteria.self, /working on/);
});
test('a router timeout is broken only toward Verse\'s own card', () => {
  assert.equal(closeCall({ kind: 'fallback', why: 'timeout' }), 'any');
  assert.equal(tieBreak({ kind: 'fallback', why: 'timeout' }, { kind: 'skill', skill: 'self', p: 0.9 }).skill, 'self');
  assert.equal(tieBreak({ kind: 'fallback', why: 'timeout' }, { kind: 'skill', skill: 'timer', p: 0.9 }).kind, 'fallback');
});
test('no tie-break when it is not close, when Clef disagrees, is unsure, says none, or the ask has hard signs', () => {
  assert.equal(closeCall(near('self', 0.7 - TIE_BAND - 0.01)), null);
  assert.equal(tieBreak(near('self', 0.69), { kind: 'skill', skill: 'timer', p: 0.9 }).kind, 'simple');
  assert.equal(tieBreak(near('self', 0.69), { kind: 'skill', skill: 'self', p: 0.4 }).kind, 'simple');
  assert.equal(tieBreak(near('self', 0.69), { kind: 'none', skill: null, p: 0.9 }).kind, 'simple');
  assert.equal(tieBreak(near('self', 0.69, 'hard-signs'), { kind: 'skill', skill: 'self', p: 0.9 }).kind, 'simple');
  const sure = { kind: 'skill', skill: 'clock', score: 0.9 };
  assert.equal(tieBreak(sure, { kind: 'skill', skill: 'self', p: 0.99 }), sure);
});
test('the answer path breaks close calls, logs them, and says so in the reply', () => {
  const a = readFileSync(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url), 'utf8');
  assert.match(a, /if \(clefOn\(env\) && closeCall\(route\)\) route = tieBreak\(route, await clefP/);
  assert.match(a, /tie-break: Clef chose/);
  assert.match(a, /route\.by === 'tie-break' \? \{ tie: 'clef' \}/);
});
