// Game health (asked by Void): the Elo rating on the Games family of the skill-health card. node --test tools/game-health.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { gameHealth, gameHealthHtml, MIN } from '../void-live-deploy/lib/game-health.js';
import { healthHtml } from '../void-live-deploy/skills/family-health.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const game = (g, result) => ({ game: g, result, vs: 'v01d', at: '2026-10-18T00:00:00Z' });
const wins = (g, n) => Array.from({ length: n }, () => game(g, 'loss')); // the person lost: V01D won

test('nothing played reads nothing; each game with a match gets a row from its own record', () => {
  assert.deepEqual(gameHealth(null, []), []); assert.equal(gameHealthHtml(esc, []), '');
  const rows = gameHealth({ pong: { void: 3, you: 1, draw: 0 } }, [...wins('chess', 6), game('checkers', 'win')]);
  assert.deepEqual(rows.map((r) => [r.game, r.played, r.read]), [['chess', 6, 'climbing'], ['checkers', 1, 'too few matches to say'], ['pong', 4, 'too few matches to say']]);
  assert.ok(rows[0].rating > 1200 && rows[0].delta === rows[0].rating - 1200); assert.equal(rows[2].rating, 1032);
});
test('five matches are needed before it says climbing, level or slipping', () => {
  assert.equal(MIN, 5);
  assert.equal(gameHealth({ snake: { void: 1, you: 4, draw: 0 } }, [])[0].read, 'slipping');
  assert.equal(gameHealth({ snake: { void: 3, you: 3, draw: 0 } }, [])[0].read, 'level');
  assert.equal(gameHealth({ snake: { void: 4, you: 0, draw: 0 } }, [])[0].read, 'too few matches to say');
});
test('the Games family shows the ratings, other families do not, and text is escaped', () => {
  const fam = { families: [{ id: 'games', name: 'Games <x>', skills: [{ name: 'chess', tier: 'proven' }] }, { id: 'sky', name: 'Sky', skills: [{ name: 'moon', tier: 'tested' }] }] };
  const h = healthHtml(esc, fam, null, Date.now(), null, gameHealth({ pong: { void: 2, you: 0, draw: 0 } }, []));
  assert.equal((h.match(/class="sub fh-ratings"/g) || []).length, 1); assert.match(h, /data-ratings="pong:1032"/); assert.match(h, /Void Pong 1032 \(\+32 from the start, 2 matches\)/);
  assert.ok(!healthHtml(esc, fam).includes('fh-ratings')); assert.ok(!h.includes('Games <x>'));
});
