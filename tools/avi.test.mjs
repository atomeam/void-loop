// The AVI writer of /converter/ (void-live-deploy/lib/avi.js): the H.264 pictures turned to Annex B, the RIFF chunks, the index and the
// fixed picture rate. A real AVI, made in a browser from a real video, was also opened and decoded with ffprobe and ffmpeg (see the PR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { avcParams, annexB, avi, AVI_LIMIT } from '../void-live-deploy/lib/avi.js';

// an avcC record with one SPS (4 bytes) and one PPS (2 bytes), 4-byte NAL lengths
const SPS = [0x67, 0x42, 0xc0, 0x1e], PPS = [0x68, 0xce];
const AVCC = new Uint8Array([1, 0x42, 0xc0, 0x1e, 0xff, 0xe1, 0, 4, ...SPS, 1, 0, 2, ...PPS]);
const nal = (...units) => new Uint8Array(units.flatMap((u) => [0, 0, 0, u.length, ...u]));
const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));
const u32 = (b, at) => new DataView(b.buffer, b.byteOffset).getUint32(at, true);

/** the chunks of a RIFF list body, as [id, start of the body, size] */
function chunks(b, from, to) {
  const out = []; for (let p = from; p + 8 <= to;) { const id = ascii(b, p, 4), n = u32(b, p + 4); out.push([id, p + 8, n]); p += 8 + n + (n & 1); }
  return out;
}

test('avcParams reads the SPS, the PPS and the NAL length size', () => {
  const p = avcParams(AVCC);
  assert.equal(p.nalLen, 4);
  assert.deepEqual([...p.sps[0]], SPS); assert.deepEqual([...p.pps[0]], PPS);
});

test('annexB puts start codes in place of lengths, and the SPS and PPS before a key picture only', () => {
  const p = avcParams(AVCC), pic = nal([0x65, 1, 2, 3], [0x06, 9]);
  assert.deepEqual([...annexB(pic, p, true)], [0, 0, 0, 1, ...SPS, 0, 0, 0, 1, ...PPS, 0, 0, 0, 1, 0x65, 1, 2, 3, 0, 0, 0, 1, 0x06, 9]);
  assert.deepEqual([...annexB(nal([0x41, 7]), p, false)], [0, 0, 0, 1, 0x41, 7]);
  assert.throws(() => annexB(new Uint8Array([0, 0, 0, 9, 0x41]), p, false), /not whole/);
});

