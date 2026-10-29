// Remediation velocity (asked by Verse): how long a failing skill took to be proven again, from the history of families.json. node --test tools/remediation-velocity.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { stateOf, velocityOf } from './remediation-velocity.mjs';
import { velocityHtml } from '../void-live-deploy/skills/remediation-velocity.js';
import skill from '../void-live-deploy/skills/remediation-velocity.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fam = (...skills) => ({ families: [{ id: 'a', skills }] });
const day = (n) => new Date(Date.UTC(2026, 9, 10 + n)).toISOString();
const snap = (n, ...skills) => ({ at: day(n), state: stateOf(fam(...skills)) });
test('a skill is failing when its benchmark rate is under 100% or its daily test found something, and not proven', () => {
  const s = stateOf(fam({ name: 'a', tier: 'checked', success_rate: 0.5 }, { name: 'b', tier: 'proven', success_rate: 1 }, { name: 'c', tier: 'tested', smoke: ['x'] }, { name: 'd', tier: 'tested' }, null, { tier: 'proven' }));
  assert.deepEqual(s, { a: { proven: false, failing: true }, b: { proven: true, failing: false }, c: { proven: false, failing: true }, d: { proven: false, failing: false } });
});
test('the days from the first failing snapshot to the first proven one, still-missing skills counted from when they began', () => {
  const v = velocityOf([
    snap(0, { name: 'x', tier: 'tested', success_rate: 0.8 }, { name: 'y', tier: 'proven', success_rate: 1 }),
    snap(1, { name: 'x', tier: 'tested', success_rate: 0.9 }, { name: 'y', tier: 'checked', success_rate: 0.9 }),
    snap(4, { name: 'x', tier: 'proven', success_rate: 1 }, { name: 'y', tier: 'checked', success_rate: 0.95 }),
  ], Date.parse(day(6)));
  assert.deepEqual(v.converted.map((c) => [c.skill, c.days]), [['x', 4]]); assert.equal(v.convertedTotal, 1); assert.equal(v.medianDays, 4);
  assert.deepEqual(v.open, [{ skill: 'y', sinceDays: 5 }]); assert.equal(v.windowDays, 6);
  const none = velocityOf([], Date.parse(day(0))); assert.deepEqual([none.convertedTotal, none.medianDays, none.open], [0, null, []]);
});
test('the card says what it read, escapes names, and says plainly when nothing could be read', () => {
  const v = { windowDays: 5.2, convertedTotal: 1, medianDays: 4, converted: [{ skill: 'x<b>', days: 4 }], openTotal: 1, open: [{ skill: 'y', sinceDays: 0.8 }] };
  const h = velocityHtml(v, esc); assert.ok(!h.includes('x<b>')); assert.match(h, /x&lt;b&gt;/); assert.match(h, /1 misses turned back into proven in the last 5 days · typical: 4 days · 1 still missing/); assert.match(h, /failing for under a day/);
  assert.match(velocityHtml(null, esc), /could not read/); assert.match(velocityHtml({ ...v, converted: [], convertedTotal: 0, medianDays: null }, esc), /No skill has gone from failing to proven yet/);
});
test('the skill takes its asks and leaves look-alikes alone', () => {
  for (const a of ['how fast do you fix your misses', 'remediation velocity', 'how quickly do you fix a miss', "what is verse's remediation velocity"]) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of ['how fast is your internet', 'what is velocity', 'fix my automation', 'how fast do you run']) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
