import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEPS, pick } from './refresh.mjs';

const here = dirname(fileURLToPath(import.meta.url)), read = (p) => readFileSync(resolve(here, '..', p), 'utf8');

test('every step names a script that exists, a check form, and is listed once', () => {
  assert.equal(new Set(STEPS.map((s) => s.name)).size, STEPS.length);
  for (const s of STEPS) {
    assert.ok(existsSync(resolve(here, s.script)), s.script);
    assert.ok(Array.isArray(s.write) && Array.isArray(s.check) && s.check.includes('--check'), s.name);
    assert.ok(s.why && s.why.length > 10, s.name + ' says why');
  }
});

test('the order is the dependency order: index, then deps, families, the book, and Verse\'s facts last', () => {
  const names = STEPS.map((s) => s.name), at = (n) => names.indexOf(n);
  assert.ok(at('index') < at('deps') && at('deps') < at('families') && at('families') < at('guide') && at('guide') < at('what') && at('what') < at('self'));
});

test('pick keeps STEPS order whatever order it is asked in, and refuses an unknown name', () => {
  assert.deepEqual(pick(['guide', 'index']).map((s) => s.name), ['index', 'guide']);
  assert.equal(pick([]).length, STEPS.length);
  assert.throws(() => pick(['nope']), /unknown step: nope/);
});

test('the deploy regenerates every card through this tool, and the checks cover the committed ones', () => {
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(deploy, /node tools\/refresh\.mjs --keep-going/, 'deploy.yml runs the whole ordered refresh');
  for (const s of STEPS) assert.doesNotMatch(deploy, new RegExp('^\\s*node tools/' + s.script.replace('.', '\\.') + '\\b', 'm'), s.script + ' is called alone in deploy.yml: it belongs in refresh.mjs');
  assert.match(read('tools/checks.mjs'), /refresh\.mjs/);
});

test('the volatile steps are exactly the ones that embed the newest commits, counts or commit dates', () => {
  assert.deepEqual(STEPS.filter((s) => s.volatile).map((s) => s.name), ['asks', 'self', 'bench-alarms', 'churn', 'sitemap']);
});
