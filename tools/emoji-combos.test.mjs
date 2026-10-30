// The emoji combo catalog (/emoji-combos/, lib/emoji-combos.js; the floor that assimilates emojicombos.com, 2026-10-30): the catalog is counted
// as it is, a tag search finds what it holds, fancy text maps every letter, a picture turns into dots, and the collected box rides in the link
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBOS, queryWords, search, catalogStats, tagCounts, findEmoji, similarEmoji, STYLES, fancy, fancyAll, brailleArt, grayOf, dotSize, invertDots, linkOf, fromLink, emptyState, cleanState, addMine, removeMine, toggleSaved, withMine, loadState, saveState, STORE_KEY } from '../void-live-deploy/lib/emoji-combos.js';
import { EMOJI } from '../void-live-deploy/lib/emoji.js';
import { PROBES } from './tower-probes.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';

const LONG_DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2015) + ']');

test('the catalog is counted as it is: every combo has text and tags, none twice', () => {
  const s = catalogStats(); assert.equal(s.combos, COMBOS.length); assert.ok(s.combos >= 100, 'a catalog worth searching');
  assert.equal(new Set(COMBOS.map((c) => c.t)).size, COMBOS.length, 'no combo twice');
  for (const c of COMBOS) { assert.ok(c.t.trim(), 'text: ' + c.id); assert.ok(c.tags.length > 0, 'tags: ' + c.t); assert.ok(!LONG_DASH.test(c.t), 'no long dash: ' + c.t); }
  assert.equal(tagCounts().reduce((n, x) => n + x.n, 0), COMBOS.reduce((n, c) => n + c.tags.length, 0), 'the tag counts add up to the tags');
});

test('a tag search finds what the catalog holds, by word, plural, alias and phrase', () => {
  const cat = search('cat'); assert.ok(cat.length >= 3 && cat.every((c) => c.tags.includes('cat')), 'only cat combos');
  assert.deepEqual(queryWords('cats'), ['cat']); assert.deepEqual(search('cats').map((c) => c.t), cat.map((c) => c.t), 'cats finds the cat combos');
  assert.deepEqual(search('kitten').map((c) => c.t), cat.map((c) => c.t), 'kitten is an alias of cat');
  const bd = search('happy birthday'); assert.ok(bd.length >= 2 && bd.every((c) => c.tags.includes('birthday')), 'the phrase finds birthday');
  assert.deepEqual(search(''), []); assert.deepEqual(search('zzzqqq'), [], 'a word nothing holds finds nothing, never a filler');
});

test('single emoji: found by name, and similar ones share a word', () => {
  const fire = findEmoji('fire', EMOJI); assert.ok(fire.some((e) => e.c === '🔥'), 'fire finds 🔥');
  const sim = similarEmoji('😍', EMOJI); assert.ok(sim.some((e) => e.c === '😻') && !sim.some((e) => e.c === '😍'), 'similar to 😍: 😻, without 😍 itself');
  assert.deepEqual(similarEmoji('🔥', EMOJI), [], 'no word in common, nothing made up');
});

test('fancy text maps every letter in every style, holes included', () => {
  assert.equal(fancy('Hello', 'Script'), 'ℋℯ𝓁𝓁ℴ'); assert.equal(fancy('Hello', 'Bold'), '𝐇𝐞𝐥𝐥𝐨'); assert.equal(fancy('ABC', 'Double-struck'), '𝔸𝔹ℂ');
  assert.equal(STYLES.length, 16); assert.equal(fancyAll('hi').length, 16);
  for (const [style] of STYLES) { const out = fancy('The quick brown fox 123', style); assert.ok(out && out !== 'The quick brown fox 123', style); }
});

test('a picture turns into braille dots, one cell for each 2 by 4 pixels', () => {
  const w = 4, h = 4, black = new Array(w * h).fill(0), white = new Array(w * h).fill(255);
  assert.equal(brailleArt(black, w, h), '⣿⣿', 'dark pixels are dots'); assert.equal(brailleArt(white, w, h), '⠀⠀', 'light pixels are empty cells');
  assert.equal(brailleArt(white, w, h, { invert: true }), '⣿⣿'); assert.equal(invertDots('⣿⠀'), '⠀⣿');
  assert.deepEqual(Array.from(grayOf([255, 255, 255, 255, 0, 0, 0, 255], 2, 1)), [255, 0]);
  const d = dotSize(200, 100, 30); assert.equal(d.w, 60); assert.equal(d.h % 4, 0);
});

test('the link carries the search and the collected box, and nothing else', () => {
  const u = linkOf({ q: 'cat', c: '🐱💕🐾' }); assert.ok(u.startsWith('/emoji-combos/?'));
  const back = fromLink(u.split('?')[1]); assert.equal(back.q, 'cat'); assert.equal(back.c, '🐱💕🐾');
  assert.equal(linkOf({}), '/emoji-combos/'); assert.ok(fromLink('?q=' + 'x'.repeat(500)).q.length <= 100, 'the search is capped');
  assert.equal(fromLink('?t=hello').t, 'hello', 'text another page hands over');
});

test('your own combos and the saved ones stay on this device, cleaned', () => {
  let s = emptyState(); const r = addMine(s, '(•‿•)/', 'wave, happy'); assert.ok(!r.error); s = r.state;
  assert.ok(s.mine[0].tags.includes('yours') && s.mine[0].tags.includes('wave')); assert.ok(addMine(s, '   ', 'x').error, 'an empty combo is refused');
  assert.equal(withMine(s)[0].t, '(•‿•)/'); assert.equal(withMine(s).length, COMBOS.length + 1);
  s = toggleSaved(s, '🐱💕🐾'); assert.deepEqual(s.saved, ['🐱💕🐾']); s = toggleSaved(s, '🐱💕🐾'); assert.deepEqual(s.saved, []);
  s = removeMine(s, '(•‿•)/'); assert.equal(s.mine.length, 0);
  assert.deepEqual(cleanState({ mine: 'junk', saved: [1, 'a'] }), { mine: [], saved: ['a'] });
  const mem = new Map(), store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(saveState({ mine: [], saved: ['🔥'] }, store), true); assert.ok(mem.has(STORE_KEY)); assert.deepEqual(loadState(store).saved, ['🔥']);
  assert.deepEqual(loadState({ getItem: () => '{bad' }), emptyState(), 'a broken store reads as empty');
});

test('the floor is registered: emojicombos.com, its probe and its page', () => {
  const f = FLOORS.find((x) => x.id === 'emoji combos'); assert.ok(f); assert.equal(f.site, 'emojicombos.com'); assert.equal(f.page, '/emoji-combos/');
  const p = PROBES['emoji combos']; assert.ok(p); assert.equal(p.verse, '/emoji-combos/'); assert.equal(p.ask.verse, '/emoji-combos/?q=cat');
  const text = search('cat').map((c) => c.t + ' ' + c.tags.join(' ')).join('\n') + '\nCopy';
  for (const [label, re] of p.truth) assert.ok(re.test(text), 'the truth holds on the catalog: ' + label);
});

test('the stage card answers asks for combos and leaves the emoji skill its asks', async () => {
  const { comboAsk, default: skill } = await import('../void-live-deploy/skills/emoji-combos.js');
  assert.equal(comboAsk('cat emoji combos'), 'cat'); assert.equal(comboAsk('emoji combos for birthday'), 'birthday'); assert.equal(comboAsk('kaomoji happy'), 'happy'); assert.equal(comboAsk('emoji combos'), '');
  for (const ask of skill.nearMisses) assert.equal(comboAsk(ask), null, ask);
  assert.equal(skill.suite().ok, true);
});
