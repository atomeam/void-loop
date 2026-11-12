import test from 'node:test';
import assert from 'node:assert/strict';
import { plainVerdict, rowsFromMeasures, isFloor, rankSites, verdictsChanged, viewModel, visitorHtml, ownerHtml, TOOLS } from '../void-live-deploy/lib/versus-floor.js';

const full = { speed: 100, reliability: 3, mobile: 0, a11y: 0, offline: 1 };
const slow = { speed: 400, reliability: 3, mobile: 12, a11y: 2, offline: 0 };

test('a verdict is better, equal, or worse, and a missing number is not a verdict', () => {
  assert.equal(plainVerdict(100, 400, false), 'better');
  assert.equal(plainVerdict(400, 100, false), 'worse');
  assert.equal(plainVerdict(3, 3, true), 'equal');
  assert.equal(plainVerdict(1, NaN, true), null);
});

test('rows need a real reading of the other page', () => {
  assert.equal(rowsFromMeasures(full, { ...slow, reliability: 0 }), null);
  const rows = rowsFromMeasures(full, slow);
  assert.equal(rows.speed.verdict, 'better');
  assert.equal(rows.mobile.verdict, 'better');
  assert.equal(rows.offline.verdict, 'better');
});

test('a tool is not a floor, even when every aspect is better or equal', () => {
  const rows = rowsFromMeasures(full, full);
  assert.equal(isFloor(TOOLS[0], rows), false);
  assert.equal(isFloor({ kind: 'page', covers: true }, rows), true);
  assert.equal(isFloor({ kind: 'page', covers: false }, rows), false);
  assert.equal(isFloor({ kind: 'card', covers: true }, rows), false);
  assert.equal(isFloor({ kind: 'page', covers: true }, rowsFromMeasures(slow, full)), false);
});

test('the next site is the one whose features match the gap notes, not the biggest', () => {
  const sites = [
    { id: 'big', features: ['catalogue'], rank: 1 },
    { id: 'small', features: ['letter shift'], rank: 999999 },
  ];
  assert.equal(rankSites(sites, 'weakest exam domain letter shift')[0].id, 'small');
  assert.equal(rankSites(sites, '')[0].id, 'big');
});

test('a run with the same verdicts is not a change', () => {
  const a = { tools: { readable: { speed: { verdict: 'better', verse: 1, best: 2 } } } };
  const b = { tools: { readable: { speed: { verdict: 'better', verse: 9, best: 8 } } } };
  assert.equal(verdictsChanged(a, b), false);
  assert.equal(verdictsChanged(a, { tools: { readable: { speed: { verdict: 'worse', verse: 9, best: 8 } } } }), true);
});

test('visitors get the sign and nothing else; the owner gets the floor, the fight, and the numbers', () => {
  const pub = visitorHtml();
  assert.match(pub, /Out of Order/);
  assert.doesNotMatch(pub, /motherfuckingwebsite|rot13|tsundere|better|worse|equal/);
  const model = viewModel({ tools: { readable: { at: '2026-11-12T00:00:00.000Z', ...rowsFromMeasures(full, slow) } } }, '');
  assert.equal(model.floor, 0);
  const own = ownerHtml(model);
  assert.doesNotMatch(own, /Out of Order/);
  assert.match(own, /motherfuckingwebsite\.com/);
  assert.match(own, /better/);
  assert.match(own, /not measured yet/);
  assert.match(own, /href="\/our-motherfucking-version\/"/);
  assert.doesNotMatch(own, /href="[^"]*(motherfuckingwebsite|rot13|tsundere)/);
  assert.doesNotMatch(own + pub, /\b(grab|steal|absorb|conquer)\b/i);
});
