// tools/first-asks.mjs: the table of known asks the page answers before its skills finish loading (#2316, #2323, #2342).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstKey, sureLanding, knownAsks } from './first-asks.mjs';

const mod = (name, re, extra = {}) => ({ name, match: (l) => re.test(l), run: () => 'none', ...extra });

test('a known ask goes to the first skill that takes it, by routing order', () => {
  const mods = [mod('a', /^alpha$/), mod('b', /beta/), mod('c', /beta|gamma/)];
  assert.equal(sureLanding(mods, ['a', 'b', 'c'], 'Beta'), 'b');
  assert.equal(sureLanding(mods, ['a', 'b', 'c'], 'gamma'), 'c');
  assert.equal(sureLanding(mods, ['a', 'b', 'c'], 'delta'), null, 'no skill takes it: not in the table');
});

test('a skill above the match that throws in node keeps the ask out of the table (it may read the page)', () => {
  const reads = { name: 'reads', match: () => { throw new ReferenceError('document is not defined'); }, run: () => 'none' };
  assert.equal(sureLanding([reads, mod('b', /beta/)], ['reads', 'b'], 'beta'), null);
  assert.equal(sureLanding([mod('b', /beta/), reads], ['b', 'reads'], 'beta'), 'b', 'a throw below the match changes nothing');
});

test('the key is the ask lowercased with its spaces collapsed, the same rule the page uses', () => {
  assert.equal(firstKey('  Flip   this CARD '), 'flip this card');
  const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  assert.ok(page.includes("const firstKey = (lower) => String(lower || '').toLowerCase().trim().replace(/\\s+/g, ' ');"), 'void.html looks the ask up by the same key');
  assert.ok(page.includes('(firstAsks && firstAsks.has(firstKey(t)))) return t;'), 'a known ask skips the fuzzy wait');
});

test('known asks: examples, family members, no duplicates', () => {
  const fam = { name: 'fam', members: [{ name: 'm', examples: ['Member ask'] }], examples: ['member ask'], match: () => false, run: () => 'none' };
  const asks = knownAsks([mod('a', /x/, { examples: ['x one', 'X  one'] }), fam]);
  assert.ok(asks.includes('x one') && asks.includes('member ask'));
  assert.equal(asks.filter((a) => firstKey(a) === 'x one').length, 1);
  assert.equal(asks.filter((a) => firstKey(a) === 'member ask').length, 1);
});

test('skills/first.json routes the three asks that showed only "waking up" to their own skills', () => {
  const table = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/first.json', import.meta.url), 'utf8'));
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  const at = (ask) => Object.keys(table).find((f) => table[f].includes(ask));
  assert.equal(at('flip this card'), 'card-play');
  assert.equal(at('favorite this'), 'bookmarks');
  assert.equal(at('send it away'), 'dismiss');
  for (const f of Object.keys(table)) assert.ok(index.includes(f), f + ' is in skills/index.json');
});

test('the deploy keeps skills/first.json current', () => {
  const refresh = readFileSync(new URL('./refresh.mjs', import.meta.url), 'utf8');
  assert.match(refresh, /name: 'first', script: 'first-asks\.mjs'/);
});
