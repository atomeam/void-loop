// Repair MP4 (void-live-deploy/lib/mp4-repair.js): files broken the ways a phone or a camera breaks them, made here from H.264 pictures whose
// bytes are known, so each repaired file can be read back and checked picture by picture against what went in. The same repair on real
// x264, x265, PCM and AAC files, decoded by ffmpeg and compared frame by frame with the originals, is in the PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { repair } from '../void-live-deploy/lib/mp4-repair.js';
import { mp4 } from '../void-live-deploy/lib/video-mux.js';

// ---- an H.264 stream: Baseline, 320 x 240, 8-bit frame_num, picture order type 2 (each picture shows in the order it is decoded) ----
class BitW {
  constructor() { this.bits = []; }
  u(n, v) { for (let i = n - 1; i >= 0; i--) this.bits.push((v >>> i) & 1); return this; }
  ue(v) { const x = v + 1, n = 31 - Math.clz32(x); return this.u(n, 0).u(n + 1, x); }
  se(v) { return this.ue(v <= 0 ? -2 * v : 2 * v - 1); }
  // the rbsp stop bit, then whole bytes
  bytes() { const b = [...this.bits, 1]; while (b.length % 8) b.push(0); const o = []; for (let i = 0; i < b.length; i += 8) o.push(b.slice(i, i + 8).reduce((a, x) => a * 2 + x, 0)); return o; }
}
// emulation prevention: no 00 00 0x (x < 4) in a NAL
const esc = (b) => { const o = []; let z = 0; for (const x of b) { if (z >= 2 && x < 4) { o.push(3); z = 0; } o.push(x); z = x ? 0 : z + 1; } return Uint8Array.from(o); };
const SPS = esc([0x67, ...new BitW().u(8, 66).u(8, 0xe0).u(8, 30).ue(0).ue(4).ue(2).ue(1).u(1, 0).ue(19).ue(14).u(1, 1).u(1, 1).u(1, 0).u(1, 0).bytes()]);
const PPS = esc([0x68, ...new BitW().ue(0).ue(0).u(1, 0).u(1, 0).ue(0).ue(0).ue(0).u(1, 0).u(2, 0).se(0).se(0).se(0).u(1, 1).u(1, 0).u(1, 0).bytes()]);
const AVCC = Uint8Array.from([1, 66, 0xe0, 30, 0xff, 0xe1, 0, SPS.length, ...SPS, 1, 0, PPS.length, ...PPS]);
const len4 = (n) => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];
// picture k: an IDR every 30, else a P picture; the slice data after the header is k's own bytes, so a picture says which one it is
const GOP = 30;
function picture(k, inBand = false) {
  const key = k % GOP === 0, w = new BitW().ue(0).ue(key ? 7 : 5).ue(0).u(8, k % GOP); if (key) w.ue(0);
  const head = w.bytes(), body = Array.from({ length: 300 + ((k * 37) % 500) }, (_, i) => (i < 2 ? [0xa0 | (k >> 8), k & 255][i] : 0x5a));
  const nal = esc([key ? 0x65 : 0x41, ...head, ...body]), parts = [];
  if (key && inBand) for (const s of [SPS, PPS]) parts.push(...len4(s.length), ...s);
  parts.push(...len4(nal.length), ...nal);
  return { data: Uint8Array.from(parts), key };
}
const N = 90;
const good = (inBand = false, audio = null, n = N) => mp4({ codec: 'avc1.42e01e', width: 320, height: 240, description: AVCC, samples: Array.from({ length: n }, (_, k) => ({ ...picture(k, inBand), t: Math.round((k * 1e6) / 30), d: Math.round(1e6 / 30) })) }, audio);

