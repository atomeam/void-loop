import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { mergeIndex } from './merge-index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const INDEX = 'void-live-deploy/skills/index.json';

test('mergeIndex keeps main\'s order and puts the branch\'s new names after the name before them', () => {
  assert.deepEqual(mergeIndex(['a', 'b', 'c'], ['a', 'b', 'c', 'y'], ['a', 'b', 'c', 'x']), ['a', 'b', 'c', 'y', 'x'], 'both appended at the tail: both stay, the branch\'s before the entries main added');
  assert.deepEqual(mergeIndex(['a', 'b', 'c'], ['a', 'y', 'z', 'b', 'c'], ['a', 'b', 'c', 'x']), ['a', 'y', 'z', 'b', 'c', 'x'], 'a chain stays in the branch\'s order at the branch\'s place');
  assert.deepEqual(mergeIndex(['a', 'b', 'c'], ['q', 'a', 'b', 'c'], ['a', 'b', 'c', 'x']), ['q', 'a', 'b', 'c', 'x'], 'a name added first goes first');
  assert.deepEqual(mergeIndex(['a', 'b', 'c'], ['a', 'b', 'c', 'y'], ['a', 'c', 'x']), ['a', 'c', 'y', 'x'], 'a name main removed stays removed');
  assert.deepEqual(mergeIndex(['a', 'b'], ['a', 'b', 'x'], ['a', 'b', 'x']), ['a', 'b', 'x'], 'the same addition twice is one');
  assert.deepEqual(mergeIndex(['a', 'b', 'c'], ['a', 'c'], ['a', 'b', 'c', 'x']), ['a', 'b', 'c', 'x'], 'a name only the branch dropped is kept: a dropped skill never loads (9a48e0a)');
});

test('mergeIndex hands back to a person when the two sides order shared names differently', () => {
  assert.equal(mergeIndex(['a', 'b', 'c'], ['a', 'c', 'b'], ['a', 'b', 'c', 'x']), null, 'the branch moved a skill');
  assert.equal(mergeIndex(['a', 'b', 'c'], ['a', 'b', 'c', 'y'], ['b', 'a', 'c']), null, 'main moved a skill');
});

// a real conflict: two clones of one origin each add a skill to the end of the one-line index
function repo(mainList, branchList) {
  const root = mkdtempSync(join(tmpdir(), 'merge-main-')), sh = (cwd, c) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh(root, 'git init -q --bare -b main origin.git');
  const clone = (d) => { sh(root, `git clone -q origin.git ${d}`); sh(join(root, d), 'git config user.email t@example.invalid && git config user.name t && git config commit.gpgsign false'); return join(root, d); };
  const put = (dir, list) => { mkdirSync(join(dir, 'void-live-deploy/skills'), { recursive: true }); writeFileSync(join(dir, INDEX), JSON.stringify(list)); };
  const a = clone('a'); sh(a, 'git checkout -q -b main'); put(a, ['a', 'b', 'c']); sh(a, 'git add -A && git commit -q -m base && git push -q origin main');
  const m = clone('m'); sh(m, 'git checkout -q main'); put(m, mainList); sh(m, 'git add -A && git commit -q -m "main adds" && git push -q origin main');
  sh(a, 'git checkout -q -b branch'); put(a, branchList); sh(a, 'git add -A && git commit -q -m "branch adds"');
  return a;
}
const mergeMain = (cwd) => spawnSync(process.execPath, [join(here, 'merge-main.mjs')], { cwd, encoding: 'utf8' });

test('merge-main settles a tail collision in the skill index by keeping both sides', () => {
  const a = repo(['a', 'b', 'c', 'x'], ['a', 'b', 'c', 'y']);
  const r = mergeMain(a);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /skills\/index\.json: kept main's order and added this branch's new skills/);
  assert.deepEqual(JSON.parse(readFileSync(join(a, INDEX), 'utf8')), ['a', 'b', 'c', 'y', 'x']);
  assert.equal(execSync('git status --porcelain', { cwd: a, encoding: 'utf8' }).trim(), '', 'the merge is committed');
});

test('merge-main still stops for a person when the branch moved a skill', () => {
  const a = repo(['a', 'b', 'c', 'x'], ['a', 'c', 'b']);
  const r = mergeMain(a);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /conflicts need a person: void-live-deploy\/skills\/index\.json/);
});
