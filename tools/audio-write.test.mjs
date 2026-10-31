// tests for lib/audio-write.js: the FLAC file is read back by a small FLAC decoder written here, sample for sample; the Ogg pages are read
// back page by page, each check sum done again bit by bit
import test from 'node:test';
import assert from 'node:assert/strict';
import { flac, oggOpus, crc8, crc16, crc32ogg, md5, alac, alacFile, m4aFile, RINGTONE_SECONDS } from '../void-live-deploy/lib/audio-write.js';

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

// an ALAC reader written from the decoder's rules (element header, adaptive Golomb, the sign-LMS predictor, the stereo unmix), to read
// back what Verse writes, sample for sample
function readAlac(frame, cfg, channels) {
  const max = (cfg[0] << 24 | cfg[1] << 16 | cfg[2] << 8 | cfg[3]) >>> 0, pb = cfg[6], mb = cfg[7], kb = cfg[8], depth = cfg[5];
  let p = 0; const bit = () => (frame[p >> 3] >> (7 - (p++ & 7))) & 1, get = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bit(); return v; };
  const sget = (n) => { const v = get(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }, sext = (v, b) => (v << (32 - b)) >> (32 - b), log2 = (x) => 31 - Math.clz32(x | 1);
  const scalar = (k, b) => { let x = 0; while (x < 9 && bit()) x++; if (x > 8) return get(b); if (k === 1) return x; const div = (1 << k) - 1, peek = get(k); if (peek > 1) return x * div + peek - 1; p--; return x * div; };
  const type = get(3); assert.equal(type, channels === 2 ? 1 : 0); get(4); assert.equal(get(12), 0);
  const hasSize = get(1); assert.equal(get(2), 0); const verbatim = get(1), n = hasSize ? get(32) : max, out = Array.from({ length: channels }, () => new Int32Array(n));
  const bps = depth + channels - 1; let shift = 0, weight = 0;
  if (verbatim) { for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) out[c][i] = sget(depth); }
  else {
    shift = get(8); weight = get(8); const heads = [];
    for (let c = 0; c < channels; c++) { const h = { mode: get(4), q: get(4), mod: get(3), order: get(5), coefs: [] }; for (let i = h.order - 1; i >= 0; i--) h.coefs[i] = sget(16); heads.push(h); }
    for (let c = 0; c < channels; c++) {
      const h = heads[c], e = new Int32Array(n), mult = (h.mod * pb) / 4; let hist = mb, smod = 0;
      for (let i = 0; i < n; i++) {
        const x = scalar(Math.min(log2((hist >>> 9) + 3), kb), bps) + smod; smod = 0; e[i] = (x >>> 1) ^ -(x & 1);
        hist = x > 0xffff ? 0xffff : hist + x * mult - Math.floor((hist * mult) / 512);
        if (hist < 128 && i + 1 < n) { const run = scalar(Math.min(7 - log2(hist) + ((hist + 16) >> 6), kb), 16); assert.ok(run < n - i); i += run; if (run <= 0xffff) smod = 1; hist = 0; }
      }
      const y = out[c]; y[0] = e[0];
      if (h.order === 31) for (let i = 1; i < n; i++) y[i] = sext(y[i - 1] + e[i], bps);
      else {
        const k = Int16Array.from(h.coefs); let i = 1; for (; i <= h.order && i < n; i++) y[i] = sext(y[i - 1] + e[i], bps);
        for (; i < n; i++) {
          const b = i - h.order, d = y[b - 1]; let acc = 0; for (let j = 0; j < h.order; j++) acc = (acc + Math.imul(y[b + j] - d, k[j])) | 0;
          y[i] = sext(Math.floor((acc + (1 << (h.q - 1))) / (1 << h.q)) + d + e[i], bps);
          let ev = e[i]; const sg = Math.sign(ev);
          for (let j = 0; j < h.order && ev * sg > 0; j++) { const v = d - y[b + j], s = Math.sign(v) * sg; k[j] -= s; ev = (ev - Math.imul(Math.imul(v, s) >> h.q, j + 1)) | 0; }
        }
      }
    }
  }
  assert.equal(get(3), 7, 'the frame ends with the END element');
  if (channels === 2 && weight) for (let i = 0; i < n; i++) { const a = out[0][i] - ((out[1][i] * weight) >> shift), b = out[1][i] + a; out[0][i] = b; out[1][i] = a; }
  return out;
}
const s16 = (x) => { const y = Math.max(-1, Math.min(1, x)); return Math.round(y < 0 ? y * 32768 : y * 32767); };
function sound(n, chans, kind) {
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
  return Array.from({ length: chans }, (_, c) => Float32Array.from({ length: n }, (_, i) => kind === 'noise' ? rnd() : kind === 'quiet' ? (i % 5000 < 3000 ? 0 : 0.3 * Math.sin(i / 9)) : 0.5 * Math.sin(i * (0.01 + c * 0.003)) + 0.2 * Math.sin(i * 0.17) + 0.0005 * rnd()));
}

