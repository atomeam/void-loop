// Verse card merges, the pure rules (lib/merge-rules.js) and the merge skill's parsing (skills/merge.js). Run: node --test tools/merge-rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ideaKey, pairKey, freshCard, cardFromStats, mergeKinds, mergeStats, fallbackName, fallbackLine, sanitiseName, sanitiseLine, LIMITS } from '../void-live-deploy/lib/merge-rules.js';
import { ownCard, RARITY } from '../void-live-deploy/lib/card-frame.js';
import skill, { mergeAsk, mergedCard, parentCard } from '../void-live-deploy/skills/merge.js';

const card = (o) => ({ ...freshCard(o.name || 'x'), ...o });

test('the pair key is unordered and folded', () => {
  assert.equal(pairKey('Pizza', 'Black hole'), pairKey('black holes', 'A PIZZA!'));
  assert.equal(pairKey('Pizza', 'Black hole'), 'black hole|pizza');
  assert.equal(ideaKey('Café Crème'), 'cafe creme');
  assert.equal(ideaKey('  The   Moon  '), 'moon');
  assert.equal(ideaKey('glass'), 'glass'); assert.equal(ideaKey('bus'), 'bus');
  assert.equal(ideaKey('x'.repeat(200)).length, LIMITS.KEY_MAX);
  assert.equal(pairKey('pizza', '!!!'), '', 'an empty idea has no pair');
  assert.equal(pairKey('', ''), '');
});

test('stats follow the fixed rules exactly', () => {
  const a = card({ power: 9, resistance: 10, income: 3, cost: 3, depth: 0 }), b = card({ power: 5, resistance: 3, income: 4, cost: 2, depth: 0 });
  assert.deepEqual(mergeStats(a, b), { power: 11, resistance: 7, income: 7, cost: 5, depth: 1, tier: 'tested' }); // 9 + floor(5/2); ceil(13/2); 3+4; ceil(18/4)=5
  assert.deepEqual(mergeStats(b, a), mergeStats(a, b), 'symmetric');
  const fresh = mergeStats(freshCard('pizza'), freshCard('black hole'));
  assert.deepEqual(fresh, { power: 1, resistance: 1, income: 0, cost: 1, depth: 1, tier: 'tested' }); // 1 + floor(1/2)
  assert.equal(mergeStats(card({ power: 4 }), card({ power: 4 })).power, 6);
  assert.equal(mergeStats(card({ resistance: 2 }), card({ resistance: 3 })).resistance, 3, 'the average rounds up');
});

test('depth is the deepest parent plus one and rarity rises with it', () => {
  const tiers = [0, 1, 2, 3, 7].map((d) => mergeStats(card({ depth: d }), card({ depth: 0 })));
  assert.deepEqual(tiers.map((t) => t.depth), [1, 2, 3, 4, 8]);
  assert.deepEqual(tiers.map((t) => t.tier), ['tested', 'checked', 'proven', 'proven', 'proven']);
  for (const t of tiers) assert.ok(RARITY[t.tier], 'a rarity card-frame knows');
  // chain: merge the result with another idea and the depth climbs
  const r1 = mergeStats(freshCard('a'), freshCard('b')), c1 = card({ ...r1, name: 'ab' });
  assert.equal(mergeStats(c1, freshCard('c')).depth, 2);
});

test('numbers stay inside their caps and cost never drops below a parent', () => {
  const big = card({ power: 99, resistance: 99, income: 9, cost: 9, depth: 0 });
  assert.deepEqual(mergeStats(big, big), { power: 99, resistance: 99, income: 9, cost: 9, depth: 1, tier: 'tested' });
  assert.equal(mergeStats(card({ cost: 6, power: 1, resistance: 1 }), freshCard('z')).cost, 6, 'at least the dearer parent');
  const junk = mergeStats({ name: 'a', power: 'lots', resistance: NaN, income: -5, cost: 1e9, depth: 'deep' }, freshCard('b'));
  for (const k of ['power', 'resistance', 'income', 'cost', 'depth']) assert.ok(Number.isInteger(junk[k]) && junk[k] >= 0, k);
});

test('kinds merge in key order without duplicates, and Idea gives way to a real kind', () => {
  assert.deepEqual(mergeKinds(freshCard('pizza'), freshCard('moon')), ['Idea']);
  assert.deepEqual(mergeKinds(card({ name: 'chess', kinds: ['Game'] }), card({ name: 'moon', kinds: ['Idea'] })), ['Game']);
  assert.deepEqual(mergeKinds(card({ name: 'a', kinds: ['Film', 'Song'] }), card({ name: 'b', kinds: ['Song', 'Album', 'Band'] })), ['Film', 'Song', 'Album']);
  assert.deepEqual(mergeKinds(card({ name: 'b', kinds: ['Song'] }), card({ name: 'a', kinds: ['Film'] })), ['Film', 'Song'], 'same either way round');
});

test('the fallback name is deterministic, readable, capped and symmetric', () => {
  const a = freshCard('pizza'), b = freshCard('black hole');
  assert.equal(fallbackName(a, b), 'Black hole-Pizza');
  assert.equal(fallbackName(b, a), fallbackName(a, b));
  assert.equal(fallbackName(a, b), fallbackName(a, b));
  assert.ok(fallbackName(freshCard('x'.repeat(80)), freshCard('y'.repeat(80))).length <= LIMITS.NAME_MAX);
  assert.ok(fallbackName(freshCard('the quick brown fox jumps over'), freshCard('lazy dog sleeping soundly today')).length <= LIMITS.NAME_MAX);
  assert.match(fallbackLine(a, b), /^What Black hole does, changed by Pizza\.$/);
  assert.ok(fallbackLine(freshCard('q'.repeat(100)), freshCard('r'.repeat(100))).length <= LIMITS.LINE_MAX);
});