// ---- a reader for the result: the boxes, and each video sample's bytes by the new index ----
const be32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const type = (b, at) => String.fromCharCode(...b.subarray(at + 4, at + 8));
function boxes(b, from = 0, to = b.length) { const o = []; let at = from; while (at + 8 <= to) { const size = be32(b, at); o.push({ type: type(b, at), at, size }); if (size < 8) break; at += size; } return o; }
function find(b, path, from = 0, to = b.length) { const [head, ...rest] = path; const hit = boxes(b, from, to).filter((x) => x.type === head); return rest.length ? hit.flatMap((x) => find(b, rest, x.at + 8, x.at + x.size)) : hit; }
const STBL = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
function samples(b, track = 0) {
  const st = (n) => find(b, [...STBL, n])[track], sz = st('stsz'), sc = st('stsc'), co = st('stco') || st('co64'), wide = !st('stco');
  const n = be32(b, sz.at + 16), fixed = be32(b, sz.at + 12), lens = Array.from({ length: n }, (_, i) => fixed || be32(b, sz.at + 20 + 4 * i));
  const nc = be32(b, co.at + 12), offs = Array.from({ length: nc }, (_, i) => (wide ? be32(b, co.at + 20 + 8 * i) : be32(b, co.at + 16 + 4 * i)));
  const runs = Array.from({ length: be32(b, sc.at + 12) }, (_, i) => [be32(b, sc.at + 16 + 12 * i), be32(b, sc.at + 20 + 12 * i)]), out = []; let s = 0;
  for (let c = 0; c < nc; c++) { const per = runs.filter(([f]) => f <= c + 1).pop()[1]; let p = offs[c]; for (let k = 0; k < per && s < n; k++, s++) { out.push(b.subarray(p, p + lens[s])); p += lens[s]; } }
  return out;
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
// the file with its index lost: the ftyp and the mdat, as a camera leaves them when the power goes before it writes the moov at the end
const lostIndex = (b) => { const t = boxes(b), keep = t.filter((x) => x.type !== 'moov'); const o = new Uint8Array(keep.reduce((a, x) => a + x.size, 0)); let at = 0; for (const x of keep) { o.set(b.subarray(x.at, x.at + x.size), at); at += x.size; } return o; };

test('no index, a good video from the same camera: every picture comes back, in order, with its own bytes', () => {
  const ref = good(), r = repair(lostIndex(ref), ref);
  assert.equal(r.how, 'reference'); assert.equal(r.ext, 'mp4');
  assert.deepEqual(boxes(r.bytes).map((x) => x.type), ['ftyp', 'moov', 'mdat']);
  const got = samples(r.bytes); assert.equal(got.length, N);
  for (let k = 0; k < N; k++) assert.ok(same(got[k], picture(k).data), 'picture ' + k);
  // the key pictures are marked: 0, 30, 60 (1-based 1, 31, 61)
  const stss = find(r.bytes, [...STBL, 'stss'])[0]; assert.deepEqual([0, 1, 2].map((i) => be32(r.bytes, stss.at + 16 + 4 * i)), [1, 31, 61]);
  // 30 pictures a second, as in the good video: 90 pictures, 3 s
  const mdhd = find(r.bytes, ['moov', 'trak', 'mdia', 'mdhd'])[0]; assert.equal(be32(r.bytes, mdhd.at + 24) / be32(r.bytes, mdhd.at + 20), 3);
  assert.match(r.notes.join(' '), /90 H\.264 pictures \(3 s\)/);
});

test('no index and no good video: the settings are read from the data when the camera repeats them before each key picture', () => {
  const r = repair(lostIndex(good(true)));
  assert.equal(r.how, 'in-band'); const got = samples(r.bytes); assert.equal(got.length, N);
  for (let k = 0; k < N; k++) assert.ok(same(got[k], picture(k, true).data), 'picture ' + k);
  assert.match(r.notes.join(' '), /320 x 240/);
  // with no settings in the data and no good video, it says what to add
  assert.throws(() => repair(lostIndex(good(false))), /Add a good video from the same phone or camera/);
});

test('a hole in the data: the pictures before and after it come back, and only the damaged ones are left out', () => {
  const ref = good(), broken = lostIndex(ref);
  // zero the bytes of pictures 40 and 41 (their NALs, by their marks)
  const mark = (k) => { for (let i = 0; i + 1 < broken.length; i++) if (broken[i] === (0xa0 | (k >> 8)) && broken[i + 1] === (k & 255) && broken[i + 2] === 0x5a) return i; return -1; };
  const from = mark(40) - 12, to = mark(42) - 12; assert.ok(from > 0 && to > from); broken.fill(0, from, to);
  const r = repair(broken, ref), got = samples(r.bytes), marks = got.map((s) => { const i = s.indexOf(0x5a); return ((s[i - 2] & 15) << 8) | s[i - 1]; });
  for (let k = 0; k < 40; k++) assert.equal(marks[k], k);
  assert.ok(!marks.includes(40) && !marks.includes(41), 'the zeroed pictures are not in the file');
  // P pictures after the hole need the pictures it took, and their frame_num shows the loss: the walk starts again at the next key picture, 60
  assert.equal(marks[40], 60); assert.equal(marks.at(-1), N - 1);
  for (let j = 40; j < got.length; j++) assert.ok(same(got[j], picture(marks[j]).data));
});

test('a file cut short with its index whole (the index first): every sample whose bytes are all in the file, and no more', () => {
  const b = good(), mdat = boxes(b).find((x) => x.type === 'mdat'), cut = b.slice(0, mdat.at + Math.floor(mdat.size * 0.6));
  const r = repair(cut), got = samples(r.bytes);
  assert.equal(r.how, 'index'); assert.ok(got.length > 40 && got.length < N, got.length + ' samples');
  for (let k = 0; k < got.length; k++) assert.ok(same(got[k], picture(k).data));
  assert.match(r.notes.join(' '), new RegExp('left out the ' + (N - got.length) + ' the index lists past the end'));
  // a whole file: the same samples, and a note that the damage, if any, is not in the index
  const w = repair(b); assert.equal(samples(w.bytes).length, N); assert.match(w.notes.join(' '), /The index was whole/);
});

test('AAC sound with no index cannot be found in the data: a sound-only file says so, and a video keeps its pictures without it', () => {
  const asc = Uint8Array.of(0x12, 0x10), aac = { codec: 'mp4a.40.2', rate: 44100, channels: 2, description: asc, bitrate: 128000, samples: Array.from({ length: 130 }, (_, k) => ({ data: Uint8Array.of(0x21, k & 255, 9, 9, 9, 9), t: Math.round((k * 1024 * 1e6) / 44100), d: Math.round((1024 * 1e6) / 44100), key: true })) };
  const ref = good(false, aac), r = repair(lostIndex(ref), ref);
  assert.equal(samples(r.bytes).length, N); assert.equal(find(r.bytes, ['moov', 'trak']).length, 1);
  assert.match(r.notes.join(' '), /The AAC sound is left out/);
  const m4a = mp4(null, aac, { m4a: true });
  assert.throws(() => repair(lostIndex(m4a), m4a), /AAC frames do not say where they end/);
});

test('not an MP4 at all: a plain message, not a broken file', () => {
  assert.throws(() => repair(Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) & 255)));
});
