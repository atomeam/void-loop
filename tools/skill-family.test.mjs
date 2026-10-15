// node --test tools/skill-family.test.mjs: merged skills lose nothing (convergence, owner 2026-10-15: "existing skills should merge").
// Every family in skills/index.json: each member's examples still land on that member through the whole routing order, each
// member's near misses still miss it, the `parts:` line (read by /tools.json and tools/families.mjs) names the members in order,
// and the page's log name (part) is the member's own. Plus the overlap check's pure parts and the route snapshot's scorer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { family } from '../void-live-deploy/lib/skill-family.js';
import { snapshot, right, landing } from './route-snapshot.mjs';
import { pairs, fresh } from './skill-overlap.mjs';

const dir = new URL('../void-live-deploy/skills/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const mods = await Promise.all(index.map(async (n) => (await import(new URL(n + '.js', dir))).default));
const families = mods.filter((m) => m.family);

test('the merged families are listed and their members are not', () => {
  for (const n of ['time', 'dates']) assert.ok(index.includes(n), n);
  for (const f of families) for (const p of f.parts) assert.ok(!index.includes(p), p + ' is listed twice');
});

for (const f of families) test(f.name + ': every old example lands on its own member, every near miss misses it', () => {
  const src = readFileSync(new URL(f.name + '.js', dir), 'utf8');
  const line = /^\s*\*\s*parts:\s*\[([^\]]*)\]/m.exec(src);
  assert.deepEqual(line && Array.from(line[1].matchAll(/'([a-z0-9-]+)'/g)).map((x) => x[1]), f.members.map((m) => m.name.replace(/^nightsky$/, 'night-sky')));
  for (const m of f.members) {
    // its own member, or (as before the merge, when they sat side by side) an earlier sibling: "sunrise" was worldtime's then too
    const i = f.members.indexOf(m), before = new Set(f.members.slice(0, i + 1).map((x) => x.name));
    for (const e of m.examples || []) { const got = landing(mods, e); assert.ok(before.has(got), `${m.name}: "${e}" -> ${got}`); }
    for (const e of m.nearMisses || []) assert.notEqual(landing(mods, e), m.name, `${m.name} near miss: "${e}"`);
  }
});

test('a family asks its members in order and runs the one that matched', async () => {
  const a = { name: 'a', examples: ['x a'], match: (l) => l.includes('a'), run: () => 'ran a' };
  const b = { name: 'b', examples: ['x b', 'a b'], nearMisses: ['zzz'], match: (l) => l.includes('b'), run: () => 'ran b', stageKinds: { k: 1 } };
  const f = family('ab', [a, b]);
  assert.equal(f.part('a b', 'a b'), 'a'); assert.equal(f.part('only b', 'only b'), 'b'); assert.equal(f.part('none', 'none'), null);
  assert.equal(await f.run('B here'), 'ran b'); assert.equal(await f.run('nothing'), 'none');
  assert.deepEqual(f.examples, ['x a', 'x b', 'a b']); assert.deepEqual(f.nearMisses, ['zzz']); assert.deepEqual(f.stageKinds, { k: 1 });
});

test('the overlap check finds a shared example and flags only new pairs', () => {
  const a = { name: 'a', examples: ['red ball'], match: (l) => l.includes('red') }, b = { name: 'b', examples: ['blue'], match: (l) => l.includes('ball') };
  const p = pairs([{ skill: a }, { skill: b }]);
  assert.deepEqual([...p.keys()], ['a~b']);
  assert.deepEqual(fresh(p, ['a~b']), []); assert.deepEqual(fresh(p, []), ['a~b']);
});

test('the route snapshot scores wants the way the benchmark does', async () => {
  assert.ok(right('skill:weather|calc', 'calc')); assert.ok(right('answer', null)); assert.ok(!right('!weather', 'weather')); assert.ok(right('uv', 'uv'));
  const snap = await snapshot();
  assert.equal(snap['weather in paris'].got, 'weather');
});

test('the family files themselves: skills/time.js and skills/dates.js load as families of their members', async () => {
  for (const [file, first] of [['skills/time.js', 'timer'], ['skills/dates.js', 'calendar']]) {
    const f = (await import(new URL('../void-live-deploy/' + file, import.meta.url))).default;
    assert.ok(f.family && f.parts.length > 1, file); assert.equal(f.parts[0], first, file);
  }
});