test('avi writes RIFF AVI with hdrl, movi and idx1, and the index points at each chunk', () => {
  const samples = [0, 1, 2, 3].map((i) => ({ data: nal([i ? 0x41 : 0x65, i]), t: i * 100000, key: i === 0 }));
  const sound = { rate: 48000, channels: [new Float32Array(48000 + 100).fill(0.5), new Float32Array(48000 + 100).fill(-0.5)] };
  const r = avi({ codec: 'avc1.42c01e', width: 64, height: 48, description: AVCC, samples }, 10, sound), b = r.bytes;
  assert.equal(ascii(b, 0, 4), 'RIFF'); assert.equal(u32(b, 4), b.length - 8); assert.equal(ascii(b, 8, 4), 'AVI ');
  assert.equal(r.pictures, 4); assert.equal(r.gaps, 0); assert.equal(r.rate, 10);
  const top = chunks(b, 12, b.length);
  assert.deepEqual(top.map((c) => c[0]), ['LIST', 'LIST', 'idx1']);
  const [hdrl, movi, idx1] = top;
  assert.equal(ascii(b, hdrl[1], 4), 'hdrl'); assert.equal(ascii(b, movi[1], 4), 'movi');
  // avih: 100000 us a picture, 4 pictures, 2 streams, 64 x 48
  const h = chunks(b, hdrl[1] + 4, hdrl[1] + hdrl[2]); assert.equal(h[0][0], 'avih');
  assert.equal(u32(b, h[0][1]), 100000); assert.equal(u32(b, h[0][1] + 16), 4); assert.equal(u32(b, h[0][1] + 24), 2);
  assert.equal(u32(b, h[0][1] + 32), 64); assert.equal(u32(b, h[0][1] + 36), 48);
  // the video stream: vids, H264, rate 10000 / scale 1000; the sound stream: auds, PCM (tag 1), 2 channels, 48 kHz, 16 bits
  const strl = h.slice(1).map((c) => chunks(b, c[1] + 4, c[1] + c[2]));
  assert.equal(ascii(b, strl[0][0][1], 4), 'vids'); assert.equal(ascii(b, strl[0][0][1] + 4, 4), 'H264');
  assert.equal(u32(b, strl[0][0][1] + 20), 1000); assert.equal(u32(b, strl[0][0][1] + 24), 10000); assert.equal(u32(b, strl[0][0][1] + 32), 4);
  assert.equal(ascii(b, strl[0][1][1] + 16, 4), 'H264');
  const wf = new DataView(b.buffer, strl[1][1][1]);
  assert.equal(ascii(b, strl[1][0][1], 4), 'auds');
  assert.deepEqual([wf.getUint16(0, true), wf.getUint16(2, true), wf.getUint32(4, true), wf.getUint16(12, true), wf.getUint16(14, true)], [1, 2, 48000, 4, 16]);
  // movi: 4 pictures, 2 sound chunks (1 s and the 100 samples left), and the index lists each at its offset from the 'movi' word
  const m = chunks(b, movi[1] + 4, movi[1] + movi[2]);
  assert.equal(m.filter((c) => c[0] === '00dc').length, 4); assert.equal(m.filter((c) => c[0] === '01wb').length, 2);
  assert.equal(m.filter((c) => c[0] === '01wb').reduce((a, c) => a + c[2], 0), (48000 + 100) * 4);
  const ix = []; for (let p = idx1[1]; p < idx1[1] + idx1[2]; p += 16) ix.push([ascii(b, p, 4), u32(b, p + 4), u32(b, p + 8), u32(b, p + 12)]);
  assert.equal(ix.length, m.length);
  ix.forEach(([id, flags, off, size], i) => { assert.equal(id, m[i][0]); assert.equal(movi[1] + off + 8, m[i][1]); assert.equal(size, m[i][2]); });
  assert.deepEqual(ix.filter((x) => x[0] === '00dc').map((x) => x[1]), [0x10, 0, 0, 0]);
  // the first picture is a key picture with the SPS and PPS before it; the sound is 16-bit: 0.5 is 16384 (0.5 x 32767, rounded)
  const p0 = m.find((c) => c[0] === '00dc'); assert.deepEqual([...b.subarray(p0[1], p0[1] + 8)], [0, 0, 0, 1, ...SPS]);
  const a0 = m.find((c) => c[0] === '01wb'), s = new DataView(b.buffer, a0[1]); assert.deepEqual([s.getInt16(0, true), s.getInt16(2, true)], [16384, -16384]);
});

test('a gap in the picture times becomes empty chunks that hold the last picture, so the time stays right', () => {
  const samples = [0, 1, 4].map((i) => ({ data: nal([0x41, i]), t: i * 100000, key: i === 0 }));
  const r = avi({ codec: 'avc1.42c01e', width: 16, height: 16, description: AVCC, samples }, 10);
  assert.equal(r.pictures, 5); assert.equal(r.gaps, 2);
  const top = chunks(r.bytes, 12, r.bytes.length), m = chunks(r.bytes, top[1][1] + 4, top[1][1] + top[1][2]);
  assert.deepEqual(m.map((c) => c[2] > 0), [true, true, false, false, true]);
  assert.equal(chunks(r.bytes, top[0][1] + 4, top[0][1] + top[0][2]).length, 2); // avih and one strl: no sound stream
});

test('avi takes H.264 only, and says so', () => {
  assert.throws(() => avi({ codec: 'vp09.00.41.08', width: 16, height: 16, description: null, samples: [] }, 30), /H.264 pictures only/);
  assert.equal(AVI_LIMIT, 0x7fff0000);
});
