import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readExif, exifDate, whenOf, byDay, places, search, albums, summary, monthLabel } from '../void-live-deploy/lib/photo-library.js';
import skill, { photosAsk, thumbSize, sharedName } from '../void-live-deploy/skills/photos.js';
import { stripMeta } from '../void-live-deploy/lib/safety.js';

// a JPEG with an EXIF block, built by hand: IFD0 (Orientation, DateTime, ExifIFD, GPS IFD), the Exif IFD (DateTimeOriginal), the GPS IFD
function jpeg({ le = true, original = '2024:06:15 18:30:05', dateTime = '2020:01:01 00:00:00', lat = [51, 30, 0], latRef = 'N', lon = [0, 7, 30], lonRef = 'W', orientation = 6 } = {}) {
  const t = [];
  const u16 = (v) => (le ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v) => (le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const entry = (tag, type, count, val) => [...u16(tag), ...u16(type), ...u32(count), ...val];
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  // layout: header 8 | IFD0 at 8 (4 entries) = 2+48+4 = 54 -> 62 | DateTime 20 -> 82 | ExifIFD at 82 (1 entry) = 18 -> 100 | original 20 -> 120
  //         GPS IFD at 120 (4 entries) = 54 -> 174 | lat 24 -> 198 | lon 24 -> 222
  t.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  t.push(...u16(4), ...entry(0x0112, 3, 1, [...u16(orientation), 0, 0]), ...entry(0x0132, 2, 20, u32(62)), ...entry(0x8769, 4, 1, u32(82)), ...entry(0x8825, 4, 1, u32(120)), ...u32(0));
  t.push(...ascii(dateTime));
  t.push(...u16(1), ...entry(0x9003, 2, 20, u32(100)), ...u32(0));
  t.push(...ascii(original));
  t.push(...u16(4), ...entry(1, 2, 2, [latRef.charCodeAt(0), 0, 0, 0]), ...entry(2, 5, 3, u32(174)), ...entry(3, 2, 2, [lonRef.charCodeAt(0), 0, 0, 0]), ...entry(4, 5, 3, u32(198)), ...u32(0));
  for (const v of [...lat, ...lon]) t.push(...u32(v), ...u32(1));
  assert.equal(t.length, 222);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...t], len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
}

test('a photo says when, where and which way up, in either byte order', () => {
  for (const le of [true, false]) {
    const e = readExif(jpeg({ le }));
    assert.equal(e.taken, '2024-06-15T18:30:05', 'the original date wins over the file\'s DateTime');
    assert.equal(e.orientation, 6);
    assert.ok(Math.abs(e.lat - 51.5) < 1e-9, String(e.lat));
    assert.ok(Math.abs(e.lon + 0.125) < 1e-9, 'west is negative: ' + e.lon);
  }
  assert.equal(readExif(jpeg({ original: '0000:00:00 00:00:00' })).taken, '2020-01-01T00:00:00', 'a blank original falls back to DateTime');
  assert.deepEqual([readExif(jpeg({ lat: [0, 0, 0], lon: [0, 0, 0] })).lat], [null], 'a 0,0 location is a camera without a fix, not a place');
});

test('broken or foreign bytes read as nothing, never a guess or a throw', () => {
  const blank = { taken: null, lat: null, lon: null, orientation: 1 };
  assert.deepEqual(readExif(new Uint8Array([1, 2, 3, 4, 5])), blank);
  assert.deepEqual(readExif(new Uint8Array(0)), blank);
  const good = jpeg();
  for (const cut of [12, 40, 90, 150, 200]) assert.doesNotThrow(() => readExif(good.subarray(0, cut)), 'cut at ' + cut);
  assert.equal(exifDate('2024:13:01 00:00:00'), null);
});

test('a copy for sharing has no location left in it', () => {
  const out = stripMeta(jpeg());
  assert.equal(out.gps, true);
  const after = readExif(out.bytes);
  assert.equal(after.lat, null); assert.equal(after.taken, null);
  assert.equal(sharedName('beach.jpg'), 'beach-no-location.jpg');
  assert.equal(sharedName('noext'), 'noext-no-location');
});

