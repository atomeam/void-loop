// tests for lib/audio-write.js: the FLAC file is read back by a small FLAC decoder written here, sample for sample; the Ogg pages are read
// back page by page, each check sum done again bit by bit
import test from 'node:test';
import assert from 'node:assert/strict';
import { flac, oggOpus, crc8, crc16, crc32ogg, md5 } from '../void-live-deploy/lib/audio-write.js';

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const te = new TextEncoder();

test('the checks: CRC-8, CRC-16 and the Ogg CRC-32 against their published check values; MD5 against RFC 1321', () => {
  const d = te.encode('123456789');
  assert.equal(crc8(d), 0xf4); assert.equal(crc16(d), 0xfee8); assert.equal(crc32ogg(d), 0x89a1897f);
  assert.equal(hex(md5(new Uint8Array(0))), 'd41d8cd98f00b204e9800998ecf8427e'); assert.equal(hex(md5(te.encode('abc'))), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(hex(md5(te.encode('a'.repeat(1000)))), 'cabe45dcc9ae5b66ba86600cca6b8ba8');
});

// a FLAC reader for what Verse writes: STREAMINFO, then frames of constant, verbatim and fixed subframes with Rice residuals
function readFlac(b) {
  assert.equal(String.fromCharCode(...b.subarray(0, 4)), 'fLaC');
  let at = 4, info = null;
  for (;;) { const last = b[at] >> 7, type = b[at] & 127, len = (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]; if (type === 0) info = b.subarray(at + 4, at + 4 + len); at += 4 + len; if (last) break; }
  let p = 0; const bit = () => (info[p >> 3] >> (7 - (p++ & 7))) & 1, get = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bit(); return v; };
  get(16); get(16); get(24); get(24); const rate = get(20), ch = get(3) + 1, bps = get(5) + 1, total = get(36), sum = info.subarray(18, 34);
  const out = Array.from({ length: ch }, () => []);
  let frames = 0;
  while (at < b.length) {
    const start = at; let q = at * 8; const rb = () => (b[q >> 3] >> (7 - (q++ & 7))) & 1, r = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + rb(); return v; }, sr = (n) => { const v = r(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; };
    assert.equal(r(15), 0x7ffc, 'frame sync'); r(1);
    const bsCode = r(4); r(4); const assign = r(4); assert.equal(r(3), 4, '16-bit'); r(1);
    let first = r(8), extra = 0; while (first & (0x80 >> extra)) extra++; for (let i = 1; i < extra; i++) r(8);
    const size = bsCode === 12 ? 4096 : bsCode === 7 ? r(16) + 1 : assert.fail('block size code ' + bsCode);
    const hdrEnd = q >> 3; assert.equal(r(8), crc8(b.subarray(start, hdrEnd)), 'header CRC-8');
    const subs = [];
    for (let c = 0; c < ch; c++) {
      const w = bps + ((assign === 8 && c === 1) || (assign === 9 && c === 0) || (assign === 10 && c === 1) ? 1 : 0);
      r(1); const type = r(6); assert.equal(r(1), 0, 'no wasted bits'); const x = new Array(size);
      if (type === 0) { const v = sr(w); x.fill(v); }
      else if (type === 1) for (let i = 0; i < size; i++) x[i] = sr(w);
      else if (type >= 8 && type <= 12) {
        const order = type - 8; for (let i = 0; i < order; i++) x[i] = sr(w);
        assert.equal(r(2), 0); const po = r(4), parts = 1 << po; let i = order;
        for (let pt = 0; pt < parts; pt++) {
          const k = r(4); assert.notEqual(k, 15, 'no escape'); const n = (size >> po) - (pt === 0 ? order : 0);
          for (let j = 0; j < n; j++, i++) { let uq = 0; while (!rb()) uq++; const u = uq * 2 ** k + r(k), e = u & 1 ? -(u + 1) / 2 : u / 2;
            x[i] = e + (order === 0 ? 0 : order === 1 ? x[i - 1] : order === 2 ? 2 * x[i - 1] - x[i - 2] : order === 3 ? 3 * x[i - 1] - 3 * x[i - 2] + x[i - 3] : 4 * x[i - 1] - 6 * x[i - 2] + 4 * x[i - 3] - x[i - 4]); }
        }
      } else assert.fail('subframe type ' + type);
      subs.push(x);
    }
    q = Math.ceil(q / 8) * 8; const end = q >> 3; assert.equal((b[end] << 8) | b[end + 1], crc16(b.subarray(start, end)), 'frame CRC-16'); at = end + 2; frames++;
    let L = subs[0], R = subs[1];
    if (assign === 8) R = L.map((v, i) => v - subs[1][i]); else if (assign === 9) L = R.map((v, i) => v + subs[0][i]);
    else if (assign === 10) { L = []; R = []; for (let i = 0; i < size; i++) { const m = subs[0][i] * 2 + (subs[1][i] & 1); L.push((m + subs[1][i]) >> 1); R.push((m - subs[1][i]) >> 1); } }
    const cs = ch === 2 ? [L, R] : subs; cs.forEach((x, c) => out[c].push(...x));
  }
  return { rate, ch, bps, total, sum, out, frames };
}

const q16 = (x) => { const y = Math.max(-1, Math.min(1, x)); return Math.round(y < 0 ? y * 32768 : y * 32767); };
function soundOf(n, f) { return [Float32Array.from({ length: n }, (_, i) => f(i, 0)), Float32Array.from({ length: n }, (_, i) => f(i, 1))]; }

