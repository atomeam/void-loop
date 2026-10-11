// docs/MAP.md never falls behind again (pit crew position 2, 2026-10-11; RULES: the map was "four days late" once): every
// routable skill (skills/index.json), every miniature (skills/mini/), every workflow (.github/workflows/) and every tool in
// tools/ (tests aside) is named in docs/MAP.md, or, for a tool nothing uses, on the salvage shelf (docs/SALVAGE.md).
// Fails naming what is missing: add one line for it to docs/MAP.md (node tools/finish.mjs reminds you).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const names = (dir, re) => (existsSync(resolve(root, dir)) ? readdirSync(resolve(root, dir)).filter((f) => re.test(f)) : []);
const named = (text, n) => new RegExp('(^|[^A-Za-z0-9_-])' + n.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '([^A-Za-z0-9_-]|$)').test(text);

/** what the map does not name: [{ kind, name }]. Pure. */
export function uncovered({ skills = [], minis = [], workflows = [], tools = [] }, map, salvage = '') {
  return [
    ...skills.filter((n) => !named(map, n)).map((name) => ({ kind: 'skill', name })),
    ...minis.filter((n) => !named(map, n.replace(/\.js$/, ''))).map((name) => ({ kind: 'miniature', name })),
    ...workflows.filter((n) => !named(map, n)).map((name) => ({ kind: 'workflow', name })),
    ...tools.filter((n) => !named(map, n) && !named(salvage, n)).map((name) => ({ kind: 'tool', name })),
  ];
}

export function repoParts() {
  return {
    skills: JSON.parse(read('void-live-deploy/skills/index.json')),
    minis: names('void-live-deploy/skills/mini', /\.js$/),
    workflows: names('.github/workflows', /\.ya?ml$/),
    tools: names('tools', /\.(mjs|py|ps1)$/).filter((f) => !/\.test\.mjs$|_test\.py$|^test_/.test(f)),
  };
}

test('uncovered names only what the map leaves out', () => {
  const parts = { skills: ['tide', 'chess'], minis: ['boat.js'], workflows: ['deploy.yml', 'new.yml'], tools: ['grow.mjs', 'old.py', 'gone.mjs'] };
  const map = 'the chess skill; `deploy.yml`; `grow.mjs`; the boat miniature; chess-rules too';
  assert.deepEqual(uncovered(parts, map, '`old.py` on the shelf'), [
    { kind: 'skill', name: 'tide' }, { kind: 'workflow', name: 'new.yml' }, { kind: 'tool', name: 'gone.mjs' }]);
  assert.deepEqual(uncovered({ skills: ['tide'] }, 'tide-tables only'), [{ kind: 'skill', name: 'tide' }], 'a longer name is not this one');
});

test('docs/MAP.md names every skill, miniature, workflow and tool in the repo', () => {
  const miss = uncovered(repoParts(), read('docs/MAP.md'), read('docs/SALVAGE.md'));
  assert.deepEqual(miss, [], 'add one line to docs/MAP.md for: ' + miss.map((m) => m.kind + ' ' + m.name).join(', '));
});