const lib = [
  { id: 'a', name: 'beach.jpg', taken: '2024-06-15T18:30:05', lat: 51.5, lon: -0.125, album: 'Summer' },
  { id: 'b', name: 'pier.jpg', taken: '2024-06-15T09:00:00', lat: 51.501, lon: -0.124, album: 'Summer', caption: 'the old pier' },
  { id: 'c', name: 'snow.jpg', taken: '2023-12-25T10:00:00' },
  { id: 'd', name: 'scan.png', fileTime: Date.UTC(2025, 2, 3, 12) },
  { id: 'e', name: 'mystery.heic' },
];

test('a library falls into days, newest first, the undated last', () => {
  const days = byDay(lib);
  assert.deepEqual(days.map((d) => d.key), ['2025-03-03', '2024-06-15', '2023-12-25', '']);
  assert.deepEqual(days[1].photos.map((p) => p.id), ['b', 'a'], 'a day reads oldest first');
  assert.equal(days[1].label, 'Saturday, 15 June 2024');
  assert.equal(days[3].label, 'Date unknown');
  assert.equal(whenOf(lib[3]), '2025-03-03T12:00:00', 'no EXIF date: the file\'s own date');
  assert.equal(monthLabel('2024-06-15'), 'June 2024');
});

test('places, albums and the summary line', () => {
  assert.deepEqual(places(lib).map((p) => [p.key, p.count]), [['51.50,-0.13', 2]], 'a street apart, across a grid line: one place');
  assert.equal(places([{ lat: 51.5, lon: -0.12 }, { lat: 48.85, lon: 2.35 }]).length, 2, 'London and Paris are two places');
  assert.deepEqual(albums(lib), [{ name: 'Summer', count: 2, cover: 'a' }]);
  assert.equal(summary(lib), '5 photos · 3 days · 1 place');
  assert.equal(summary([]), '0 photos · 0 days');
});

test('search by year, month, relative dates, album and caption', () => {
  const ids = (q, now) => search(lib, q, now).map((p) => p.id).sort().join('');
  const now = new Date(Date.UTC(2025, 3, 10));
  assert.equal(ids('2024'), 'ab');
  assert.equal(ids('june'), 'ab');
  assert.equal(ids('photos from december 2023'), 'c');
  assert.equal(ids('last year', now), 'ab');
  assert.equal(ids('last month', now), 'd');
  assert.equal(ids('this year', now), 'd');
  assert.equal(ids('summer'), 'ab');
  assert.equal(ids('old pier'), 'b');
  assert.equal(ids('june 2023'), '');
  assert.equal(ids('volcano'), '');
  assert.equal(ids(''), 'abcde');
});

test('the asks that open the library, and the ones that are not it', () => {
  assert.deepEqual(photosAsk('my photos'), { query: '' });
  assert.deepEqual(photosAsk('Show my pictures from June 2024?'), { query: 'june 2024' });
  assert.deepEqual(photosAsk('photos from last year'), { query: 'last year' });
  assert.deepEqual(photosAsk('my verse photos'), { query: '' });
  assert.deepEqual(photosAsk('my void photos'), { query: '' });
  assert.deepEqual(photosAsk('add photos'), { add: true, query: '' });
  assert.deepEqual(photosAsk('upload my photos to verse'), { add: true, query: '' });
  assert.deepEqual(photosAsk('photo library'), { query: '' });
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses.concat(['photos', 'a photo of my dog', 'pictures of cats', 'how do i take better photos'])) assert.equal(skill.match(a.toLowerCase(), a), false, a);
});

test('a thumbnail is at most 320 on its long side and never grows', () => {
  assert.deepEqual(thumbSize(4032, 3024), { w: 320, h: 240 });
  assert.deepEqual(thumbSize(3024, 4032), { w: 240, h: 320 });
  assert.deepEqual(thumbSize(100, 50), { w: 100, h: 50 });
  assert.deepEqual(thumbSize(0, 10), { w: 0, h: 0 });
});
