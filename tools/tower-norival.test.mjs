// the gate never opens a site whose robots.txt asks robots to stay away (owner, 2026-10-28: skip opening vcalc.com in gate runs), and the formula
// calculators floor it leaves is judged on Verse's own numbers and stays not beaten while the library is short of the count vcalc.com publishes
import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, answer, pictureOf } from './tower-gate.mjs';
import { PROBES, score, libraryCount } from './tower-probes.mjs';
import { FLOORS, aspectsOf, noRivalOf, noRivalUrl, gate, passingRows } from '../void-live-deploy/lib/tower.js';
import { CALCULATORS } from '../void-live-deploy/lib/calculators.js';

const F = FLOORS.find((f) => f.id === 'formula calculators');

test('noRival: vcalc.com is never opened, any address on it, and other sites are', () => {
  assert.match(noRivalOf(F), /robots\.txt/);
  for (const u of ['https://www.vcalc.com/', 'https://vcalc.com/wiki/vCalc/Circle+-+Area', 'http://WWW.VCALC.COM/x?y=1']) assert.equal(noRivalUrl(u), true, u);
  for (const u of ['https://a-to-mind.com/calculators/', 'https://notvcalc.com/', 'https://www.calculator.net/']) assert.equal(noRivalUrl(u), false, u);
  assert.equal(noRivalOf(FLOORS.find((f) => f.id !== 'formula calculators' && !f.noRival)), '');
});

test('the gate refuses to load a noRival site before it touches a browser', async () => {
  const browser = { newContext: () => { throw new Error('a browser was opened'); } };
  await assert.rejects(measure(browser, 'https://www.vcalc.com/', 't', null, null), /never opens vcalc\.com/);
  await assert.rejects(answer(browser, 'https://www.vcalc.com/wiki/x', null), /never opens vcalc\.com/);
  await assert.rejects(pictureOf(browser, 'https://vcalc.com/'), /never opens vcalc\.com/);
});

test('library size: an aspect of the floor, held to the count vcalc.com publishes, with the gap in its label', () => {
  assert.ok(aspectsOf(F).includes('library size'));
  assert.equal(F.rivalCount.n, 15000); assert.match(F.rivalCount.source, /^https:\/\/www\.vcalc\.com\/features\//);
  const items = PROBES['formula calculators'].askParts['library size'];
  assert.equal(libraryCount('All calculators (164)'), 164); assert.equal(libraryCount('All calculators (15,000)'), 15000); assert.equal(libraryCount('nothing'), 0);
  assert.equal(score('All calculators (' + CALCULATORS.length + ')', items).n, CALCULATORS.length >= 15000 ? 1 : 0);
  assert.equal(score('All calculators (15000)', items).n, 1);
  assert.match(items[0][0], new RegExp('Verse has ' + CALCULATORS.length + ': ' + (15000 - CALCULATORS.length).toLocaleString('en-US') + ' short'));
});

test('not beaten while short: every other aspect passing still leaves library size open', () => {
  // every other aspect passing, the floor's journeys included (passingRows: scripted steps and negative controls, docs/GATE-STANDARDS.md)
  const ev = passingRows(F, { evidence: 'x' }); ev['library size'] = { verdict: 'worse', evidence: 'x' };
  const g = gate(F, ev);
  assert.equal(g.beaten, false); assert.deepEqual(g.left, ['library size']);
});
