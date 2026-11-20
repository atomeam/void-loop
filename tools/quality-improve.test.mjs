import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Q from '../void-live-deploy/lib/quality.js';
import { IMPROVERS, HANDS_OFF, candidates } from './quality-improve.mjs';
test('the shared fixes apply, undo cleanly, and never touch the home, the games or the labs', () => {
  const html = '<!doctype html><html><head><title>x</title></head><body><main>hi</main></body></html>';
  for (const id of ['scene3d', 'polish']) { const I = IMPROVERS[id], next = I.apply(html); assert.ok(next.includes(I.signature)); assert.equal(I.undo(next), html); assert.equal(I.applies({}, next, '/p/'), false); }
  for (const r of ['/', '/games/x/', '/arcade/', '/lab/y/', '/echo-vault/']) assert.ok(HANDS_OFF.test(r), r);
  const row = { score: { weakest: [{ id: 'graphics' }, { id: 'motion' }] } };
  assert.deepEqual(candidates(row, html, '/p/', null, {}, Q.rankImprovers), ['scene3d', 'polish']);
  assert.deepEqual(candidates(row, html, '/games/x/', null, {}, Q.rankImprovers), []);
  const d = { fail: { contrast: [{ sel: 'p', fg: { r: 90, g: 90, b: 90, a: 1 }, bg: { r: 0, g: 0, b: 0, a: 1 }, need: 4.5, text: 'x' }], targets: [], bare: { unstyled: [], empty: [] } } };
  const withDesign = IMPROVERS.design.apply(html, d); assert.ok(withDesign.includes('verse design loop')); assert.equal(IMPROVERS.design.undo(withDesign).replace(/\s+/g, ''), html.replace(/\s+/g, ''));
});
test('the scene and polish files exist, stay behind the page and respect reduced motion', () => {
  const scene = fs.readFileSync(new URL('../void-live-deploy/lib/verse-scene.js', import.meta.url), 'utf8'), css = fs.readFileSync(new URL('../void-live-deploy/lib/verse-polish.css', import.meta.url), 'utf8');
  assert.match(scene, /pointer-events:none/); assert.match(scene, /prefers-reduced-motion/); assert.match(scene, /saveData/); assert.match(scene, /webgl2/); assert.match(scene, /drawArraysInstanced/); assert.match(scene, /\^\\\/\$/);
  assert.match(css, /prefers-reduced-motion: reduce/); assert.match(css, /:focus-visible/);
});
test('blub draws its own 3D, so the shared backdrop is never added to it', () => { assert.equal(IMPROVERS.scene3d.applies({}, '<html><head></head><body><canvas id="blub"></canvas></body></html>', '/blub/'), false); });
