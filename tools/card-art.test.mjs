// V01D card art (lib/card-art.js): deterministic, every kind draws, safe to inline. Run: node --test tools/card-art.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { artSvg, KINDS, kindWord, seasonOf, rarityKey } from '../void-live-deploy/lib/card-art.js';

const card = (o = {}) => ({ key: 'Casablanca', name: 'Casablanca', kind: 'Film', chapter: 'stage', hue: 190, rarity: 'Rare', ...o });
test('the same idea always draws the same picture and different ideas differ', () => {
  assert.equal(artSvg(card()), artSvg(card()));
  assert.notEqual(artSvg(card()), artSvg(card({ key: 'Vertigo', name: 'Vertigo' })));
  assert.notEqual(artSvg(card({ key: 'a' })), artSvg(card({ key: 'b' })));
});
test('every kind draws a valid, safe SVG under 12 KB with its own plate', () => {
  const seen = new Set();
  for (const kind of KINDS) for (const season of ['off', 'halloween']) for (const rarity of ['Common', 'Mythic']) {
    const s = artSvg(card({ kind, season, rarity, chapter: 'numbers', glyph: true }), { w: 520, h: 150 });
    assert.match(s, /^<svg [^>]*viewBox="0 0 520 150"/, kind); assert.ok(s.endsWith('</svg>'));
    assert.ok(!/<script|<foreignObject|<image|<style|<text|javascript:|on\w+=/i.test(s), kind + ': nothing active, no text');
    assert.ok(!/https?:|\/\//.test(s.replace('http://www.w3.org/2000/svg', '')), kind + ': no URL');
    assert.ok(![...s.matchAll(/href="([^"]*)"/g)].some((m) => !m[1].startsWith('#')), kind + ': no external href');
    assert.ok(s.length < (season === 'off' ? 12000 : 15000), kind + ' ' + season + ' ' + s.length + ' bytes');
    assert.equal((s.match(/<svg/g) || []).length, 1);
    if (season === 'off' && rarity === 'Common') seen.add(s.replace(/id="[^"]*"/g, '').slice(300, 900));
  }
  assert.ok(seen.size >= 12, 'plates differ by kind');
});
test('the Halloween skin adds bats, fog and the orange rim; off does not; the query overrides the date', () => {
  const on = artSvg(card({ season: 'halloween' })), off = artSvg(card({ season: 'off' }));
  assert.match(on, /#ff7a1a/); assert.match(on, /<animate /); assert.ok(!/#ff7a1a/.test(off) && !/<animate /.test(off));
  assert.equal(seasonOf(9, ''), 'halloween'); assert.equal(seasonOf(2, ''), 'off');
  assert.equal(seasonOf(2, '?season=halloween'), 'halloween'); assert.equal(seasonOf(9, '?x=1&season=off'), 'off');
});
test('rarity changes ink weight and foil, not the subject', () => {
  const c = artSvg(card({ rarity: 'Common' })), m = artSvg(card({ rarity: 'Mythic' }));
  assert.notEqual(c, m); assert.equal(rarityKey('proven'), 'mythic'); assert.equal(rarityKey({ name: 'Rare' }), 'rare'); assert.equal(rarityKey(null), 'common');
  assert.ok(/stroke-width="3\.4"/.test(m) && /stroke-width="2\.4"/.test(c));
});
test('only the card\'s own words appear (an escaped label), never text from outside', () => {
  const s = artSvg(card({ name: '<img src=x onerror=1>"&' }));
  assert.ok(!/<img/.test(s)); assert.match(s, /aria-label="&lt;img src=x onerror=1&gt;&quot;&amp;"/);
  assert.equal(kindWord('Film · Song — 1965'), 'Film'); assert.equal(kindWord('Skill — Making things'), 'Skill'); assert.equal(kindWord('???'), 'Idea');
});