test('ALAC: mono and stereo, tones, silence runs and full noise, read back sample for sample, with a short last frame', () => {
  for (const [chans, kind] of [[1, 'tone'], [2, 'tone'], [2, 'quiet'], [1, 'quiet'], [2, 'noise']]) {
    const src = sound(4096 * 3 + 1000, chans, kind), a = alac(src, 44100);
    assert.equal(a.frames.length, 4); assert.equal(a.config.length, 24); assert.equal(a.config[9], chans);
    const got = Array.from({ length: chans }, () => []);
    for (const f of a.frames) readAlac(f, a.config, chans).forEach((x, c) => got[c].push(...x));
    for (let c = 0; c < chans; c++) { assert.equal(got[c].length, src[c].length, kind); for (let i = 0; i < src[c].length; i++) if (got[c][i] !== s16(src[c][i])) assert.fail(kind + ' ' + chans + ' ch ' + c + ' sample ' + i + ': ' + got[c][i] + ' not ' + s16(src[c][i])); }
    const raw = src[0].length * chans * 2, size = a.frames.reduce((s, f) => s + f.length, 0);
    if (kind !== 'noise') assert.ok(size < raw / 2, kind + ': ' + size + ' of ' + raw); else assert.ok(size < raw * 1.01, 'noise falls back to raw samples');
  }
  assert.throws(() => alac(sound(100, 3, 'tone'), 44100), /mono or stereo/);
});

test('ALAC in an .m4a: the M4A brand, an alac sample entry with its 36-byte config box, one sample for each frame', () => {
  const src = sound(10000, 2, 'tone'), m = alacFile(src, 48000), txt = (a, n) => String.fromCharCode(...m.subarray(a, a + n));
  assert.equal(txt(4, 4), 'ftyp'); assert.equal(txt(8, 4), 'M4A ');
  const find = (s) => { for (let i = 0; i < m.length - 4; i++) if (txt(i, 4) === s) return i; return -1; };
  const entry = find('alac'), inner = entry + 4 + 28; assert.ok(entry > 0);
  assert.equal(txt(inner + 4, 4), 'alac'); assert.equal((m[inner] << 24 | m[inner + 1] << 16 | m[inner + 2] << 8 | m[inner + 3]), 36);
  const rate = (m[inner + 32] << 24 | m[inner + 33] << 16 | m[inner + 34] << 8 | m[inner + 35]) >>> 0; assert.equal(rate, 48000);
  const stsz = find('stsz'); assert.equal((m[stsz + 12] << 24 | m[stsz + 13] << 16 | m[stsz + 14] << 8 | m[stsz + 15]), 3);
  const mdhd = find('mdhd'); assert.equal((m[mdhd + 16] << 24 | m[mdhd + 17] << 16 | m[mdhd + 18] << 8 | m[mdhd + 19]) >>> 0, 48000); assert.equal((m[mdhd + 20] << 24 | m[mdhd + 21] << 16 | m[mdhd + 22] << 8 | m[mdhd + 23]) >>> 0, 10000);
});

test('M4A without an AAC encoder: Apple Lossless in the .m4a, and it says so; M4R stops, since a ringtone has to be AAC', async () => {
  assert.equal(typeof globalThis.AudioEncoder, 'undefined'); // node has none, as Chrome on Linux has no AAC encoder
  const chans = sound(48000, 2, 'tone'), s = { rate: 48000, channels: chans };
  const o = await m4aFile(s, () => assert.fail('no encoder is called'));
  assert.equal(o.codec, 'alac'); assert.deepEqual([...o.bytes], [...alacFile(chans, 48000)]);
  assert.match(o.notes.join(' '), /no AAC encoder, so the \.m4a holds Apple Lossless/);
  await assert.rejects(m4aFile(s, () => {}, { ringtone: true }), /a ringtone has to be AAC/);
  // a ringtone keeps the first 40 seconds: with an AAC encoder (a stand-in here), the encoder gets 40 s and no more
  globalThis.AudioEncoder = Object.assign(function AudioEncoder() {}, { isConfigSupported: async (c) => ({ supported: c.codec === 'mp4a.40.2' }) });
  try {
    const long = { rate: 48000, channels: [new Float32Array(48000 * 45)] }; let got = 0;
    const r = await m4aFile(long, async (x, cfg) => { got = x.channels[0].length; assert.equal(cfg.codec, 'mp4a.40.2'); return { codec: cfg.codec, rate: 48000, channels: 1, description: new Uint8Array([0x11, 0x88]), samples: [{ data: new Uint8Array(8), t: 0, d: 21333, key: true }] }; }, { ringtone: true });
    assert.equal(got, 48000 * RINGTONE_SECONDS); assert.equal(r.codec, 'aac'); assert.match(r.notes.join(' '), /kept 0 to 40 s of 45\.0 s/);
    assert.equal(String.fromCharCode(...r.bytes.subarray(8, 12)), 'M4A '); assert.ok(Buffer.from(r.bytes).includes(Buffer.from('mp4a')), 'an mp4a sample entry');
  } finally { delete globalThis.AudioEncoder; }
});
