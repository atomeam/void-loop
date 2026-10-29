import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

test('the daily smoke test (asked by Verse): skills-check --write records every skill checked and the failing ones, exit 0; the record is what families.mjs reads', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'smoke-')), 'skills-smoke.json');
  const r = spawnSync(process.execPath, [resolve(root, 'tools/skills-check.mjs'), '--write', out], { encoding: 'utf8', cwd: root });
  assert.equal(r.status, 0, r.stderr);
  const rec = JSON.parse(readFileSync(out, 'utf8')), names = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  assert.equal(rec.checked, names.length);
  assert.match(rec.at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof rec.failing, 'object');
  for (const [k, v] of Object.entries(rec.failing)) assert.ok(names.includes(k) && Array.isArray(v) && v.length, k);
  assert.match(r.stdout, /smoke: \d+ skills checked, \d+ failing/);
  // the committed record is today's shape (the upkeep workflow rewrites it daily; a clean tree has no failing skill)
  const kept = JSON.parse(readFileSync(resolve(root, 'tools/skills-smoke.json'), 'utf8'));
  assert.ok(kept.checked > 0 && /^\d{4}-\d{2}-\d{2}$/.test(kept.at), 'tools/skills-smoke.json is a real record (the upkeep workflow rewrites it daily; a PR adding a skill need not)');
  assert.deepEqual(Object.keys(kept.failing).filter((k) => !names.includes(k)), []);
});
