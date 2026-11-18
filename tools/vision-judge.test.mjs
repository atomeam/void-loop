import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { surfacesOf, pixelStats, judge, run, LIMITS } from './vision-judge.mjs';

const frame = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y), i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };

test('a change maps to the surfaces it can alter', () => {
  assert.deepEqual(surfacesOf(['void.html', 'void-live-deploy/films/index.html', 'tools/x.mjs', 'void-live-deploy/skills/clock.js']), ['/', '/films/']);
  assert.deepEqual(surfacesOf(['docs/MAP.md']), []);
  assert.equal(surfacesOf(Array.from({ length: 20 }, (_, i) => 'void-live-deploy/p' + i + '/index.html')).length, LIMITS.MAX_SURFACES);
});

test('pixel measures: a soft glow has few hard edges, a hard-edged disk many, a flat frame is blank', () => {
  const W = 120, H = 120, r = (x, y) => Math.hypot(x - 60, y - 60) / 40;
  const soft = pixelStats(frame(W, H, (x, y) => 8 + 120 * Math.max(0, 1 - r(x, y)) ** 4), W, H);
  const hard = pixelStats(frame(W, H, (x, y) => (r(x, y) < 0.25 ? 230 : 8)), W, H);
  assert.ok(soft.hardEdge < LIMITS.HARD_EDGE, JSON.stringify(soft));
  assert.ok(hard.hardEdge > LIMITS.HARD_EDGE, JSON.stringify(hard));
  assert.ok(pixelStats(frame(W, H, () => 5), W, H).offMode < LIMITS.BLANK);
});

test('judge names each failure with the surface, the viewport and the numbers', () => {
  const dom = { errors: ['boom'], scrollX: 40, clipped: ['p.x'], bg: 0.9, media: ['video a.mp4'], chrome: ['a#void-anchor', 'p.offer'] };
  const bad = judge('/', 'mobile', dom, { mean: 0.5, offMode: 0.0001, hardEdge: 0.5 });
  for (const w of ['console/page error', 'sideways scroll', 'clipped text', 'not the dark theme', 'blank render', 'media failed', 'p.offer', 'not near-black', 'hard-edged']) assert.ok(bad.some((b) => b.includes(w) && b.startsWith('/ @ mobile')), w);
  assert.ok(!bad.some((b) => b.includes('a#void-anchor')), 'the corner heart is kept');
  assert.deepEqual(judge('/films/', 'desktop', { errors: [], scrollX: 0, clipped: [], bg: 0.01, media: [], chrome: ['a.x'] }, { mean: 0.5, offMode: 0.2, hardEdge: 0.9 }), []);
});

const chrome = [process.env.VOID_TEST_BROWSER, '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));
test('in a real browser: a white page with an offer on the landing fails; a dark one with only the ask bar passes', { skip: !chrome && 'no Chrome here' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vj-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><body style="margin:0;background:#fff"><p>Buy now $9</p><form id="row"><input placeholder="Ask anything"></form></body>');
  fs.mkdirSync(path.join(dir, 'ok'));
  fs.writeFileSync(path.join(dir, 'ok', 'index.html'), '<!doctype html><body style="margin:0;background:#05070d;color:#ddd"><h1 style="font-size:64px">Tools</h1>' + '<p style="font-size:22px">Plain words about the tools Verse keeps, one line each.</p>'.repeat(8) + '</body>');
  const r = await run({ paths: ['/', '/ok/'], dir });
  const land = r.filter((x) => x.path === '/').flatMap((x) => x.failures), ok = r.filter((x) => x.path === '/ok/').flatMap((x) => x.failures);
  assert.ok(land.some((f) => /not the dark theme/.test(f)) && land.some((f) => /p/.test(f) && /more than the void/.test(f)), land.join('\n'));
  assert.deepEqual(ok, []);
});
