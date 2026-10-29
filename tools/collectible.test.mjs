// Collectible cards (void-live-deploy/skills/collectible.js; owner, 2026-10-18: "make a collectible card of [anything]"): the asks it takes and the
// look-alikes it leaves, the subject it reads, and the print sheet's 3 x 3 layout. Run: node --test tools/collectible.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { subjectOf, sheetPlan, VARIANTS } from '../void-live-deploy/skills/collectible.js';

test('the subject of a collectible ask, and the asks that are not one', () => {
  for (const [ask, want] of [['make a collectible card of a dragon', 'dragon'], ['mint a card of the moon', 'moon'], ['collectible card of tokyo', 'tokyo'],
    ['make me a foil card of a black hole', 'black hole'], ['Mint me a trading card of The Matrix!', 'Matrix'], ['give me a holographic card for my cat', 'my cat']]) assert.equal(subjectOf(ask), want, ask);
  for (const ask of [...skill.nearMisses, 'card of', 'make a card', 'collectible card of ' + 'x'.repeat(90), '']) assert.equal(subjectOf(ask), '', ask);
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
});

test('the print sheet: nine cards in a 3 x 3 grid with a gutter, none overlapping, all inside the sheet', () => {
  const p = sheetPlan(744, 1039, 24);
  assert.equal(p.cells.length, 9); assert.equal(p.width, 3 * 744 + 4 * 24); assert.equal(p.height, 3 * 1039 + 4 * 24);
  for (const c of p.cells) { assert.ok(c.x >= 24 && c.y >= 24 && c.x + c.w <= p.width - 24 && c.y + c.h <= p.height - 24, JSON.stringify(c)); assert.equal(c.w, 744); assert.equal(c.h, 1039); }
  for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) { const a = p.cells[i], b = p.cells[j]; assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, i + ' overlaps ' + j); }
  assert.deepEqual(VARIANTS, ['normal', 'foil', 'full']);
});
