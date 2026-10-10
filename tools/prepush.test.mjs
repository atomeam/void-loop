import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { problemsIn } from './prepush.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('problemsIn finds a conflict marker, a script that does not parse and a JSON file that does not parse', () => {
  const marker = ['<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> origin/main'].join('\n');
  const p = problemsIn([
    { path: 'domains/log.md', text: 'fine\n' + marker + '\n' },
    { path: 'tools/x.mjs', text: 'export const a = ;\n' },
    { path: 'void-live-deploy/void.growth.json', text: '[\n  {"a": 1}\n  {"a": 2}\n]\n' },
    { path: 'tools/ok.mjs', text: "import fs from 'node:fs';\nexport default fs;\n" },
    { path: 'tools/ok.json', text: '{"a": [1, 2]}' },
    { path: 'img.png', text: 'x\0y' },
  ]);
  assert.equal(p.length, 3, p.join(' | '));
  assert.match(p[0], /^domains\/log\.md: conflict marker at line 2/);
  assert.match(p[1], /^tools\/x\.mjs: does not parse/);
  assert.match(p[2], /^void-live-deploy\/void\.growth\.json: not valid JSON/);
});

test('a file that talks about conflict markers is not one (a lone ======= or a marker-looking string in code)', () => {
  assert.deepEqual(problemsIn([{ path: 'a.md', text: 'Title\n=======\ntext\n' }, { path: 'b.mjs', text: "export const m = '<<<<<<< not at the start';\n" }]), []);
});

// a real repo with a real origin: the push script refuses a broken commit, sends a good one
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'prepush-')), sh = (cwd, c) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh(root, 'git init -q --bare -b main origin.git && git clone -q origin.git w');
  const w = join(root, 'w');
  sh(w, 'git config user.email t@example.invalid && git config user.name t && git config commit.gpgsign false && git checkout -q -b main');
  writeFileSync(join(w, 'ledger.json'), '[\n  {"a": 1}\n]\n');
  sh(w, 'git add -A && git commit -q -m base && git push -q origin main && git checkout -q -b work');
  return { w, sh };
}
const pushjs = (cwd, env = {}) => spawnSync(process.execPath, [join(here, 'push.mjs')], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });

test('push.mjs refuses a branch whose commit has a missing comma in a JSON file, and pushes it once fixed', () => {
  const { w, sh } = repo();
  writeFileSync(join(w, 'ledger.json'), '[\n  {"a": 1}\n  {"a": 2}\n]\n');
  sh(w, 'git add -A && git commit -q -m broken');
  const bad = pushjs(w);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /ledger\.json: not valid JSON/);
  assert.match(bad.stderr, /nothing pushed/);
  assert.equal(sh(w, 'git ls-remote origin refs/heads/work').trim(), '', 'the branch never reached the remote');
  writeFileSync(join(w, 'ledger.json'), '[\n  {"a": 1},\n  {"a": 2}\n]\n');
  sh(w, 'git add -A && git commit -q -m fixed');
  const good = pushjs(w);
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /pushed work at/);
});

test('push.mjs refuses a conflict marker and a script that does not parse; VOID_SKIP_PREPUSH=1 lets a push through', () => {
  const { w, sh } = repo();
  mkdirSync(join(w, 'tools'));
  writeFileSync(join(w, 'notes.md'), 'x\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> origin/main\n');
  writeFileSync(join(w, 'tools', 'x.mjs'), 'const = 1;\n');
  sh(w, 'git add -A && git commit -q -m bad');
  const r = pushjs(w);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /notes\.md: conflict marker at line 2/);
  assert.match(r.stderr, /tools\/x\.mjs: does not parse/);
  const forced = pushjs(w, { VOID_SKIP_PREPUSH: '1' });
  assert.equal(forced.status, 0, forced.stderr);
});
