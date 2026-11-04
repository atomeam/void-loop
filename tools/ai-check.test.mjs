// lib/ai-check.js: what a photo or video says about who made it (the first feature Verse built from what it watched, domains/tv-built/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, crc32 } from 'node:zlib';
import { checkFile, kindOf, textOf, toolsOf, quicktimeKeys, reportOf } from '../void-live-deploy/lib/ai-check.js';

const enc = (s) => Buffer.from(s, 'latin1');
const be = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const chunk = (type, data) => Buffer.concat([be(data.length), enc(type), data, be(crc32(Buffer.concat([enc(type), data])))]);
/** a real 2x2 PNG, with text chunks and picture data of our choosing */
function png(texts = [], idat = deflateSync(Buffer.from([0, 255, 0, 0, 0, 255, 0, 0])), extra = []) {
  const ihdr = Buffer.concat([be(2), be(2), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...texts.map(([k, v]) => chunk('tEXt', enc(k + '\0' + v))), chunk('IDAT', idat), ...extra, chunk('IEND', Buffer.alloc(0))]);
}
/** a JPEG with one APP1 XMP segment, then picture data of our choosing */
function jpeg(xmp, picture = Buffer.from([1, 2, 3])) {
  const body = enc('http://ns.adobe.com/xap/1.0/\0' + xmp);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body, Buffer.from([0xff, 0xda, 0, 2]), picture, Buffer.from([0xff, 0xd9])]);
}
const box = (type, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([be(body.length + 8), enc(type), body]); };

test('a Stable Diffusion PNG is AI: its settings chunk names steps, sampler and CFG scale', () => {
  const r = checkFile(png([['parameters', 'a lighthouse at dusk\nSteps: 30, Sampler: DPM++ 2M, CFG scale: 7, Seed: 1, Model: sd_xl_base_1.0']]), 'lighthouse.png');
  assert.equal(r.kind, 'png'); assert.equal(r.verdict, 'ai');
  assert.ok(r.signals.some((s) => /Stable Diffusion settings/.test(s.label)));
});

test('a JPEG whose XMP says trainedAlgorithmicMedia and names Firefly is AI, with the tool named', () => {
  const r = checkFile(jpeg('<x:xmpmeta><rdf:Description xmp:CreatorTool="Adobe Firefly" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></x:xmpmeta>'));
  assert.equal(r.verdict, 'ai');
  assert.deepEqual(r.signals.filter((s) => s.level === 'ai').map((s) => s.label), ['Made by an AI generator', 'Names an AI generator: Adobe Firefly']);
  assert.deepEqual(r.tools, [{ where: 'XMP creator tool', value: 'Adobe Firefly' }]);
});

test('an AI fill in Photoshop is AI-edited, not AI-generated', () => {
  const r = checkFile(jpeg('<x:xmpmeta Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia" stEvt:action="saved" stEvt:softwareAgent="Adobe Photoshop 25.0"/>'));
  assert.equal(r.verdict, 'ai-edited');
  assert.ok(r.signals.some((s) => s.label === 'Saved by Adobe Photoshop'));
});

test('a generator name inside the picture data is never read: no false alarm from random bytes', () => {
  const noisy = enc('xxgrok veo1 midjourney Steps: 3 sora kling ai photoshop'.repeat(50));
  assert.equal(checkFile(jpeg('<x:xmpmeta/>', noisy)).verdict, 'unknown');
  assert.equal(checkFile(png([], deflateSync(Buffer.alloc(8)), [chunk('IDAT', noisy)])).verdict, 'unknown');
  assert.ok(!textOf(jpeg('', noisy)).includes('midjourney'));
});

test('a file with no metadata at all says so, and says it is not proof', () => {
  const r = checkFile(png());
  assert.equal(r.verdict, 'unknown'); assert.match(r.headline, /No provenance at all/);
  assert.match(reportOf(r, '2026-11-04T00:00:00Z'), /no signs is not proof/);
});

test('an MP4 re-encoded by FFmpeg is edited; the mdat payload is skipped', () => {
  const ilstToo = box('udta', box('meta', Buffer.alloc(4), box('ilst', box('\u00a9too', box('data', be(1), be(0), enc('Lavf60.3.100'))))));
  const mp4 = Buffer.concat([box('ftyp', enc('isom'), be(512), enc('isomiso2mp41')), box('moov', ilstToo), box('mdat', enc('midjourney grok veo1 '.repeat(20)))]);
  assert.equal(kindOf(new Uint8Array(mp4)), 'mp4');
  const r = checkFile(mp4, 'clip.mp4');
  assert.equal(r.verdict, 'edited'); assert.deepEqual(r.tools, [{ where: 'Video encoder', value: 'Lavf60.3.100' }]);
});

test('a phone video names its maker through QuickTime keys and reads as camera-original', () => {
  const keys = box('keys', be(0), be(2), box('mdta', enc('com.apple.quicktime.make')), box('mdta', enc('com.apple.quicktime.model')));
  const ilst = box('ilst', box('\0\0\0\u0001', box('data', be(1), be(0), enc('Apple'))), box('\0\0\0\u0002', box('data', be(1), be(0), enc('iPhone 15 Pro'))));
  const mov = Buffer.concat([box('ftyp', enc('qt  '), be(0)), box('moov', box('meta', box('hdlr', Buffer.alloc(24)), keys, ilst)), box('mdat', Buffer.alloc(64))]);
  assert.deepEqual(quicktimeKeys(textOf(new Uint8Array(mov), 'mov')), { 'com.apple.quicktime.make': 'Apple', 'com.apple.quicktime.model': 'iPhone 15 Pro' });
  const r = checkFile(mov);
  assert.equal(r.kind, 'mov'); assert.equal(r.verdict, 'camera'); assert.equal(r.signals[0].label, 'Camera: Apple iPhone 15 Pro');
});

test('Content Credentials: present, or pointed to and removed', () => {
  assert.ok(checkFile(jpeg('<x:xmpmeta/> jumd\0\0\0\0c2pa\0 c2pa.actions c2pa.created')).signals.some((s) => /C2PA\) inside/.test(s.label)));
  const removed = checkFile(jpeg('<rdf:Description dcterms:provenance="self#jumbf=/c2pa/adobe:urn:uuid:5f5b/c2pa.claim"/>'));
  assert.equal(removed.verdict, 'edited'); assert.ok(removed.signals.some((s) => s.label === 'Content Credentials were removed'));
});

test('toolsOf reads XMP attributes and elements, and a PNG Software text', () => {
  assert.deepEqual(toolsOf('<xmp:CreatorTool>GIMP 2.10</xmp:CreatorTool>').map((x) => x.value), ['GIMP 2.10']);
  const r = checkFile(png([['Software', 'Midjourney v6']]));
  assert.equal(r.verdict, 'ai'); assert.ok(r.signals.some((s) => s.label === 'Names an AI generator: Midjourney'));
});
