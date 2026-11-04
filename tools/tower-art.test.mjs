// lib/tower-art.js: the Versus card's flat picture (owner, 2026-11-03: "make the 3d tower on the card 2d but still update with each floor",
// "make the tower look like an epic card picture")
import test from 'node:test';
import assert from 'node:assert/strict';
import { towerArtSvg } from '../void-live-deploy/lib/tower-art.js';

const floors = (beaten) => [...Array.from({ length: beaten }, (_, i) => ({ id: 'b' + i, site: 'site' + i + '.com', state: 'beaten', n: 5, m: 5 })),
  { id: 'ndscalc.ru', site: 'ndscalc.ru', state: 'current', n: 3, m: 12, page: '/calculator/' }, { id: 'next.com', site: 'next.com', state: 'ahead', n: 0, m: 0 }];
const count = (svg, st) => (svg.match(new RegExp('data-art-state="' + st + '"', 'g')) || []).length;

test('one lit floor per site surpassed, the current one glowing on top, nothing ahead drawn; small and static-safe', () => {
  const a = towerArtSvg(floors(2)), b = towerArtSvg(floors(3));
  assert.equal(count(a, 'beaten'), 2); assert.equal(count(b, 'beaten'), 3, 'a site surpassed adds a floor');
  assert.equal(count(a, 'current'), 1); assert.equal(count(a, 'ahead'), 0);
  assert.ok(a.lastIndexOf('data-art-state="current"') > a.lastIndexOf('data-art-state="beaten"'), 'the current floor is the top one');
  assert.match(a, /Now: ndscalc\.ru · 3 of 12 · 2 surpassed/);
  assert.match(a, /prefers-reduced-motion/); assert.ok(a.length < 16000, 'a few KB: ' + a.length);
  assert.equal(towerArtSvg(floors(2)), a, 'the same tower draws the same picture');
  assert.doesNotMatch(towerArtSvg([{ id: 'x', site: '<b>', state: 'current', n: 0, m: 1 }]), /<b>/);
});
