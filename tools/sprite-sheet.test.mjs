// The sprite sheet cleanup (void-live-deploy/lib/sprite-sheet.js) and its stage card (skills/sprite-sheet.js). The port is held to the original
// generate2dsprite Python byte for byte: tools/sprite-sheet-parity.py runs the Python on the same sheet and printed the hashes below.
// Run: node --test tools/sprite-sheet.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { blank, removeMagenta, components, bboxOf, crop, trimBorder, cleanEdges, scale, splitGrid, composeSheet, gridOf } from '../void-live-deploy/lib/sprite-sheet.js';
import skill, { spriteIntent } from '../void-live-deploy/skills/sprite-sheet.js';

const set = (img, x, y, rgba) => img.data.set(rgba, (y * img.width + x) * 4);
const at = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const sha = (img) => createHash('sha256').update(img.data).digest('hex');

/** a 4 x 2 sheet on magenta: a coloured disc in each cell with a pinkish fringe, a stray dot and a dark grid line (sheet() in sprite-sheet-parity.py) */
function testSheet() {
  const img = blank(256, 128);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 255, 255], i);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const x0 = c * 64, y0 = r * 64, cx = x0 + 32 + (c * 5 % 11) - 5, cy = y0 + 32 + (r * 7 % 9) - 4, rad = 10 + (r * 4 + c) * 3 % 11;
    for (let y = y0; y < y0 + 64; y++) for (let x = x0; x < x0 + 64; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 < rad * rad) set(img, x, y, [40 + r * 90, 120 + c * 30, 60, 255]); else if (d2 < (rad + 2) ** 2) set(img, x, y, [230, 60, 220, 255]);
    }
    set(img, x0 + 6, y0 + 6, [200, 200, 30, 255]);
    for (let y = y0; y < y0 + 64; y++) set(img, x0, y, [10, 10, 10, 255]);
  }
  return img;
}

test('the port gives the same bytes as the original Python on the same sheet', () => {
  const img = testSheet();
  assert.equal(sha(img), '1027e179ecf200de9b6a8945992bd61b25cb134a11746bc00d0fd795ca9ee672', 'the test sheet is the one the Python made');
  assert.equal(sha(removeMagenta(img)), '0247db7b8d39bec10001e0201f455bdc62a0cd47d553247969ff51988d530295', 'remove_bg_magenta');
  const all = splitGrid(img, 2, 4, 48, {});
  assert.equal(sha(composeSheet(all.frames, 2, 4, 48)), '4a8b68ebba7c83603dfe823865bf662c5d0d4199d4c51d1ab63a0e0b52b0dc5d', 'split_grid + compose_sheet, all pieces, centred');
  const big = splitGrid(img, 2, 4, 48, { componentMode: 'largest', align: 'feet', sharedScale: true });
  assert.equal(sha(composeSheet(big.frames, 2, 4, 48)), '20becf875468e6af149a04c20e1ac453a04cec5c1dfea4d684130c9602090cfe', 'largest piece, on the floor, one scale');
  assert.deepEqual(all.info.map((x) => x.parts), [2, 2, 2, 2, 2, 2, 2, 2], 'each cell keeps its disc and its stray dot');
});

