// The drawing course's scores (/learn-to-draw/, lib/drawing-drills.js): worked sums, so a score is the same every time the same strokes are drawn
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRILLS, UNITS, score, encode, decode, darkness, dailyDrill, streak } from '../void-live-deploy/lib/drawing-drills.js';

const line = (a, b, n = 22) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const zigzag = (x0, x1, y0, y1, step = 4) => { const s = []; for (let x = x0, k = 0; x <= x1; x += step, k++) s.push([x, k % 2 ? y1 : y0]); return [s]; };

test('8 drills, 2 in each of the 4 units', () => {
  assert.equal(DRILLS.length, 8);
  for (const u of UNITS) assert.equal(DRILLS.filter((d) => d.unit === u).length, 2, u);
});
test('a straight line dot to dot scores 100; the same line 10 px low scores 50; one 20 px low scores 0', () => {
  assert.equal(score('line', [line([40, 150], [260, 150])]).score, 100);
  assert.deepEqual(score('line', [line([40, 150], [260, 150])]).notes, ['0.0 px from the line on average', '100% of the way covered']);
  assert.equal(score('line', [line([40, 160], [260, 160])]).score, 50);
  assert.equal(score('line', [line([40, 170], [260, 170])]).score, 0);
});
test('half a line covers half the way and the 12 px past its end: 55 of 100', () => {
  const r = score('line', [line([40, 150], [150, 150])]);
  assert.ok(r.score >= 53 && r.score <= 56, r.score);
});
test('a true circle scores 100 by eye, whatever its size; half a circle scores half', () => {
  const ring = (r, to = 2 * Math.PI) => [Array.from({ length: 181 }, (_, i) => [150 + r * Math.cos(to * i / 180), 150 + r * Math.sin(to * i / 180)])];
  assert.equal(score('circle', ring(90)).score, 100);
  assert.equal(score('circle', ring(60)).score, 100);
  assert.ok(score('circle', ring(90, Math.PI)).score <= 52);
});
test('the middle of the line: on it scores 100, 12 px off scores 50, 24 px off scores 0', () => {
  assert.equal(score('half', [[[150, 150]]]).score, 100);
  assert.equal(score('half', [[[162, 151]]]).score, 50);
  assert.deepEqual(score('half', [[[162, 151]]]).notes, ['12 px from the middle (5.0% of the line)', 'to the right']);
  assert.equal(score('half', [[[126, 150]]]).score, 0);
});
test('shading: each pass darkens by a quarter, up to dark', () => {
  const box = [20, 110, 46, 80], pass = zigzag(20, 66, 110, 190, 3)[0];
  assert.equal(darkness([], box), 0);
  assert.ok(darkness([pass, pass, pass, pass, pass], box) > 0.95);
  const one = darkness([pass], box); assert.ok(one > 0.2 && one <= 0.25, one);
});
test('a value scale in even steps scores high; one with a step lighter than the last says so', () => {
  const boxes = DRILLS.find((d) => d.id === 'values').boxes, strokes = [];
  boxes.forEach((b, i) => { const p = zigzag(b[0], b[0] + b[2], b[1], b[1] + b[3], 3)[0]; for (let k = 0; k < i; k++) strokes.push(p); });
  const r = score('values', strokes); assert.ok(r.score >= 90, JSON.stringify(r)); assert.ok(r.notes.includes('gets darker all the way'));
  const swapped = []; boxes.forEach((b, i) => { const p = zigzag(b[0], b[0] + b[2], b[1], b[1] + b[3], 3)[0]; for (let k = 0; k < [0, 2, 1, 3, 4][i]; k++) swapped.push(p); });
  assert.ok(score('values', swapped).notes.includes('a step gets lighter where it should get darker'));
});
test('strokes go into a link and come back the same, to the pixel', () => {
  const s = [line([40, 150], [260, 150]), [[0, 0], [300, 300]]], back = decode(encode(s));
  assert.equal(back.length, 2); assert.deepEqual(back[1], [[0, 0], [300, 300]]);
  assert.equal(score('line', back).score, score('line', s).score);
  assert.deepEqual(decode('zz!!_<script>'), []);
});
test('the drill of the day goes round all 8; the streak counts days in a row', () => {
  const seen = new Set(); for (let i = 0; i < 8; i++) seen.add(dailyDrill(new Date(2026, 9, 1 + i)).id);
  assert.equal(seen.size, 8);
  assert.equal(streak(['2026-10-27', '2026-10-28', '2026-10-29'], '2026-10-29'), 3);
  assert.equal(streak(['2026-10-27', '2026-10-28'], '2026-10-29'), 2);
  assert.equal(streak(['2026-10-26'], '2026-10-29'), 0);
});
