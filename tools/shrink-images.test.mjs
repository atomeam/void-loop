// Verse's own compressor on its own pictures (tools/shrink-images.mjs over lib/photo-edit.js). Run: node --test tools/shrink-images.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decodePng, shrinkPng, MAX_ERR } from './shrink-images.mjs';
import { crc32 } from '../void-live-deploy/lib/photo-edit.js';
import { fitLine, OG_LINE } from './og-tool-sites.mjs';

const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length); b.write(t, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
/** an RGB PNG of a horizontal gradient, rows written with the given filter (all five are read) */
function rgbPng(w, h, filter) {
  const raw = Buffer.alloc((w * 3 + 1) * h), px = (x, y) => [Math.round((x / (w - 1)) * 200) + 20, 40 + (y % 3), 90];
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = filter; for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const v = px(x, y)[c], a = x ? px(x - 1, y)[c] : 0, u = y ? px(x, y - 1)[c] : 0, cc = x && y ? px(x - 1, y - 1)[c] : 0;
    const p = a + u - cc, pr = Math.abs(p - a) <= Math.abs(p - u) && Math.abs(p - a) <= Math.abs(p - cc) ? a : Math.abs(p - u) <= Math.abs(p - cc) ? u : cc;
    raw[y * (w * 3 + 1) + 1 + x * 3 + c] = (v - [0, a, u, (a + u) >> 1, pr][filter] + 256) & 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return { png: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]), px };
}

test('every PNG row filter decodes to the same pixels', () => {
  for (let f = 0; f <= 4; f++) {
    const { png, px } = rgbPng(9, 4, f), img = decodePng(png);
    assert.equal(img.w, 9); assert.equal(img.h, 4);
    for (const [x, y] of [[0, 0], [8, 3], [4, 2]]) assert.deepEqual([...img.rgba.subarray((y * 9 + x) * 4, (y * 9 + x) * 4 + 4)], [...px(x, y), 255], 'filter ' + f);
  }
  assert.equal(decodePng(Buffer.from('not a png at all')), null);
});

test('a picture comes back as a palette PNG that reads the same, and smaller when it has few colours', async () => {
  const { png } = rgbPng(400, 60, 0), r = await shrinkPng(png);
  const back = decodePng(r.bytes); assert.equal(back.w, 400); assert.equal(back.h, 60);
  assert.ok(r.err <= MAX_ERR, 'mean error ' + r.err);
  assert.ok(r.after < r.before, r.before + ' -> ' + r.after);
});

test('the share line stops after a whole item, with no ellipsis', () => {
  const t = 'Every PDF tool in one set that works offline after one visit: merge, split, reorder, rotate, delete, compress, images to PDF and back';
  const l = fitLine(t); assert.ok(l.length <= OG_LINE && t.startsWith(l) && !/[.…]$/.test(l) && !l.endsWith(','), l);
  assert.equal(fitLine('Short.'), 'Short.');
});
