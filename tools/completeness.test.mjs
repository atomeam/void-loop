// Completeness basics for every game (docs/COMPLETENESS.md). node --test tools/completeness.test.mjs
// covers skills/game-rules-line.js (the how-to-play line) through the rules-help basic below
import test from 'node:test'; import assert from 'node:assert/strict';
import { RULES, audit, analogies, loadGames, fuzz, mutate } from './completeness.mjs';
import * as M from '../void-live-deploy/skills/monopoly-rules.js';

const games = await loadGames();
test('every game has every must-have basic (a miss becomes a rule for all games, and can never come back)', () => {
  assert.ok(games.length >= 15, 'games found: ' + games.length);
  const miss = games.map((g) => audit(g.name, g.src)).flatMap((a) => a.missing.filter((r) => r.need === 'must').map((r) => a.name + ': ' + r.label));
  assert.deepEqual(miss, []);
});
test('the property-game miss is a general rule: a currency means a balance panel, holdings mean a holdings panel', () => {
  for (const id of ['balance-panel', 'inventory-panel']) { const r = RULES.find((x) => x.id === id); assert.ok(r && r.need === 'must' && r.origin); }
  const a = audit('fake', 'game-card stageKinds money owned( New game g-rules stageApi.save win aria-live');
  assert.deepEqual(a.missing.map((r) => r.id).sort(), ['balance-panel', 'inventory-panel']);
});
test('analogy finds what peers have and one game lacks', () => {
  const as = [audit('a', 'score g-rules'), audit('b', 'score g-rules'), audit('c', 'points g-rules')];
  assert.ok(analogies(as).some((x) => x.game === 'c' && x.id === 'score'));
});
test('fuzz: mutated asks never throw and near misses stay out, for every game', async () => {
  assert.ok(mutate('play chess').length >= 8);
  for (const g of games) { const mod = (await import('../void-live-deploy/skills/' + g.file)).default; if (!mod || !mod.match) continue; assert.deepEqual(fuzz(mod), [], g.name); }
});
test('property game: mortgage, holdings by set, deed card, rent stops while mortgaged', () => {
  let s = M.create({ voids: 1, seed: 7 }); s.owner[1] = 0; s.owner[3] = 0; s.owner[5] = 0;
  const h = M.holdings(s, 0); assert.deepEqual(h.map((g) => [g.key, g.items.length, g.full]), [['brown', 2, true], ['station', 1, false]]);
  assert.equal(M.rentFor(s, 1), 4);
  const m = M.mortgage(s, 1); assert.equal(m.players[0].money, 1530); assert.equal(M.rentFor(m, 1), 0); assert.ok(M.holdings(m, 0)[0].items[0].mortgaged);
  assert.equal(M.mortgage(m, 1), m, 'no double mortgage');
  const u = M.unmortgage(m, 1); assert.equal(u.players[0].money, 1530 - 33); assert.equal(M.rentFor(u, 1), 4);
  const d = M.deedCard(m, 1); assert.equal(d.kind, 'deed'); assert.ok(d.fields.some(([k]) => k === 'With a hotel')); assert.ok(d.fields.some(([k, v]) => k === 'State' && /mortgaged/.test(v)));
  s.houses[1] = 1; assert.equal(M.canMortgage(s, 0, 3), false, 'no mortgage while the set has houses');
});
test('expectation mining: mined features diff against code, a gap becomes a general rule and a topic-only want', async () => {
  const E = await import('./expectations.mjs');
  const exp = E.mine('Players keep cash, trade deeds and can mortgage; a timer is optional.');
  assert.deepEqual(exp.sort(), ['balance', 'inventory', 'mortgage', 'timer', 'trade']);
  assert.deepEqual(E.diff(exp, 'offer holdings balance mortgage'), ['timer']);
  const r = E.generalize('timer', 'chess'); assert.equal(r.need, 'should'); assert.ok(new RegExp(r.has, 'i').test('clock'));
  assert.deepEqual(E.wantsOf('chess', ['timer']), [{ kind: 'want', topic: 'chess: timer', source: 'expectation mining' }]);
});
