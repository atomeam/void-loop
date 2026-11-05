// Verse's KV namespace is Verse's. Other workers in this repo (the archived ones included) must not bind the same id.
// Run: node --test tools/kv-namespace.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const verseToml = join(root, 'void-live-deploy', 'wrangler.toml');

function tomlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tomlFiles(p, out);
    else if (name === 'wrangler.toml') out.push(p);
  }
  return out;
}

test('only Verse binds its KV namespace', () => {
  const verse = readFileSync(verseToml, 'utf8');
  const id = (verse.match(/\[\[kv_namespaces\]\][\s\S]*?\bid\s*=\s*"([0-9a-f]+)"/) || [])[1];
  assert.ok(id && id.length >= 16, 'Verse names its KV id');
  const others = tomlFiles(root).filter((p) => p !== verseToml);
  const shared = others.filter((p) => readFileSync(p, 'utf8').includes(id)).map((p) => p.slice(root.length));
  assert.deepEqual(shared, [], 'a worker outside void-live-deploy binds Verse\'s KV id ' + id);
  assert.ok(others.length >= 1, 'the other workers are in the tree to be checked');
});
