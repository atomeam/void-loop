// V01D cards (lib/card-frame.js): every page is a card with stats from the skill's own evidence. Run: node --test tools/card-frame.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardOf, chromeHtml, lookup, editedDaysAgo, CARD_CSS, RARITY } from '../void-live-deploy/lib/card-frame.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy/skills');
const book = JSON.parse(readFileSync(resolve(root, 'guide.json'), 'utf8')), fam = JSON.parse(readFileSync(resolve(root, 'families.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('a proven skill is a mythic card: cost in words said, power from its success rate, toughness from the real asks, collector number from the book', () => {
  const deps = JSON.parse(readFileSync(resolve(root, 'deps.json'), 'utf8')), st = { book, fam, deps }, c = cardOf({ ...lookup(st, 'forge') });
  assert.equal(c.rarity, RARITY.proven); assert.equal(c.rarity.name, 'Mythic');
  assert.equal(c.power, 9); assert.equal(c.toughness, 10, 'forge: "10 real asks in the benchmark"');
  assert.ok(c.cost >= 1 && c.cost <= 6); assert.match(c.typeLine, /^Skill — Making things$/);
  assert.match(c.number, /^\d{3}\/221$|^\d{3}\/\d{3}$/); assert.ok(c.adds.length > 10 && c.adds.length <= 120);
  assert.match(c.tested, /^2026-/);
});

test('the rarity is the evidence rating, nothing else; an unrated or source page has no stats', () => {
  assert.deepEqual(Object.entries(RARITY).map(([k, v]) => k + ':' + v.name), ['proven:Mythic', 'checked:Rare', 'tested:Uncommon', 'experiment:Common']);
  const a = cardOf({ kind: 'Answer' });
  assert.equal(a.rarity, null); assert.equal(a.power, null); assert.equal(a.toughness, null); assert.equal(a.typeLine, 'Answer — from V01D'); assert.equal(a.cost, 0);
  const t = cardOf({ skill: { name: 'x', tier: 'tested', success_rate: 0.5 } });
  assert.equal(t.rarity.name, 'Uncommon'); assert.equal(t.power, 5);
  assert.equal(cardOf({ skill: { name: 'y', tier: 'experiment' } }).power, 0, 'no success rate: the tier stands in');
});

test('every skill in the book makes a card whose numbers stay in a card\'s range, and every family has its own hue', () => {
  const st = { book, fam }; const hues = new Set();
  for (const p of book.pages.filter((x) => x.kind === 'skill')) {
    const c = cardOf({ ...lookup(st, p.name) });
    assert.ok(c.power >= 0 && c.power <= 9 && c.toughness >= 0 && c.toughness <= 99, p.name);
    assert.ok(c.hue >= 0 && c.hue < 360); hues.add(p.chapter + ':' + c.hue);
  }
  assert.ok(hues.size >= 10);
});

test('the chrome is a type bar with a gem, an adds line, and a footer with the plate; a source card has no plate', () => {
  const deps = JSON.parse(readFileSync(resolve(root, 'deps.json'), 'utf8')), c = cardOf({ ...lookup({ book, fam, deps }, 'forge') }), h = chromeHtml(c, esc);
  assert.match(h.type, /class="vc-type"/); assert.match(h.type, /vc-gem/); assert.match(h.adds, /Adds to V01D/);
  assert.match(h.foot, /class="vc-pt"/); assert.match(h.foot, /P<b>9<\/b>/); assert.match(h.foot, /R<b>10<\/b>/); assert.match(h.foot, /Mythic/); assert.match(h.foot, /V01D/);
  const a = chromeHtml(cardOf({ kind: 'Answer' }), esc); assert.doesNotMatch(a.foot, /vc-pt/); assert.equal(a.adds, '');
});

test('the frame is a frame: a coloured border from the family, a title bar, a type bar, a plate; nothing that hides the page\'s own text', () => {
  for (const k of ['.vpage.vcard{', '.vc-title', '.vc-type', '.vc-adds', '.vc-foot', '.vc-pt', 'attr(data-cost)', 'var(--h)']) assert.ok(CARD_CSS.includes(k), k);
  assert.doesNotMatch(CARD_CSS, /display:none/);
});

test('the age of a source is read from its own source line', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  assert.equal(Math.round(editedDaysAgo('Source: Wikipedia · last edited Sep 3, 2026 · as of 3:00 PM', now)), 44);
  assert.equal(editedDaysAgo('Source: Wikipedia', now), null);
});

test('the Illuminati layer: income and control arrows come from the real dependency map', () => {
  const deps = JSON.parse(readFileSync(resolve(root, 'deps.json'), 'utf8')), forge = cardOf({ ...lookup({ book, fam, deps }, 'forge') });
  assert.ok(forge.arrowsOut >= 1, 'the forge controls what it imports'); assert.ok(forge.income >= 0);
  assert.match(chromeHtml(forge, esc).arrows, /vc-arrows/); assert.match(chromeHtml(forge, esc).arrows, /\u25b6/);
  assert.doesNotMatch(chromeHtml(cardOf({ kind: 'Answer', sources: 1, ageDays: 3 }), esc).foot, />I</, 'an answer has no income');
});
