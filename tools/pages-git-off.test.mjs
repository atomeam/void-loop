// The Cloudflare Pages Git integration must never publish the repo root over the real site (lists run 15, 2026-11-09: every Git
// build replaced production with a copy that had no Functions, so /api/*, /tools.json and /team/mcp answered empty 404s until the
// next Actions deploy). The root wrangler.toml points Git builds at an output folder that never exists, so they fail and publish
// nothing; deploy.yml's direct upload reads void-live-deploy/wrangler.toml. Run: node --test tools/pages-git-off.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootToml = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');
const field = (toml, k) => (new RegExp('^' + k + '\\s*=\\s*"([^"]*)"', 'm').exec(toml) || [])[1];

test('a Git build of the repo root points at an output folder that does not exist', () => {
  assert.equal(field(rootToml, 'name'), 'a-to-mind', 'Pages reads the file only when it names the project');
  const out = field(rootToml, 'pages_build_output_dir');
  assert.ok(out, 'the root file sets pages_build_output_dir (without it Pages ignores the file and publishes the root)');
  assert.ok(!existsSync(resolve(root, out)), out + ' must never exist: a Git build would publish it');
});

test('the root file binds nothing, so it can never stand in for the real config', () => {
  for (const k of ['kv_namespaces', 'd1_databases', 'r2_buckets', 'ai', 'vars']) assert.ok(!new RegExp('^\\[\\[?' + k, 'm').test(rootToml), k);
});

test('the Actions deploy still uploads void-live-deploy with its own config', () => {
  const deploy = readFileSync(resolve(root, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(deploy, /workingDirectory: void-live-deploy/);
  assert.match(deploy, /pages deploy \. --project-name=a-to-mind/);
  const site = readFileSync(resolve(root, 'void-live-deploy/wrangler.toml'), 'utf8');
  assert.equal(field(site, 'pages_build_output_dir'), '.');
  assert.match(site, /\[\[kv_namespaces\]\]/);
});
