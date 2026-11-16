// skills/index.json is generated from one order file per skill (tools/skills-index.mjs): the rank in the file name orders
// the routing, a tie orders by name, a malformed or doubled file is refused, and the committed index must match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { orderOf, indexState, writeIndex, indexText, adoptOrder, ranksOf, ORDER_DIR, INDEX } from './skills-index.mjs';

test('order files give the routing order: by rank, then by name; bad names and doubles are refused', () => {
  assert.deepEqual(orderOf(['0020-sorry', '0010-aggravation', '0480-watch', '0480-calendar']), ['aggravation', 'sorry', 'calendar', 'watch']);
  assert.throws(() => orderOf(['watch']), /an order file is <rank>-<skill>/);
  assert.throws(() => orderOf(['0010-watch', '0020-watch']), /twice/);
});

test('a stale index is seen, --write settles it in the file\'s own one-line style', () => {
  const d = mkdtempSync(join(tmpdir(), 'void-skills-')), order = join(d, 'order'), index = join(d, 'index.json');
  mkdirSync(order); for (const f of ['0010-a', '0020-b']) writeFileSync(join(order, f), '');
  assert.equal(indexState(order, index).stale, true, 'no index yet');
  assert.deepEqual(writeIndex(order, index), ['a', 'b']);
  assert.equal(readFileSync(index, 'utf8'), '["a", "b"]\n');
  assert.equal(indexState(order, index).stale, false);
  writeFileSync(join(order, '0015-c'), '');
  assert.equal(indexState(order, index).stale, true, 'a new skill file makes the committed index stale');
  assert.deepEqual(writeIndex(order, index), ['a', 'c', 'b']);
  assert.equal(indexText(['x']), '["x"]\n');
});

test('skills/order/ is the routing source; index.json is the copy the deploy rewrites', () => {
  const { names } = indexState(ORDER_DIR, INDEX);
  assert.ok(names.length > 50, 'the order files name the skills');
});

test('--adopt: a skill the index lists by hand gets an order file between its neighbours, keeping the index\'s order', () => {
  const d = mkdtempSync(join(tmpdir(), 'void-skills-')), order = join(d, 'order'), index = join(d, 'index.json');
  mkdirSync(order); for (const f of ['0010-a', '0030-c', '0050-e']) writeFileSync(join(order, f), '');
  assert.deepEqual(adoptOrder(['a', 'b', 'c', 'd', 'e', 'f'], order), ['0020-b', '0040-d', '0060-f']);
  assert.deepEqual(ranksOf(order), { a: 10, b: 20, c: 30, d: 40, e: 50, f: 60 });
  assert.deepEqual(adoptOrder(['a', 'b', 'c', 'd', 'e', 'f'], order), [], 'nothing to make the second time');
  assert.deepEqual(writeIndex(order, index), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.throws(() => adoptOrder(['a', 'x', 'y', 'b'], (() => { const o = join(d, 'tight'); mkdirSync(o); writeFileSync(join(o, '0010-a'), ''); writeFileSync(join(o, '0011-b'), ''); return o; })()), /no rank left/);
});

test('Verse\'s ask: a new skill file in skills/ registers itself at the end of the routing order; libraries and OFF files stay out', async () => {
  const { unregistered, registerNew, OFF } = await import('./skills-index.mjs');
  const { mkdtempSync, writeFileSync: w, readdirSync: ls, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const skill = (n) => "export default {\n  name: '" + n + "',\n  examples: ['x'],\n  match() { return false; },\n  async run() { return 'none'; },\n};\n";
  const files = { 'kettle.js': skill('kettle'), 'tide.js': skill('tide'), 'map.js': skill('map'), 'chess-rules.js': 'export const rules = { name: "x" };', 'odd.js': skill('other-name'), 'index.json': '[]' };
  assert.deepEqual(unregistered(Object.keys(files), (f) => files[f], { tide: 10 }).map((x) => x.name), ['kettle'], 'registered, OFF, a library and a file whose name differs from its skill all stay out');
  assert.ok(OFF.map, 'map is kept out on purpose, with why');
  const root = mkdtempSync(join(tmpdir(), 'skills-')), order = join(root, 'order'); mkdirSync(order);
  for (const [f, t] of Object.entries(files)) w(join(root, f), t);
  w(join(order, '0010-tide'), ''); w(join(order, '1090-draw'), '');
  assert.deepEqual(registerNew(order, root), ['1100-kettle']);
  assert.deepEqual(ls(order).sort(), ['0010-tide', '1090-draw', '1100-kettle']);
  assert.deepEqual(registerNew(order, root), [], 'twice is the same as once');
});


test('adoption and discovery share retirement policy: retired drafts stay out while a genuinely new skill registers', async () => {
  const { OFF, registerNew } = await import('./skills-index.mjs');
  const { RETIRED, unlistedSkills } = await import('./skills-unlisted.mjs');
  assert.deepEqual(RETIRED.slice().sort(), Object.keys(OFF).sort(), 'one policy, not two lists that can drift');
  const root = mkdtempSync(join(tmpdir(), 'skills-retired-')), order = join(root, 'order');
  mkdirSync(order);
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  const skill = (n) => `export default { name: '${n}', match() { return false; }, run() {} };\n`;
  // A stale deployment index must neither re-adopt a retired draft nor hide a new skill.
  writeFileSync(join(root, 'index.json'), '["system-plan"]');
  for (const n of [...RETIRED, 'new-skill']) writeFileSync(join(root, n + '.js'), skill(n));
  assert.deepEqual(await unlistedSkills(root), ['new-skill']);
  assert.deepEqual(adoptOrder(JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')), order), [], 'a stale index cannot re-adopt a retired draft');
  assert.deepEqual(registerNew(order, root), ['0010-new-skill']);
  assert.deepEqual(registerNew(order, root), [], 'adoption is idempotent');
  assert.deepEqual(await unlistedSkills(root), []);
  assert.deepEqual(writeIndex(order, join(root, 'index.json')), ['new-skill']);
  assert.ok(OFF['system-plan'], 'the deliberately retired overlapping draft is not resurrected');
});
