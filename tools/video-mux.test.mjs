// tests for lib/video-mux.js: the MP4 and WebM files Verse writes from coded frames and sound, read back box by box and element by element
import test from 'node:test';
import assert from 'node:assert/strict';
import { mp4, webm, webmWithDuration, opusHeadOf, opusHead, avcCodecs, bitrateOf, evenSize } from '../void-live-deploy/lib/video-mux.js';

const be32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const type = (b, at) => String.fromCharCode(...b.subarray(at + 4, at + 8));
function boxes(b, from = 0, to = b.length) { const o = []; let at = from; while (at + 8 <= to) { const size = be32(b, at); o.push({ type: type(b, at), at, size }); if (size < 8) break; at += size; } return o; }
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf']);
function find(b, path, from = 0, to = b.length) {
  const [head, ...rest] = path; const hit = boxes(b, from, to).filter((x) => x.type === head);
  if (!rest.length) return hit; return hit.flatMap((x) => find(b, rest, x.at + 8, x.at + x.size));
}
// a frame whose first bytes say which frame it is, so an offset can be checked by what it points at
const frame = (k, n, key) => ({ data: Uint8Array.from({ length: n }, (_, i) => (i < 2 ? [0xf0 | (k >> 8), k & 255][i] : 7)), t: k * 33333, d: 33333, key });
const AVCC = Uint8Array.from([1, 0x42, 0xe0, 0x1f, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0xe0, 0x1f, 1, 0, 2, 0x68, 0xce]);
const OPUS_HEAD = opusHead({ channels: 2, preSkip: 312, rate: 48000, gain: 0 });

test('MP4: ftyp, the index first, then the data; every sample where the index says', () => {
  const video = { codec: 'avc1.42e01f', width: 640, height: 360, description: AVCC, samples: Array.from({ length: 90 }, (_, k) => frame(k, 100 + k, k % 30 === 0)) };
  const audio = { codec: 'opus', rate: 48000, channels: 2, description: OPUS_HEAD, samples: Array.from({ length: 150 }, (_, k) => ({ data: Uint8Array.of(0xa0, k & 255, 1, 2), t: k * 20000, d: 20000, key: true })) };
  const b = mp4(video, audio), top = boxes(b);
  assert.deepEqual(top.map((x) => x.type), ['ftyp', 'moov', 'mdat']);
  assert.equal(top.reduce((a, x) => a + x.size, 0), b.length);
  const traks = find(b, ['moov', 'trak']); assert.equal(traks.length, 2);
  const co = find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'co64']), sz = find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsz']);
  // video: each offset points at the frame with that number
  const vco = co[0].at + 16, vsz = sz[0].at + 20;
  for (let k = 0; k < 90; k++) { const off = be32(b, vco + 8 * k + 4); assert.equal(b[off], 0xf0); assert.equal(b[off + 1], k); assert.equal(be32(b, vsz + 4 * k), 100 + k); }
  // sound: dOps is big-endian (pre-skip 312 = 0x0138)
  const dops = b.indexOf(0x64, find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd'])[1].at); assert.ok(dops > 0);
  const at = [...b].findIndex((_, i) => type(b, i - 4) === 'dOps'); assert.ok(at > 0); assert.equal((b[at + 6] << 8) | b[at + 7], 312);
  // key frames: 0, 30, 60 (1-based 1, 31, 61)
  const stss = find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stss']); assert.equal(stss.length, 1); assert.deepEqual([0, 1, 2].map((i) => be32(b, stss[0].at + 16 + 4 * i)), [1, 31, 61]);
  // stts: 90 frames of 3000 ticks at 90000 a second
  const stts = find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stts'])[0], runs = be32(b, stts.at + 12); let n = 0, ticks = 0; for (let r = 0; r < runs; r++) { const c = be32(b, stts.at + 16 + 8 * r), d = be32(b, stts.at + 20 + 8 * r); n += c; ticks += c * d; assert.ok(d === 2999 || d === 3000); } assert.equal(n, 90); assert.ok(Math.abs(ticks - Math.round(90 * 33333 * 0.09)) <= 1);
  assert.equal(String.fromCharCode(...b.subarray(find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd'])[0].at + 20, find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd'])[0].at + 24)), 'avc1');
});

test('MP4: AAC sound has an esds with the AudioSpecificConfig; VP9 video has a vpcC', () => {
  const a = mp4(null, { codec: 'mp4a.40.2', rate: 48000, channels: 2, description: Uint8Array.of(0x11, 0x90), bitrate: 128000, samples: [{ data: Uint8Array.of(1, 2, 3), t: 0, d: 21333, key: true }] });
  const s = Buffer.from(a).toString('latin1'); assert.ok(s.includes('mp4a') && s.includes('esds')); assert.ok(s.includes('\x05\x02\x11\x90'));
  const v = mp4({ codec: 'vp09.00.41.08', width: 320, height: 240, description: null, samples: [frame(0, 10, true)] });
  const t = Buffer.from(v).toString('latin1'); assert.ok(t.includes('vp09') && t.includes('vpcC'));
  assert.throws(() => mp4(null, null), /nothing to write/);
  assert.throws(() => mp4({ codec: 'hvc1', width: 2, height: 2, samples: [frame(0, 4, true)] }), /cannot put hvc1/);
});

// EBML: an id (its length is in its first byte), a size, the body
function ebml(b, from = 0, to = b.length) {
  const o = []; let at = from;
  while (at < to) {
    if (!b[at]) throw new Error('not an EBML element at ' + at);
    let il = 1; while (!(b[at] & (0x80 >> (il - 1)))) il++; let id = 0; for (let k = 0; k < il; k++) id = id * 256 + b[at + k];
    const s = at + il; let sl = 1; while (!(b[s] & (0x80 >> (sl - 1)))) sl++; let size = b[s] & (0xff >> sl); for (let k = 1; k < sl; k++) size = size * 256 + b[s + k];
    o.push({ id, at, body: s + sl, size }); at = s + sl + size;
  }
  return o;
}
const uintOf = (b, e) => { let v = 0; for (let k = 0; k < e.size; k++) v = v * 256 + b[e.body + k]; return v; };

