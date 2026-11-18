import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { surfacesOf, liveSurfacesOf, redirectDestOf, pixelStats, judge, run, LIMITS } from './vision-judge.mjs';

const frame = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y), i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };

test('a change maps to the surfaces it can alter', () => {
  assert.deepEqual(surfacesOf(['void.html', 'void-live-deploy/films/index.html', 'tools/x.mjs', 'void-live-deploy/skills/clock.js']), ['/', '/films/']);
  assert.deepEqual(surfacesOf(['docs/MAP.md']), []);
  assert.equal(surfacesOf(Array.from({ length: 20 }, (_, i) => 'void-live-deploy/p' + i + '/index.html')).length, LIMITS.MAX_SURFACES);
});

test('a deleted page is judged at the address it 301s to, and a gone path with no redirect is dropped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vj-redir-'));
  fs.mkdirSync(path.join(dir, 'color'));
  fs.writeFileSync(path.join(dir, 'color', 'index.html'), '<p>family</p>');
  fs.writeFileSync(path.join(dir, '_redirects'), '/color/colour-management /color/ 301\n/color/colour-management/ /color/ 301\n');
  assert.equal(redirectDestOf('/color/colour-management /color/ 301\n', '/color/colour-management/'), '/color/');
  assert.deepEqual(liveSurfacesOf(['void-live-deploy/color/colour-management/index.html', 'void-live-deploy/gone/index.html'], dir), ['/color/']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pixel measures: a soft glow has few hard edges, a hard-edged disk many, a flat frame is blank', () => {
  const W = 160, H = 160, r = (x, y) => Math.hypot(x - 80, y - 80) / 60;
  const soft = pixelStats(frame(W, H, (x, y) => 8 + 120 * Math.max(0, 1 - r(x, y)) ** 4), W, H);
  const hard = pixelStats(frame(W, H, (x, y) => (r(x, y) < 0.3 ? 230 : 8)), W, H);
  assert.ok(soft.hardEdge < LIMITS.HARD_EDGE, JSON.stringify(soft));
  assert.ok(hard.hardEdge > LIMITS.HARD_EDGE, JSON.stringify(hard));
  assert.ok(pixelStats(frame(W, H, () => 5), W, H).offMode < LIMITS.BLANK);
});

test('pixel measures: points of light drawn as flat discs are harsh; the same points as a (1 - r)^4 falloff are not', () => {
  const W = 200, H = 200, at = [];
  for (let i = 0; i < 25; i++) at.push([20 + (i % 5) * 40, 20 + Math.floor(i / 5) * 40]);
  const near = (x, y) => Math.min(...at.map(([a, b]) => Math.hypot(x - a, y - b)));
  const discs = pixelStats(frame(W, H, (x, y) => (near(x, y) <= 1.6 ? 220 : 6)), W, H);
  const soft = pixelStats(frame(W, H, (x, y) => 6 + 214 * Math.max(0, 1 - near(x, y) / 6) ** 4), W, H);
  assert.equal(discs.dots, 25); assert.equal(soft.dots, 25);
  assert.ok(discs.hardDots > LIMITS.HARD_DOTS, JSON.stringify(discs));
  assert.ok(soft.hardDots < LIMITS.HARD_DOTS, JSON.stringify(soft));
  assert.equal(discs.hardEdge, 0, 'points are not shapes');
});

test('judge names each failure with the surface, the viewport and the numbers', () => {
  const dom = { errors: ['boom'], scrollX: 40, clipped: ['p.x'], bg: 0.9, media: ['video a.mp4'], chrome: ['a#void-anchor', 'p.offer'] };
  const bad = judge('/', 'mobile', dom, { mean: 0.5, offMode: 0.0001, hardEdge: 0.5, dots: 10, hardDots: 0.5 });
  assert.ok(bad.some((b) => b.includes('a#void-anchor')), 'nothing besides the ask bar, the old corner heart included');
  for (const w of ['console/page error', 'sideways scroll', 'clipped text', 'not the dark theme', 'blank render', 'media failed', 'p.offer', 'not near-black', 'hard-edged', 'harsh star dots']) assert.ok(bad.some((b) => b.includes(w) && b.startsWith('/ @ mobile')), w);
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