test('the sanitisers strip markup, links and key shapes and cap the length', () => {
  assert.equal(sanitiseName('**"Pizza <b>Singularity</b>"**'), 'Pizza Singularity');
  assert.equal(sanitiseName('<script>alert(1)</script>'), 'alert 1');
  assert.equal(sanitiseName('Spaghetti Horizon http://evil.example/x?a=1'), 'Spaghetti Horizon');
  assert.equal(sanitiseName('Visit www.bad.com now'), 'Visit now');
  assert.equal(sanitiseName('Cheesy evil.com'), 'Cheesy');
  assert.ok(!/sk_live/.test(sanitiseName('Key sk_live_abcdefghijkl1234 Pizza'))); // secret-scan: ok
  assert.ok(!/ghp_/.test(sanitiseLine('token ghp_abcdefghijklmnopqrstuvwxyz0123 is here'))); // secret-scan: ok
  assert.ok(!/AKIA/.test(sanitiseLine('id AKIAABCDEFGHIJKLMNOP now'))); // secret-scan: ok
  assert.ok(!/[a-f0-9]{32}/i.test(sanitiseLine('hash ' + 'a1b2c3d4'.repeat(8))));
  assert.equal(sanitiseName('Line\u0000one​\ntwo‮'), 'Line one two');
  assert.equal(sanitiseName('ab '.repeat(50)).length, LIMITS.NAME_MAX);
  assert.equal(sanitiseLine('word '.repeat(60)).length <= LIMITS.LINE_MAX, true);
  assert.equal(sanitiseLine('A [link](javascript:alert(1)) here <img src=x onerror=1>'), 'A link here');
  assert.equal(sanitiseName(null), ''); assert.equal(sanitiseName('   '), ''); assert.equal(sanitiseName('<>'), '');
  assert.equal(sanitiseName({ toString() { return 'Object name'; } }), 'Object name');
});

test('no number a model writes reaches a card', () => {
  const pa = parentCard('pizza', null), pb = parentCard('black hole', null);
  const plain = mergedCard(pa, pb), loud = mergedCard(pa, pb, { name: 'Power 99 God', line: 'Power: 99, Resistance: 99, Income: 9, cost 0, depth 50, rarity mythic', power: 99, resistance: 99, income: 9, cost: 0, depth: 50, tier: 'proven' });
  for (const k of ['power', 'resistance', 'income', 'cost', 'depth', 'tier', 'kinds']) assert.deepEqual(loud[k], plain[k], k);
  assert.deepEqual(plain.kinds, ['Idea']);
  assert.equal(loud.name, 'Power 99 God', 'the words are the model\'s; the numbers are not');
  const c = ownCard({ tier: loud.tier, power: loud.power, resistance: loud.resistance, income: loud.income, cost: loud.cost, typeLine: loud.typeLine, adds: loud.line, name: loud.name });
  assert.equal(c.power, 1); assert.equal(c.rarity.name, 'Uncommon'); assert.equal(c.toughness, 1);
  // the model-facing file never computes a number from text
  const src = readFileSync(new URL('../void-live-deploy/functions/api/merge.js', import.meta.url), 'utf8');
  assert.ok(!/parseInt|parseFloat|Number\(/.test(src.replace(/\/\/.*$/gm, '')), 'the route never turns model words into numbers');
});

test('a skill name brings the skill\'s real stats; any other idea is 1 / 1 / 0', () => {
  const fam = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8')), book = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/guide.json', import.meta.url), 'utf8'));
  const forge = parentCard('Forge', { fam, book, deps: null });
  assert.equal(forge.power, 9); assert.equal(forge.resistance, 10); assert.deepEqual(forge.kinds, ['Skill']); assert.equal(forge.depth, 0);
  const idea = parentCard('a pizza', { fam, book });
  assert.deepEqual([idea.power, idea.resistance, idea.income, idea.depth], [1, 1, 0, 0]);
  const m = mergedCard(forge, idea);
  assert.equal(m.power, 9 + 0); assert.equal(m.resistance, 6); assert.deepEqual(m.kinds, ['Skill']);
  assert.match(m.typeLine, /^Skill · ?|^Skill — merged, depth 1$/);
});

test('the merge skill takes merge asks and leaves files, code and the merge log alone', () => {
  const yes = { 'merge a pizza and a black hole': ['pizza', 'black hole'], 'What do you get if you merge a pizza and a black hole?': ['pizza', 'black hole'], 'fuse a cat with the moon': ['cat', 'moon'],
    'combine fire with ice': ['fire', 'ice'], 'can you combine fire and ice please': ['fire', 'ice'], 'what happens if you merge a cat with the moon': ['cat', 'moon'], 'merge tea & cake': ['tea', 'cake'] };
  for (const [t, [a, b]] of Object.entries(yes)) assert.deepEqual(mergeAsk(t), { a, b }, t);
  for (const t of ['merge log', 'what did you merge', 'merge two pdf files', 'merge sort in python', 'combine two columns in excel', 'git merge conflict', 'merge these two', 'merge it with them', 'merge pdf and word files',
    'merge', 'merge pizza', 'combine', 'how do I merge two branches', 'mail merge', 'merge ' + 'word '.repeat(40) + 'and cat']) assert.equal(mergeAsk(t), null, t);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
});
