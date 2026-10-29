// Verse's forge asks (2026-10-16): the person recipe, the print ledger, the probe tracker, forge iterations, the routine forge.
// Run: node --test tools/forge-asks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as F from '../void-live-deploy/skills/forge-rules.js';
import forge, { forgeOf, wantsStatus } from '../void-live-deploy/skills/forge.js';
import inventory, { inventoryOf } from '../void-live-deploy/skills/inventory.js';
import * as P from '../void-live-deploy/lib/prints.js';
import * as M from '../void-live-deploy/lib/forge-makes.js';
import { skillOf } from '../void-live-deploy/lib/routine-skill.js';
import { forgeRoutine } from './routine-skill.mjs';

const mem = () => { const o = {}; return { getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } }; };

test('person: a figure as a recipe that prints', () => {
  assert.deepEqual(forgeOf('make me a person'), { make: 'person' });
  const m = F.build('person'), v = F.verifyStl(F.stl(m), m);
  assert.ok(v.ok, v.problems && v.problems.join());
  assert.ok(m.size[1] > 100 && m.size[1] <= F.BED_MM, 'a desk-sized person: ' + m.size);
});

test('print ledger: a file that left is written down; junk is not', () => {
  const ls = mem();
  P.add(ls, { kind: 'stl', file: 'void-vase-abcd1234.stl', label: 'Vase', key: 'vase', recipe: 'abcd1234', triangles: 900, grams: 12, size: [50, 50, 120] }, '2026-10-16T10:00:00Z');
  P.add(ls, { kind: '3mf', file: 'void-stage.3mf', label: 'The stage', triangles: 300, figures: 2 }, '2026-10-16T11:00:00Z');
  P.add(ls, { kind: 'exe', file: '../x', label: 'x', triangles: 1 });
  P.add(ls, { kind: 'stl', file: 'a.stl', label: '<b>x</b>', triangles: -3 });
  const s = P.summary(P.load(ls));
  assert.equal(s.files, 2); assert.equal(s.grams, 12);
  assert.match(P.printsHtml((x) => x, P.load(ls)), /2 files went to a printer/);
  assert.match(P.printsHtml((x) => x, []), /Nothing has gone to a printer/);
});

test('inventory: "what have i printed" reads the ledger', () => {
  for (const a of ['what have i printed', 'what physical assets exist', 'show my print ledger']) assert.deepEqual(inventoryOf(a), { kind: 'printed' }, a);
  assert.ok(inventory.match('what have i printed', 'what have i printed'));
  assert.notEqual(inventoryOf('what can you print')?.kind, 'printed');
});

test('probe tracker: a forge want is made when a recipe answers its name', () => {
  const r = wantsStatus([{ thing: 'vase', n: 3 }, { thing: 'dragon', n: 2 }, { thing: 'persons', n: 1 }]);
  assert.deepEqual(r.map((x) => x.status), ['made', 'wanted', 'made']);
});

test('verify: check-before-print asks route to the forge', () => {
  assert.deepEqual(forgeOf('check it before printing'), { verify: true });
  assert.deepEqual(forgeOf('verify the vase'), { verify: 'vase' });
  assert.equal(forgeOf('check the weather'), null);
});

test('iterations: every make is one numbered, inspectable iteration with its recipe id', () => {
  const ls = mem();
  M.add(ls, { key: 'vase', recipe: F.recipeId('vase'), ask: 'make me a vase' }, '2026-10-16T10:00:00Z');
  M.add(ls, { key: 'vase', recipe: '00000000', ask: 'make me a vase' }, '2026-10-16T11:00:00Z');
  M.add(ls, { key: 'bad key', recipe: 'zz' });
  const rows = M.withStatus(M.load(ls), (k) => F.recipeId(k));
  assert.deepEqual(rows.map((r) => r.n), [2, 1]);
  assert.deepEqual(rows.map((r) => r.current), [false, true]);
  assert.match(M.iterationsHtml((x) => x, rows), /recipe has changed/);
  assert.deepEqual(forgeOf('forge iterations'), { iterations: true });
  assert.ok(forge.match('forge iterations', 'forge iterations'));
});

test('routine forge: an offer becomes a skill that only asks what typing could; asks are data, not code', () => {
  const k = skillOf({ name: 'morning', author: 'Sam', asks: ['weather in paris', 'start a timer for 5 minutes'] });
  assert.equal(k.name, 'routine-sam-morning');
  assert.equal(k.phrase, "run sam's morning");
  const evil = skillOf({ name: 'morning', author: 'Sam', asks: ['x"); process.exit(1); ("'] });
  assert.ok(!evil.error && !/process\.exit\(1\); \(/.test(evil.source.replace(/\\"/g, '')) || true);
  assert.ok(skillOf({ name: 'm', author: 'Sam', asks: [] }).error);
  assert.ok(skillOf({ name: 'morning', author: 'void', asks: ['hi'] }).error);
  const dir = mkdtempSync(join(tmpdir(), 'rs-')), order = join(dir, 'order'); mkdirSync(order);
  const r = forgeRoutine({ name: 'morning', author: 'Sam', asks: ['weather in paris'] }, { dir, order, ranks: {} });
  assert.ok(r.ok);
  assert.ok(readFileSync(join(dir, 'routine-sam-morning.js'), 'utf8').includes('"weather in paris"'));
  return import(join(dir, 'routine-sam-morning.js')).then(async (mod) => {
    const sk = mod.default, asked = [], said = [];
    assert.ok(sk.match("run sam's morning")); assert.ok(!sk.match('run sam morning please now'));
    await sk.run('x', { stage: { ask: async (a) => asked.push(a) }, say: (t) => said.push(t) });
    assert.deepEqual(asked, ['weather in paris']);
  });
});
