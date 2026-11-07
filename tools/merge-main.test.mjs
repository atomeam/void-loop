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

// domains/handoff.md and tools/families.mjs are append-mostly: two branches adding a line/skill at the same spot
// conflict, and merge-main settles them by keeping both sides' new lines instead of stopping for a person
function textRepo(files) {
  // files: { path: [base, mainSide, branchSide] }
  const root = mkdtempSync(join(tmpdir(), 'merge-main-')), sh = (cwd, c) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh(root, 'git init -q --bare -b main origin.git');
  const clone = (d) => { sh(root, `git clone -q origin.git ${d}`); sh(join(root, d), 'git config user.email t@example.invalid && git config user.name t && git config commit.gpgsign false'); return join(root, d); };
  const put = (dir, path, text) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const a = clone('a'); sh(a, 'git checkout -q -b main');
  for (const [p, v] of Object.entries(files)) put(a, p, v[0]);
  sh(a, 'git add -A && git commit -q -m base && git push -q origin main');
  const m = clone('m'); sh(m, 'git checkout -q main');
  for (const [p, v] of Object.entries(files)) put(m, p, v[1]);
  sh(m, 'git add -A && git commit -q -m "main adds" && git push -q origin main');
  sh(a, 'git checkout -q -b branch');
  for (const [p, v] of Object.entries(files)) put(a, p, v[2]);
  sh(a, 'git add -A && git commit -q -m "branch adds"');
  return a;
}

test('merge-main settles an append-collision in domains/handoff.md by keeping both sides\' lines', () => {
  const base = '# Handoff\n\n## Working on\n\n- claude · x · one · now\n';
  const mainSide = base + '\n- beam · y · two · now\n';
  const branchSide = base + '\n- mistrallarge4 · z · three · now\n';
  const a = textRepo({ 'domains/handoff.md': [base, mainSide, branchSide] });
  const r = mergeMain(a);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = readFileSync(join(a, 'domains/handoff.md'), 'utf8');
  assert.ok(out.includes('- beam · y · two') && out.includes('- mistrallarge4 · z · three'), 'both lines kept: ' + JSON.stringify(out));
});

test('merge-main settles an append-collision in tools/families.mjs the same way', () => {
  const line = (skills) => `  { id: 'self', name: 'Verse itself', skills: [${skills.map((s) => "'" + s + "'").join(', ')}] },\n`;
  const base = 'export const FAMILIES = [\n' + line(['a', 'b']) + '];\n';
  const mainSide = 'export const FAMILIES = [\n' + line(['a', 'b', 'c']) + '];\n';
  const branchSide = 'export const FAMILIES = [\n' + line(['a', 'b', 'd']) + '];\n';
  const a = textRepo({ 'tools/families.mjs': [base, mainSide, branchSide] });
  const r = mergeMain(a);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = readFileSync(join(a, 'tools/families.mjs'), 'utf8');
  assert.ok(out.includes("'c'") && out.includes("'d'"), 'both skills kept: ' + JSON.stringify(out));
});
