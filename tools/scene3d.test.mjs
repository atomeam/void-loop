// The shared 3D engine's pure parts (skills/scene3d.js): the quality governor's decision, and the detail asks (skills/figures.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { governStep, QUALITY_STEPS, REGRESS_DPR, MAX_DPR } from '../void-live-deploy/skills/scene3d.js';
import { figuresOf, detailAsk, DETAIL_KEY } from '../void-live-deploy/skills/figures.js';
import { DETAIL_KEY as ENGINE_KEY } from '../void-live-deploy/skills/scene3d.js';

const T = 1000 / 60, last = QUALITY_STEPS.length - 1;
const late = { ema: T * 1.5, n: 25, good: 0 }, fine = { ema: T, n: 25, good: 0 };

test('late frames step the pixel ratio down one step at a time, and only after 20 frames', () => {
  assert.deepEqual(governStep({ ...late, at: 0, low: false, canLow: true }, T), { ...late, at: 1, low: false, canLow: true, n: 0, good: 0 });
  assert.equal(governStep({ ...late, at: 0, n: 10, low: false, canLow: true }, T).at, 0, 'too few frames yet');
  assert.equal(governStep({ ...late, at: 1, low: false, canLow: true }, T).at, 2);
});
test('past the last pixel step a device that still runs late goes low-poly in auto mode, never when the person chose full or low', () => {
  const r = governStep({ ...late, at: last, low: false, canLow: true }, T);
  assert.equal(r.at, last); assert.equal(r.low, true); assert.equal(r.n, 0);
  const held = governStep({ ...late, at: last, low: false, canLow: false }, T);
  assert.equal(held.low, false); assert.equal(held.at, last);
  assert.equal(governStep({ ...late, at: last, low: true, canLow: true }, T).low, true, 'already there: nothing more to give');
});
test('keeping up for 180 frames climbs back, low-poly first and then the pixel steps, and a late frame resets the count', () => {
  let s = { ...fine, at: last, low: true, canLow: true, good: 180 };
  s = governStep(s, T); assert.equal(s.low, false); assert.equal(s.at, last); assert.equal(s.good, 0);
  s = governStep({ ...s, ema: T, good: 180 }, T); assert.equal(s.at, last - 1);
  assert.equal(governStep({ ...fine, at: 2, low: false, canLow: true, good: 50 }, T).good, 51, 'counting');
  assert.equal(governStep({ ...fine, ema: T * 1.2, at: 2, low: false, canLow: true, good: 50 }, T).good, 0, 'neither late nor fast: the count restarts');
  assert.equal(governStep({ ...fine, at: 0, low: false, canLow: true, good: 500 }, T).good, 0, 'nothing to climb to at full');
});
test('the engine constants the asks and the tests lean on', () => {
  assert.equal(REGRESS_DPR, 1); assert.ok(MAX_DPR > REGRESS_DPR); assert.equal(QUALITY_STEPS[0], 1);
  assert.equal(DETAIL_KEY, ENGINE_KEY, 'figures.js writes the key scene3d.js reads');
});
test('"low poly 3d", "full 3d" and "auto 3d" set the detail; look-alikes are left alone', () => {
  for (const t of ['low poly 3d', 'low-poly', 'Low poly mode', 'lighter 3d', 'simple 3d', '3d low', 'switch to low poly 3d', 'use low poly figures']) assert.equal(detailAsk(t), 'low', t);
  for (const t of ['full 3d', 'full detail', 'high poly', 'detailed 3d', '3d full detail', 'turn on full detail 3d']) assert.equal(detailAsk(t), 'full', t);
  for (const t of ['auto 3d', '3d auto', 'automatic 3d detail', 'let 3d decide']) assert.equal(detailAsk(t), 'auto', t);
  for (const t of ['what is low poly', 'low poly art history', 'make a 3d model', 'full moon', 'how full is the moon', '3d printer', 'poly']) assert.equal(detailAsk(t), null, t);
  assert.deepEqual(figuresOf('low poly 3d'), { act: 'detail', mode: 'low' });
  assert.deepEqual(figuresOf('full 3d!'), { act: 'detail', mode: 'full' });
  assert.equal(figuresOf('what is low poly'), null);
});
