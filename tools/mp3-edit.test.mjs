// tests for lib/mp3-edit.js: MPEG audio frame headers, the ID3v2 tag read and written, and a cover picture put in without coding the sound again
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/lib/mp3-edit.js';

// n frames of MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo, no padding: 417 bytes each. The bodies are zero (side information all 0: silence).
const frames = (n) => { const f = new Uint8Array(417); f.set([0xff, 0xfb, 0x90, 0x00]); const o = new Uint8Array(417 * n); for (let i = 0; i < n; i++) o.set(f, i * 417); return o; };
const cat = (...p) => { const o = new Uint8Array(p.reduce((a, x) => a + x.length, 0)); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; };
const text = (id, s) => ({ id, flags: 0, data: cat(Uint8Array.of(0), new TextEncoder().encode(s)) });
const JPG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9);

test('frame headers: MPEG-1 Layer III at 128 kbps and 44.1 kHz is 417 bytes; two frames in a row are needed to call it MP3', () => {
  const h = M.header(frames(1), 0);
  assert.deepEqual({ v: h.version, rate: h.rate, kbps: h.kbps, bytes: h.bytes, ch: h.channels, s: h.samples }, { v: 3, rate: 44100, kbps: 128, bytes: 417, ch: 2, s: 1152 });
  assert.equal(M.header(Uint8Array.of(0xff, 0xfb, 0xf0, 0), 0), null, 'bit-rate index 15 is not allowed');
  assert.equal(M.header(Uint8Array.of(0xff, 0xfd, 0x90, 0), 0), null, 'Layer II is not Layer III');
  const noise = cat(Uint8Array.of(0xff, 0xfb, 0x90, 0, 9, 9), frames(3));
  assert.equal(M.firstFrame(noise).at, 6, 'a false sync with no frame after it is passed over');
});

test('a cover goes into a file with no tag: an ID3v2.3 tag with one APIC frame, then the same frames', () => {
  const mp3 = frames(10), r = M.addCover(mp3, JPG, 'image/jpeg'), tag = M.readTag(r.bytes);
  assert.equal(tag.version, 3); assert.equal(tag.frames.length, 1); assert.equal(tag.frames[0].id, 'APIC');
  const d = tag.frames[0].data; assert.equal(d[0], 0); assert.equal(new TextDecoder().decode(d.subarray(1, 11)), 'image/jpeg'); assert.equal(d[12], 3, 'front cover');
  assert.deepEqual(Array.from(d.subarray(14)), Array.from(JPG));
  assert.deepEqual(r.bytes.subarray(tag.end), mp3, 'the sound bytes are unchanged');
  assert.match(r.notes.join(' '), /not coded again/);
});

test('a v2.3 tag keeps its title and artist; its old cover is replaced, not doubled', () => {
  const old = M.writeTag([text('TIT2', 'Song'), text('TPE1', 'Band'), { id: 'APIC', flags: 0, data: M.apic(Uint8Array.of(1, 2), 'image/png') }], 3);
  const r = M.addCover(cat(old, frames(4)), JPG, 'image/jpeg'), tag = M.readTag(r.bytes);
  assert.deepEqual(tag.frames.map((f) => f.id), ['TIT2', 'TPE1', 'APIC']);
  assert.equal(new TextDecoder().decode(tag.frames[0].data.subarray(1)), 'Song');
  assert.match(r.notes.join(' '), /replaced/); assert.match(r.notes.join(' '), /2 other tag fields kept/);
});

test('a v2.4 tag stays v2.4, with syncsafe frame sizes; a v2.2 tag keeps its common text as v2.3', () => {
  const big = new Uint8Array(300).fill(7), v4 = M.writeTag([text('TIT2', 'x'.repeat(200))], 4);
  const r = M.addCover(cat(v4, frames(2)), big, 'image/png'), t = M.readTag(r.bytes);
  assert.equal(t.version, 4); assert.equal(t.frames[0].data.length, 201); assert.equal(t.frames[1].data.length, 1 + 9 + 1 + 1 + 1 + 300);
  // a v2.2 tag: 3-letter ids and 3-byte sizes
  const t2 = cat(new TextEncoder().encode('TT2'), Uint8Array.of(0, 0, 3, 0, 0x48, 0x69), new TextEncoder().encode('XYZ'), Uint8Array.of(0, 0, 1, 5));
  const v2 = cat(Uint8Array.of(0x49, 0x44, 0x33, 2, 0, 0, 0, 0, 0, t2.length), t2);
  const r2 = M.addCover(cat(v2, frames(2)), JPG, 'image/jpeg'), t3 = M.readTag(r2.bytes);
  assert.equal(t3.version, 3); assert.deepEqual(t3.frames.map((f) => f.id), ['TIT2', 'APIC']); assert.match(r2.notes.join(' '), /1 tag field Verse cannot carry over/);
});

test('not an MP3, or a cover that is not JPEG or PNG: a plain error', () => {
  assert.throws(() => M.addCover(new TextEncoder().encode('hello there, this is text'), JPG, 'image/jpeg'), /not an MP3/);
  assert.throws(() => M.addCover(frames(2), JPG, 'image/gif'), /JPEG or a PNG/);
});