test('FLAC: every sample comes back the same, the MD5 is of the samples, and stereo picks left, right, mid or side', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) - 0.5;
  const cases = [
    ['a tone, the channels alike (mid and side win)', soundOf(10000, (i) => 0.5 * Math.sin(i / 20))],
    ['noise at full scale (verbatim or order 0)', soundOf(5000, () => rnd() * 2)],
    ['silence (constant)', soundOf(4096 * 2 + 17, () => 0)],
    ['one channel loud, one quiet', soundOf(9000, (i, c) => (c ? 0.01 : 0.9) * Math.sin(i / (7 + c)) + rnd() * 0.002)],
  ];
  for (const [name, ch] of cases) {
    const b = flac(ch, 44100), r = readFlac(b), n = ch[0].length;
    assert.equal(r.rate, 44100, name); assert.equal(r.ch, 2, name); assert.equal(r.bps, 16, name); assert.equal(r.total, n, name); assert.equal(r.frames, Math.ceil(n / 4096), name);
    for (let c = 0; c < 2; c++) { assert.equal(r.out[c].length, n, name); for (let i = 0; i < n; i++) if (r.out[c][i] !== q16(ch[c][i])) assert.fail(name + ': channel ' + c + ' sample ' + i + ' is ' + r.out[c][i] + ', not ' + q16(ch[c][i])); }
    const raw = new Uint8Array(n * 4); let p = 0; for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const v = q16(ch[c][i]); raw[p++] = v & 255; raw[p++] = (v >> 8) & 255; }
    assert.equal(hex(r.sum), hex(md5(raw)), name + ': MD5');
  }
  const tone = flac(soundOf(44100, (i) => 0.5 * Math.sin(i / 20)), 44100); assert.ok(tone.length < 44100 * 4 / 3, 'a tone takes less than a third of the WAV: ' + tone.length);
  const mono = readFlac(flac([Float32Array.from({ length: 300 }, (_, i) => Math.sin(i))], 8000)); assert.equal(mono.ch, 1); assert.equal(mono.out[0].length, 300); assert.equal(mono.rate, 8000);
});

function readOgg(b) {
  const bitCrc = (d) => { let c = 0; for (const x of d) { c ^= x << 24; for (let k = 0; k < 8; k++) c = c & 0x80000000 ? ((c << 1) ^ 0x04c11db7) >>> 0 : (c << 1) >>> 0; } return c >>> 0; };
  const pages = []; let at = 0;
  while (at < b.length) {
    assert.equal(String.fromCharCode(...b.subarray(at, at + 4)), 'OggS'); const v = new DataView(b.buffer, b.byteOffset + at);
    const segs = b[at + 26], lace = Array.from(b.subarray(at + 27, at + 27 + segs)), body = lace.reduce((a, x) => a + x, 0), len = 27 + segs + body;
    const copy = b.slice(at, at + len); copy.fill(0, 22, 26); assert.equal(v.getUint32(22, true), bitCrc(copy), 'page CRC');
    const packets = []; let p = at + 27 + segs, cur = 0; for (const x of lace) { cur += x; if (x < 255) { packets.push(b.subarray(p, p + cur)); p += cur; cur = 0; } }
    pages.push({ flags: b[at + 5], granule: v.getUint32(6, true) + v.getUint32(10, true) * 2 ** 32, serial: v.getUint32(14, true), seq: v.getUint32(18, true), packets }); at += len;
  }
  return pages;
}

test('Ogg Opus: OpusHead and OpusTags on pages of their own, the granule counts every 48 kHz sample decoded (pre-skip too), the last page ends at the true end', () => {
  const samples = Array.from({ length: 260 }, (_, k) => ({ data: Uint8Array.from({ length: k === 3 ? 600 : 40 + (k % 9) }, (_, i) => (k + i) & 255), d: 20000 }));
  const b = oggOpus({ channels: 2, description: null, samples }, { inputRate: 44100, samples: 260 * 960 - 500 }), pages = readOgg(b);
  assert.equal(pages[0].flags, 2); assert.equal(String.fromCharCode(...pages[0].packets[0].subarray(0, 8)), 'OpusHead'); assert.equal(pages[0].packets.length, 1);
  const head = pages[0].packets[0]; assert.equal(head[9], 2); assert.equal(head[10] | (head[11] << 8), 312); assert.equal((head[12] | (head[13] << 8) | (head[14] << 16)) >>> 0, 44100);
  assert.equal(String.fromCharCode(...pages[1].packets[0].subarray(0, 8)), 'OpusTags'); assert.equal(pages[1].granule, 0);
  pages.forEach((p, i) => { assert.equal(p.seq, i); assert.equal(p.serial, pages[0].serial); });
  const audio = pages.slice(2), got = audio.flatMap((p) => p.packets); assert.equal(got.length, 260); got.forEach((x, k) => assert.deepEqual(x, samples[k].data));
  assert.equal(audio.at(-1).flags, 4, 'the last page ends the stream'); assert.equal(audio.at(-1).granule, 312 + 260 * 960 - 500, 'the true end');
  let seen = 0; for (const p of audio.slice(0, -1)) { seen += p.packets.length; assert.equal(p.granule, seen * 960); }
  assert.ok(audio.length > 1, 'more than one page');
});
