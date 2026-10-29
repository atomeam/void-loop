// Which families push the growth score up or down (lib/better.js familyDrivers, skills/family-health.js driversHtml). Run: node --test tools/family-drivers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { familyDrivers } from '../void-live-deploy/lib/better.js';
import { driversHtml } from '../void-live-deploy/skills/family-health.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fam = { families: [
  { id: 'a', name: 'Al<pha>', skills: [{ name: 'p1', tier: 'proven' }, { name: 'p2', tier: 'proven' }] },
  { id: 'b', name: 'Beta', skills: [{ name: 'e1', tier: 'experiment' }, { name: 'f1', tier: 'checked', failing: ['an ask'] }] },
  { id: 'c', name: 'Gamma', skills: [{ name: 'c1', tier: 'checked' }, { name: 't1', tier: 'tested' }] },
] };
test('lifts sum to zero, the clean family lifts and the failing one drags, ordered', () => {
  const d = familyDrivers(fam);
  assert.equal(d.length, 3); assert.ok(Math.abs(d.reduce((n, x) => n + x.lift, 0)) < 0.2);
  assert.equal(d[0].id, 'a'); assert.ok(d[0].lift > 0 && d[0].points > 0); assert.equal(d[2].id, 'b'); assert.ok(d[2].lift < 0);
  assert.equal(d[2].health, 25); assert.equal(d[0].health, 100);
  assert.ok(Math.abs(d[0].points - d[0].lift / 5) < 0.01, 'a fifth of the lift, one of five parts');
  assert.ok(Math.abs(familyDrivers(fam, 4)[0].points - d[0].lift / 4) < 0.01);
  assert.deepEqual(familyDrivers(null), []); assert.deepEqual(familyDrivers({ families: [{ id: 'x', skills: [] }] }), []);
});
test('the card block names both ends, escaped, with the score when a row is given', () => {
  const h = driversHtml(esc, fam, [{ at: '2026-10-16', score: 75, parts: { self: 1, asks: 2, friction: 3, bench: 4, probes: 5 } }]);
  assert.ok(h.includes('Lifting it') && h.includes('Dragging it') && h.includes('Al&lt;pha&gt;') && !h.includes('Al<pha>') && h.includes('(75 of 100)'));
  assert.match(h, /data-driver="a" data-points="[0-9.]+"/); assert.match(h, /−/);
  assert.equal(driversHtml(esc, null), '');
});