test('WebM: EBML header, one Segment, Cues that point at Clusters, a Cluster at each key frame', () => {
  const video = { codec: 'vp09.00.41.08', width: 640, height: 360, samples: Array.from({ length: 90 }, (_, k) => frame(k, 50, k % 30 === 0)) };
  const audio = { codec: 'opus', rate: 48000, channels: 2, description: OPUS_HEAD, samples: Array.from({ length: 150 }, (_, k) => ({ data: Uint8Array.of(0xa0, k & 255), t: k * 20000, d: 20000, key: true })) };
  const b = webm(video, audio), top = ebml(b);
  assert.deepEqual(top.map((e) => e.id), [0x1a45dfa3, 0x18538067]); assert.equal(top[1].body + top[1].size, b.length);
  const seg = ebml(b, top[1].body, b.length), ids = seg.map((e) => e.id);
  assert.deepEqual(ids.slice(0, 4), [0x114d9b74, 0x1549a966, 0x1654ae6b, 0x1c53bb6b]);
  const clusters = seg.filter((e) => e.id === 0x1f43b675); assert.equal(clusters.length, 3);
  const cues = ebml(b, seg[3].body, seg[3].body + seg[3].size); assert.equal(cues.length, 3);
  const clusterAt = new Map(clusters.map((c) => [c.at - top[1].body, c]));
  for (const cp of cues) {
    const [time, pos] = ebml(b, cp.body, cp.body + cp.size), tp = ebml(b, pos.body, pos.body + pos.size), c = clusterAt.get(uintOf(b, tp[1]));
    assert.ok(c, 'a cue points at a cluster'); assert.equal(uintOf(b, ebml(b, c.body, c.body + c.size)[0]), uintOf(b, time)); // the cluster's time is the cue's
  }
  assert.deepEqual(cues.map((cp) => uintOf(b, ebml(b, cp.body, cp.body + cp.size)[0])), [0, 1000, 2000]);
  // every block is in a cluster; 90 video + 150 sound
  let blocks = 0; for (const c of clusters) blocks += ebml(b, c.body, c.body + c.size).filter((e) => e.id === 0xa3).length; assert.equal(blocks, 240);
  const s = Buffer.from(b).toString('latin1'); assert.ok(s.includes('V_VP9') && s.includes('A_OPUS') && s.includes('OpusHead'));
  assert.throws(() => webm({ codec: 'avc1.42e01f', width: 2, height: 2, samples: [frame(0, 4, true)] }), /cannot put avc1/);
});

test('WebM: a recorder file with no length gets one; one that has it is left as it was', () => {
  const b = webm(null, { codec: 'opus', rate: 48000, channels: 1, samples: [{ data: Uint8Array.of(1), t: 0, d: 20000, key: true }] });
  assert.equal(webmWithDuration(b, 5000), b); // it has a Duration already
  // a recorder's Info: no Duration
  const info = Uint8Array.of(0x15, 0x49, 0xa9, 0x66, 0x83, 0x2a, 0xd7, 0xb1), rec = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, ...info.subarray(0, 4), 0x84, 0x2a, 0xd7, 0xb1, 0x80, 0xa3, 0x80);
  const out = webmWithDuration(rec, 5008), at = out.indexOf(0x44); assert.ok(out.length === rec.length + 11); assert.equal(out[at + 1], 0x89);
  assert.equal(new DataView(out.buffer, out.byteOffset + at + 3, 8).getFloat64(0), 5008);
});

test('codecs and sizes: H.264 level by picture size, even sides, a bit rate by quality', () => {
  assert.equal(avcCodecs(640, 360)[0], 'avc1.42e01f'); assert.equal(avcCodecs(1920, 1080)[0], 'avc1.42e028'); assert.equal(avcCodecs(3840, 2160)[0], 'avc1.42e033');
  assert.deepEqual(evenSize(853, 481), { width: 854, height: 482 }); assert.deepEqual(evenSize(3840, 2160, 1280), { width: 1280, height: 720 });
  assert.ok(bitrateOf(1280, 720, 30, 'high') > bitrateOf(1280, 720, 30, 'small'));
  assert.deepEqual(opusHeadOf(OPUS_HEAD), { channels: 2, preSkip: 312, rate: 48000, gain: 0, family: 0 });
});

test('MOV and MKV: the same boxes and elements with the QuickTime brand and the matroska doctype', () => {
  const v = { codec: 'avc1.42e01f', width: 64, height: 64, description: AVCC, samples: [frame(0, 10, true)] };
  const mov = mp4(v, null, { qt: true }); assert.equal(type(mov, 0), 'ftyp'); assert.equal(String.fromCharCode(...mov.subarray(8, 12)), 'qt  ');
  assert.deepEqual(boxes(mov).map((x) => x.type), ['ftyp', 'moov', 'mdat']);
  const mkv = webm({ codec: 'vp09.00.41.08', width: 64, height: 64, samples: [frame(0, 10, true)] }, null, { mkv: true });
  const s = Buffer.from(mkv).toString('latin1'); assert.ok(s.includes('matroska') && !s.includes('webm'));
  assert.ok(!Buffer.from(webm({ codec: 'vp09.00.41.08', width: 64, height: 64, samples: [frame(0, 10, true)] })).toString('latin1').includes('matroska'));
});
