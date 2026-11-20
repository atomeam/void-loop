// covered.mjs must use skills/order (not the committed index), or a new skill keeps coming back as a will want.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function covered(asks) {
  const r = spawnSync(process.execPath, ['tools/covered.mjs'], {
    input: JSON.stringify(asks),
    encoding: 'utf8',
    cwd: root,
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return JSON.parse(r.stdout);
}

test('covered: a skill with an order file counts even when skills/index.json is stale', () => {
  assert.equal(existsSync(resolve(root, 'void-live-deploy/skills/order/0068-working-on')), true);
  assert.equal(existsSync(resolve(root, 'void-live-deploy/skills/working-on.js')), true);
  const index = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  // the committed index may lag (deploy rewrites it); coverage must not wait on that
  const [yes, no] = covered(['what are you working on', 'xyzzy not a real ask 3197']);
  assert.equal(yes, true);
  assert.equal(no, false);
  if (!index.includes('working-on')) {
    // this is the live failure mode: the will re-chose a want the new skill already answers
    assert.equal(yes, true);
  }
});
