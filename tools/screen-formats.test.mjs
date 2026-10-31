// Screen resolution answers carry their standard (2026-10-30). Before, 720p, 1080p and 4K had no source, and "how many pixels in 2k"
// answered 2560 × 1440. ITU-R BT.1847-1 gives 1280 × 720; ITU-R BT.2100-2 table 1 gives 1920 × 1080, 3840 × 2160 and 7680 × 4320;
// the DCI Digital Cinema System Specification 1.4.2, section 4.3.1, gives 2048 × 1080 for 2K and 4096 × 2160 for 4K. All read
// 2026-10-30. 1440p has no such standard here, so it keeps no source and says how its width comes (1440 lines at 16:9).
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const BT1847 = 'https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1847-1-201506-I!!PDF-E.pdf';
const BT2100 = 'https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.2100-2-201807-S!!PDF-E.pdf';
const DCI = 'https://dcss.dcimovies.com/0c0cff34d231b516cb89ae3fad352d5cf37a9515/dcss.pdf';

test('720p, 1080p and 4K cite their standard', () => {
  let r = ask('what is 720p'); assert.equal(r.value, '1280 × 720'); assert.equal(links(r), JSON.stringify([BT1847])); assert.match(r.note, /921,600 pixels/); assert.equal(1280 * 720, 921600);
  r = ask('what is 1080p'); assert.equal(r.value, '1920 × 1080'); assert.equal(links(r), JSON.stringify([BT2100])); assert.equal(1920 * 1080, 2073600);
  r = ask('what is 4k resolution'); assert.equal(r.value, '3840 × 2160'); assert.equal(links(r), JSON.stringify([BT2100, DCI])); assert.match(r.note, /4096 × 2160/);
  for (const q of ['what is 720p', 'what is 1080p', 'what is 4k resolution']) assert.equal(ask(q).read, '2026-10-30', q);
});

test('pixel counts come from the same standards, and 2K is the DCI size', () => {
  const cases = [['how many pixels in 720p', '921,600', BT1847], ['how many pixels in 1080p', '2,073,600', BT2100], ['how many pixels in 4k', '8,294,400', BT2100], ['how many megapixels is 8k', '33.2 MP', BT2100], ['how many pixels in 2k', '2,211,840', DCI]];
  for (const [q, v, u] of cases) { const r = ask(q); assert.equal(r.value, v, q); assert.equal(links(r), JSON.stringify([u]), q); assert.equal(r.read, '2026-10-30', q); }
  assert.equal(2048 * 1080, 2211840); assert.equal(3840 * 2160, 8294400); assert.equal(Math.round(7680 * 4320 / 1e5) / 10, 33.2);
  assert.match(ask('how many pixels in 2k').note, /2048 × 1080, the DCI cinema 2K container/);
});

test('1440p keeps no source and shows where its width comes from', () => {
  const r = ask('how many pixels in 1440p');
  assert.equal(r.value, '3,686,400'); assert.equal(r.src, undefined); assert.equal(1440 * 16 / 9, 2560); assert.match(r.note, /1440 lines at 16:9/);
});
