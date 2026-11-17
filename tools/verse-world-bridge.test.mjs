// The shared game-world bridge: run summaries, exported cards and the wave field.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSummary, summarySvg, drift, blend } from '../void-live-deploy/lib/verse-world-bridge.js';

test('a run summary carries the game, its depth, relics and seed', () => {
  const s = runSummary('Voidspire Descent', { depth: 4, relics: ['spark', 'ward'], seed: 12345, note: 'The choir is quiet.' });
  assert.match(s.title, /Voidspire Descent/);
  assert.match(s.text, /Depth 4 · 2 relics/);
  assert.match(s.text, /The choir is quiet/);
  assert.equal(s.number, 'SEED 12345');
});

test('a run summary exports through the same card painter as every other card', () => {
  const svg = summarySvg(runSummary('Pong', { depth: 2, seed: 7 }));
  assert.match(svg, /^<svg/);
  assert.match(svg, /Pong run/);
  assert.ok(svg.length > 1000);
});

test('the shared wave field stays bounded and the blend stays between its inputs', () => {
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) { const v = drift(x, y, x / 7); assert.ok(v >= -1 && v <= 1); }
  assert.equal(blend(2, 4, -1), 2);
  assert.equal(blend(2, 4, 2), 4);
  assert.equal(blend(2, 4, 0.5), 3);
});
