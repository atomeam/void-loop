// Home stage stays a blank void: no HUD telemetry readout overlapping the ask bar,
// no unrequested center mesh on the idle starfield. Static source assertions (fast, no
// browser): the offending overlay was generated entirely by void-live-deploy/lib/void-cosmos.js,
// so its absence from the sources is the guarantee. Geometry note: the removed node sat at
// bottom:88px (76px on phones) over the ask bar with z-index 6; with the node gone there is
// nothing left that can cover #input.
//   node --test tools/home-stage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const lib = () => read('void-live-deploy/lib/void-cosmos.js');

test('no HUD telemetry node anywhere: not in the engine, not in either page copy', () => {
  assert.ok(!lib().includes('void-cosmos-tlm'), 'the overlay div is gone from the engine');
  assert.ok(!lib().includes('tlm.textContent'), 'no per-frame telemetry write remains');
  for (const page of ['void-live-deploy/void.html', 'void-live-deploy/index.html']) {
    assert.ok(!read(page).includes('void-cosmos-tlm'), 'no telemetry node in ' + page);
  }
});

test('no unrequested center mesh: the star points are the only fullscreen draw', () => {
  const src = lib();
  assert.ok(!src.includes('ro=vec3(0,0,-3.2)'), 'no raymarched center sphere');
  assert.ok(!src.includes('euFade'), 'no planet-program uniforms left');
  assert.ok(!src.includes('[-1, -1, 3, -1, -1, 3]'), 'no fullscreen-quad buffer for a second pass');
  assert.ok(!/const E = prog\(/.test(src), 'no second shader program besides the star points');
  const mounts = [...src.matchAll(/document\.createElement\('(\w+)'\)/g)].map((m) => m[1]).sort().join(',');
  assert.equal(mounts, 'canvas,div,style', 'mount creates only the canvas, its style, and the hud pill: ' + mounts);
});

test('the ask bar stands alone: #input is there and nothing telemetry-flavored covers it', () => {
  const html = read('void-live-deploy/void.html');
  assert.match(html, /<input[^>]*id="input"[^>]*placeholder="Ask anything"/, 'the ask input is present');
  assert.ok(!/id="[^"]*(tlm|telemetry-hud|hud-readout)[^"]*"/.test(html), 'no overlay ids near the ask bar');
});

test('the telemetry formatter itself survives as a pure function (the engine still exports it)', () => {
  assert.match(lib(), /export function telemetry\(c\)/, 'telemetry() stays exported and tested by void-cosmos.test.mjs');
});
