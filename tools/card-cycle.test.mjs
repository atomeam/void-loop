// The card cycle (tools/card-cycle.mjs): every card gets a turn, each says what it lacks and the one smartest thing to build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { audit, smartest, next, cardsOf, missesBySkill } from './card-cycle.mjs';

const page = (name, o = {}) => ({ kind: 'skill', name, title: name, line: 'A card line long enough to say what this skill does for a person.', examples: ['a', 'b', 'c'], ...o });

test('what a card lacks comes from the records, and the smartest build is the most useful one', () => {
  const ctx = { benched: new Map([['ok', 5], ['thin', 1]]), tiers: new Map([['ok', 'proven'], ['thin', 'tested'], ['bare', 'experiment']]), misses: new Map([['broken', ['what can you 3d print?']]]) };
  assert.deepEqual(audit(page('ok'), ctx).lacks, []);
  assert.deepEqual(audit(page('thin'), ctx).lacks, ['thin-bench', 'tested']);
  assert.deepEqual(audit(page('bare', { line: 'short', examples: ['x'] }), ctx).lacks, ['unbenched', 'experiment', 'thin-line', 'few-examples']);
  assert.equal(smartest(audit(page('broken'), ctx)).kind, 'fix', 'a wrong answer comes before anything else');
  assert.equal(smartest(audit(page('bare', { line: 'short', examples: ['x'] }), ctx)).kind, 'bench');
  assert.equal(smartest(audit(page('ok'), ctx)), null);
});
test('the cycle walks the whole book from its cursor, wraps round, skips cards that lack nothing', () => {
  const cards = ['a', 'b', 'c', 'd'].map((n) => page(n)), audits = new Map(cards.map((c) => [c.name, { name: c.name, lacks: c.name === 'b' ? [] : ['unbenched'] }]));
  const r1 = next(cards, audits, 2, 2);
  assert.deepEqual(r1.picks.map((p) => p.name), ['c', 'd']); assert.equal(r1.cursor, 0);
  const r2 = next(cards, audits, r1.cursor, 2);
  assert.deepEqual(r2.picks.map((p) => p.name), ['a', 'c'], 'b lacks nothing and is passed over');
  const seen = new Set(); let cur = 0; for (let k = 0; k < 4; k++) { const r = next(cards, audits, cur, 1); r.picks.forEach((p) => seen.add(p.name)); cur = r.cursor; }
  assert.deepEqual([...seen].sort(), ['a', 'c', 'd'], 'every lacking card gets its turn');
});
test('only skill pages are cards for the cycle; the misses file is read by skill', () => {
  assert.deepEqual(cardsOf({ pages: [{ kind: 'cover' }, page('x'), { kind: 'game', name: 'y' }] }).map((p) => p.name), ['x']);
  assert.deepEqual([...missesBySkill({ misses: ['draw a circle -> skill:shape', 'kindergarten -> article fallback'] })], [['shape', ['draw a circle']]]);
});
