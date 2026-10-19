import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedAsks, takeHtml, cleanTake } from '../void-live-deploy/skills/take.js';
import { realFigureFor } from '../void-live-deploy/skills/figures.js';

test('an article offers what Verse can do about its subject', () => {
  assert.deepEqual(relatedAsks({ title: 'Sorry! (game)', description: 'Board game', extract: 'Sorry! is a board game that is based on the older game Ludo.' }).map((a) => a.ask), ['play sorry', 'play aggravation']);
  assert.deepEqual(relatedAsks({ title: 'Ludo', description: 'Board game' }).map((a) => a.ask), ['play aggravation']);
  assert.deepEqual(relatedAsks({ title: 'Lisbon', description: 'Capital city of Portugal' }).map((a) => a.ask), ['weather in Lisbon', 'map of Lisbon', 'time in Lisbon']);
  assert.deepEqual(relatedAsks({ title: 'Paella', description: 'Spanish rice dish' }).map((a) => a.ask), ['recipe for paella']);
  assert.deepEqual(relatedAsks({ title: 'Albert Einstein', description: 'German-born physicist' }), []);
});

test("Verse's take is escaped, and nothing shows when there is nothing to add", () => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const h = takeHtml(esc, 'a <b>take</b>', [{ ask: 'play "x"', label: 'Play' }]);
  assert.ok(h.includes('Verse’s take') && h.includes('&lt;b&gt;') && h.includes('data-ask="play &quot;x&quot;"'));
  assert.equal(takeHtml(esc, '', []), '');
});

test("an article's figure is the thing itself, never a stand-in", () => {
  assert.equal(realFigureFor({ title: 'Cat', description: 'Small domesticated carnivorous mammal' }, 1).kindOf, 'cat');
  assert.equal(realFigureFor({ title: 'Honey bee', description: 'Flying insect' }, 1).kindOf, 'bee');
  assert.equal(realFigureFor({ title: 'Cat (musical)', description: '' }, 1), null);
  assert.equal(realFigureFor({ title: 'Shark Tank', description: 'American business reality television series' }, 1), null);
  assert.equal(realFigureFor({ title: 'Sorry! (game)', description: 'Board game' }, 1), null);
  assert.deepEqual(realFigureFor({ title: 'Cat', description: '' }, 7), realFigureFor({ title: 'Cat', description: '' }, 7));
});

// Verse's take is never the model's leaked working, never a loop, never NONE (2026-10-19: the Tile card)
const escT = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
test('a leaked reasoning trace or a loop is no take', () => {
  assert.equal(cleanTake('analysis The user wants a summary of tile manufacturing processes. Tile manufacturing processes typically involve several steps: raw material extraction tile manufacturing processes typically involve several steps: raw material extraction'), '');
  assert.equal(cleanTake('Tiles tiles tiles are made made made of clay of clay of clay of clay of clay of clay of clay.'), '');
  assert.equal(cleanTake('NONE'), ''); assert.equal(cleanTake(' none. '), '');
});
test('a plain take stays, and the card labels it as a model\'s reading under the source', () => {
  const t = 'Roof tiles are laid overlapping so rain runs off; floor tiles are laid edge to edge on a bed of mortar.';
  assert.equal(cleanTake(t), t);
  const h = takeHtml(escT, t, []);
  assert.match(h, /a model’s reading, not from the source/);
  assert.equal(takeHtml(escT, 'analysis The user wants x', []), '', 'nothing to show: no block at all');
});
