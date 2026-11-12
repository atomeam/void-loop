// lib/emoji-looks.js (how one emoji looks on every platform): the pure helpers behind /emojis/everywhere/ and the emoji card, tested
// (lists run 23, 2026-11-12; it was the biggest file no test named in node tools/untested.mjs).
// Run: node --test tools/emoji-looks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { VENDORS, hexOf, codepointOf, charOf, filesOf, recordOf, findEmoji, shortcodeOf, gridHtml } from '../void-live-deploy/lib/emoji-looks.js';

const LIST = [
  { c: '😀', n: 'grinning face', sn: ['grinning'], cat: 'Smileys & Emotion' },
  { c: '👍', n: 'thumbs up sign', sn: ['+1', 'thumbsup'], cat: 'People & Body' },
  { c: '🔥', n: 'fire', sn: ['fire'], cat: 'Travel & Places' },
  { c: '❤️', n: 'heavy black heart', sn: ['heart'], cat: 'Smileys & Emotion' },
  { c: '👩‍💻', n: 'woman technologist', sn: ['female-technologist'], cat: 'People & Body' },
];

test('hex, code points and back', () => {
  assert.equal(hexOf('😀'), '1f600');
  assert.equal(hexOf('👩‍💻'), '1f469-200d-1f4bb');
  assert.equal(hexOf(''), '');
  assert.equal(codepointOf('❤️'), 'U+2764 U+FE0F');
  assert.equal(charOf('1f600'), '😀');
  assert.equal(charOf('U+1F469 U+200D U+1F4BB'), '👩‍💻');
  assert.equal(charOf('1f469_200d_1f4bb'), '👩‍💻');
  assert.equal(charOf('zzzz-not-hex'), '', 'a broken sequence gives nothing rather than throwing');
  for (const c of ['😀', '👍', '❤️', '👩‍💻']) assert.equal(charOf(hexOf(c)), c);
});

test('files to try: as written, then without FE0F, no repeats; a font vendor has none', () => {
  const apple = VENDORS.find((v) => v.id === 'apple');
  const f = filesOf(apple, '❤️');
  assert.equal(f.length, 2);
  assert.ok(f[0].endsWith('/2764-fe0f.png') && f[1].endsWith('/2764.png'));
  assert.equal(filesOf(apple, '😀').length, 1, 'no FE0F, one file');
  assert.ok(filesOf(VENDORS.find((v) => v.id === 'openmoji'), '😀')[0].endsWith('/1F600.svg'), 'OpenMoji names files in capitals');
  assert.ok(filesOf(VENDORS.find((v) => v.id === 'toss'), '👩‍💻')[0].endsWith('/u1F469_200D_1F4BB.svg'));
  assert.deepEqual(filesOf(VENDORS.find((v) => v.font), '😀'), []);
  assert.deepEqual(filesOf(null, '😀'), []);
  for (const v of VENDORS) for (const u of filesOf(v, '😀')) assert.ok(u.startsWith('https://cdn.jsdelivr.net/'), v.id + ' only from the keyless CDN');
});

test('finding an emoji from what a person typed', () => {
  assert.equal(findEmoji(LIST, 'grinning').c, '😀', 'a short name');
  assert.equal(findEmoji(LIST, ':fire:').c, '🔥', 'a shortcode');
  assert.equal(findEmoji(LIST, 'thumbs up').c, '👍', 'a name that starts with the words');
  assert.equal(findEmoji(LIST, 'the grinning face emoji').c, '😀', 'filler words dropped');
  assert.equal(findEmoji(LIST, 'woman technologist').c, '👩‍💻');
  assert.equal(findEmoji(LIST, '❤').c, '❤️', 'the emoji itself, with or without FE0F');
  assert.deepEqual(findEmoji(LIST, '🦄'), { c: '🦄', n: '', sn: [] }, 'an emoji not in the list still answers as itself');
  assert.equal(findEmoji(LIST, ''), null);
  assert.equal(findEmoji(LIST, 'spaceship'), null);
  assert.equal(recordOf(LIST, '❤').c, '❤️');
  assert.equal(recordOf(null, '😀'), null);
  assert.equal(shortcodeOf(LIST[0]), ':grinning:');
  assert.equal(shortcodeOf(null), '');
});

test('the grid: a tile per vendor plus this device, escaped, compact drops the where line', () => {
  const html = gridHtml('😀', { name: 'grinning <face>' });
  assert.equal((html.match(/<li>/g) || []).length, VENDORS.length + 1);
  assert.ok(!html.includes('<face>') && html.includes('grinning &lt;face&gt;'), 'the name is escaped');
  assert.ok(html.includes('loading="lazy"') && html.includes('referrerpolicy="no-referrer"'));
  assert.ok(html.includes('on ' + (VENDORS.length + 1) + ' platforms'));
  const small = gridHtml('😀', { compact: true });
  assert.ok(small.includes('lk-compact') && !small.includes('lk-where'));
  assert.ok(small.includes('width="36"'));
});
