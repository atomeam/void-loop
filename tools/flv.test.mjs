// The FLV writer of /converter/ (void-live-deploy/lib/flv.js): the header, the onMetaData tag, the AVC and AAC set-up tags, the pictures and
// the sound in time order, each tag followed by its size, and 16-bit PCM at 44.1 kHz where there is no AAC. A real FLV, made in a browser from
// a real video, was also opened and decoded with ffprobe and ffmpeg (see the PR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flv, metaData, PCM_RATE } from '../void-live-deploy/lib/flv.js';

const AVCC = new Uint8Array([1, 0x42, 0xc0, 0x1e, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0xc0, 0x1e, 1, 0, 2, 0x68, 0xce]);
const ASC = new Uint8Array([0x11, 0x90]); // AAC LC, 48 kHz, 2 channels
const pic = (i) => new Uint8Array([0, 0, 0, 2, i ? 0x41 : 0x65, i]);
const video = (n = 3) => ({ codec: 'avc1.42c01e', width: 64, height: 48, description: AVCC, samples: Array.from({ length: n }, (_, i) => ({ data: pic(i), t: 1000 + i * 100000, key: i === 0 })) });
const be24 = (b, at) => (b[at] << 16) | (b[at + 1] << 8) | b[at + 2];
const be32 = (b, at) => new DataView(b.buffer, b.byteOffset).getUint32(at);

/** the tags of an FLV as { type, ms, data }, checking each PreviousTagSize on the way */
function tags(b) {
  const out = []; let p = 9; assert.equal(be32(b, p), 0); p += 4;
  while (p < b.length) {
    const type = b[p], n = be24(b, p + 1), ms = be24(b, p + 4) | (b[p + 7] << 24);
    out.push({ type, ms, data: b.subarray(p + 11, p + 11 + n) }); p += 11 + n;
    assert.equal(be32(b, p), 11 + n, 'the size after each tag'); p += 4;
  }
  assert.equal(p, b.length); return out;
}

test('metaData writes an AMF0 onMetaData ECMA array of numbers and booleans', () => {
  const m = metaData({ duration: 1.5, stereo: true });
  assert.deepEqual([...m.subarray(0, 13)], [2, 0, 10, ...new TextEncoder().encode('onMetaData')]);
  assert.equal(m[13], 8); assert.equal(be32(m, 14), 2);
  assert.deepEqual([...m.subarray(m.length - 3)], [0, 0, 9]);
});

test('flv with AAC: header, script tag, the AVC and AAC set-up tags, then pictures and sound by time, and the end of sequence', () => {
  const aac = { codec: 'mp4a.40.2', rate: 48000, channels: 2, description: ASC, samples: [0, 1, 2, 3].map((i) => ({ data: new Uint8Array([9, i]), t: 500 + i * 21333, d: 21333 })) };
  const r = flv(video(), 10, aac), b = r.bytes;
  assert.equal(r.sound, 'aac');
  assert.deepEqual([...b.subarray(0, 9)], [0x46, 0x4c, 0x56, 1, 5, 0, 0, 0, 9]);
  const t = tags(b);
  assert.equal(t[0].type, 18);
  assert.deepEqual([t[1].type, ...t[1].data.subarray(0, 5)], [9, 0x17, 0, 0, 0, 0]); assert.deepEqual([...t[1].data.subarray(5)], [...AVCC]);
  assert.deepEqual([t[2].type, ...t[2].data], [8, 0xaf, 0, ...ASC]);
  const body = t.slice(3, -1);
  assert.deepEqual(body.map((x) => x.ms), [...body.map((x) => x.ms)].sort((x, y) => x - y), 'in time order');
  const pics = body.filter((x) => x.type === 9), snd = body.filter((x) => x.type === 8);
  assert.deepEqual(pics.map((x) => x.ms), [0, 100, 200]); assert.deepEqual(pics.map((x) => x.data[0]), [0x17, 0x27, 0x27]);
  assert.deepEqual([...pics[1].data.subarray(1, 5)], [1, 0, 0, 0]); assert.deepEqual([...pics[1].data.subarray(5)], [...pic(1)], 'the picture as the encoder gave it');
  assert.deepEqual(snd.map((x) => x.ms), [0, 21, 43, 64]); assert.deepEqual([...snd[1].data], [0xaf, 1, 9, 1]);
  assert.equal(body[0].type, 8, 'at one time the sound goes first');
  assert.deepEqual([t[t.length - 1].type, ...t[t.length - 1].data], [9, 0x17, 2, 0, 0, 0]);
});

test('flv with PCM: 44.1 kHz, 16-bit little end, cut into tags of 4096 frames', () => {
  const n = 4096 + 10, pcm = { rate: PCM_RATE, channels: [new Float32Array(n).fill(0.5), new Float32Array(n).fill(-1)] };
  const r = flv(video(2), 30, null, pcm); assert.equal(r.sound, 'pcm');
  const snd = tags(r.bytes).filter((x) => x.type === 8);
  assert.equal(snd.length, 2); assert.equal(snd[0].data[0], 0x3f); assert.equal(snd[0].data.length, 1 + 4096 * 4); assert.equal(snd[1].data.length, 1 + 10 * 4);
  assert.deepEqual(snd.map((x) => x.ms), [0, 93]);
  const d = new DataView(snd[0].data.buffer, snd[0].data.byteOffset + 1); assert.deepEqual([d.getInt16(0, true), d.getInt16(2, true)], [16384, -32768]);
});

test('flv with no sound says so in the header, and takes H.264 and 44.1 kHz PCM only', () => {
  const r = flv(video(), 10); assert.equal(r.sound, null); assert.equal(r.bytes[4], 1);
  assert.equal(tags(r.bytes).filter((x) => x.type === 8).length, 0);
  assert.throws(() => flv({ ...video(), codec: 'vp09.00.41.08' }, 30), /H.264 pictures only/);
  assert.throws(() => flv(video(), 30, null, { rate: 48000, channels: [new Float32Array(4)] }), /44.1 kHz/);
});