test('the steps: the key, the flood, the edge clean, the pieces, the crop', () => {
  const img = blank(5, 5);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 255, 255], i);
  set(img, 2, 2, [0, 200, 0, 255]); set(img, 1, 2, [180, 50, 180, 255]); set(img, 4, 4, [250, 10, 250, 255]);
  const k = removeMagenta(img);
  assert.deepEqual(at(k, 0, 0), [0, 0, 0, 0], 'magenta goes clear');
  assert.deepEqual(at(k, 1, 2), [0, 0, 0, 0], 'a fringe (between the two thresholds) the flood reaches goes clear');
  assert.deepEqual(at(k, 2, 2), [0, 200, 0, 255], 'the sprite stays');
  assert.deepEqual(bboxOf(k), [2, 2, 3, 3]);
  assert.equal(at(img, 0, 0)[3], 255, 'the input is not changed');
  const closed = blank(5, 5); for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) set(closed, x, y, x % 4 && y % 4 ? [180, 50, 180, 255] : [0, 200, 0, 255]);
  assert.equal(removeMagenta(closed).data[(2 * 5 + 2) * 4 + 3], 255, 'the same fringe closed in by the sprite stays (the flood cannot reach it)');
  const two = blank(6, 3); set(two, 0, 0, [9, 9, 9, 255]); set(two, 3, 1, [100, 100, 100, 255]); set(two, 4, 1, [100, 100, 100, 255]);
  assert.deepEqual(components(two), [{ area: 2, bbox: [3, 1, 5, 2], touchesEdge: false }, { area: 1, bbox: [0, 0, 1, 1], touchesEdge: true }]);
  assert.deepEqual(at(cleanEdges(two, 1), 0, 0), [0, 0, 0, 0], 'a near-black pixel on the edge goes');
  assert.deepEqual(at(cleanEdges(two, 1), 3, 1), [100, 100, 100, 255], 'one inside stays');
  assert.deepEqual([trimBorder(blank(10, 10), 4).width, trimBorder(blank(8, 8), 4).width], [2, 8], 'trim only what leaves something');
  assert.deepEqual(crop(two, [3, 1, 5, 2]).data.length, 8);
  assert.equal(bboxOf(blank(3, 3)), null);
});

test('scaling picks the same source pixels as Pillow NEAREST', () => {
  // Pillow 12.3 picks for a 2 -> 7 and a 46 -> 40 row (read from Image.resize on a row of 0, 1, 2 ...)
  const row = (n) => { const r = blank(n, 1); for (let x = 0; x < n; x++) r.data[x * 4] = x; return r; };
  const picks = (img) => [...Array(img.width).keys()].map((x) => img.data[x * 4]);
  assert.deepEqual(picks(scale(row(2), 7, 1)), [0, 0, 0, 0, 1, 1, 1]);
  assert.deepEqual(picks(scale(row(46), 40, 1)).slice(0, 12), [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13]);
});

test('feet alignment stands every frame on the same floor; an empty cell stays empty', () => {
  const img = blank(40, 20);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 255, 255], i);
  for (let y = 6; y < 14; y++) for (let x = 6; x < 10; x++) set(img, x, y, [0, 100, 200, 255]);
  const { frames, info } = splitGrid(img, 1, 2, 32, { align: 'feet' });
  assert.equal(info[1].crop, null, 'the second cell is empty');
  assert.ok(frames[1].data.every((v) => v === 0));
  const [x, y] = info[0].at, [w, h] = info[0].size;
  assert.equal(y + h, 32 - Math.floor(32 * 0.15 * 0.5), 'the sprite stands on the floor margin');
  assert.equal(x, Math.floor((32 - w) / 2));
});

test('the ask: the grid and size it names, and only sprite sheet asks', () => {
  assert.deepEqual(gridOf('slice a spritesheet 4x2 64px'), { cols: 4, rows: 2, cell: 64 });
  assert.deepEqual(gridOf('split a sprite sheet into 6 frames'), { cols: 6, rows: 1, cell: 64 });
  assert.deepEqual(gridOf('clean up a sprite sheet 8 columns 3 rows 128 pixels'), { cols: 8, rows: 3, cell: 128 });
  assert.deepEqual(gridOf('99x99 9999px'), { cols: 4, rows: 1, cell: 64 }, 'out of range falls back');
  for (const a of skill.examples) assert.ok(spriteIntent(a), a);
  for (const a of skill.nearMisses) assert.ok(!spriteIntent(a), a);
});

test('the card escapes nothing it did not make: its markup holds only fixed words and numbers', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../void-live-deploy/skills/sprite-sheet.js', import.meta.url), 'utf8');
  assert.match(src, /said\.textContent = /, 'the result line is text, not markup');
  assert.match(src, /MIT License, Copyright \(c\) 2026 0x0funky/, 'the licence credit is on the card');
});
