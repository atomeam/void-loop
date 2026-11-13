import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { mergeIndex } from './merge-index.mjs';
import { mergeInbox, mergeRegistry, stages } from './shared-merge.mjs';
import { claim, guarded, CAP } from './fix-cap.mjs';

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

test('merge-main settles a skill-index collision as the union, keyed by id and sorted', () => {
  const a = repo(['a', 'b', 'c', 'x'], ['a', 'b', 'c', 'y']);
  const r = mergeMain(a);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /keyed by skill id, sorted/);
  assert.deepEqual(JSON.parse(readFileSync(join(a, INDEX), 'utf8')), ['a', 'b', 'c', 'x', 'y']);
  assert.equal(execSync('git status --porcelain', { cwd: a, encoding: 'utf8' }).trim(), '', 'the merge is committed');
});

test('a rebase onto main settles the index with main in stage 2', () => {
  assert.deepEqual(stages(false), { main: 3, pr: 2 });
  assert.deepEqual(stages(true), { main: 2, pr: 3 });
  const a = repo(['a', 'b', 'c', 'x'], ['a', 'b', 'c', 'y']);
  execSync('git fetch -q origin main', { cwd: a, stdio: 'ignore' });
  const conflict = spawnSync('git', ['rebase', 'origin/main'], { cwd: a, encoding: 'utf8' });
  assert.notEqual(conflict.status, 0, 'the two indexes conflict');
  const r = spawnSync(process.execPath, [join(here, 'shared-merge.mjs'), '--rebase'], { cwd: a, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(a, INDEX), 'utf8')), ['a', 'b', 'c', 'x', 'y']);
});

test('merge-main still settles the index when the two sides order shared names differently', () => {
  const a = repo(['a', 'b', 'c', 'x'], ['a', 'c', 'b']);
  const r = mergeMain(a);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(a, INDEX), 'utf8')), ['a', 'b', 'c', 'x']);
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

// the same, for one generated file both sides changed
function repoFile(file, base, mainText, branchText) {
  const root = mkdtempSync(join(tmpdir(), 'merge-main-')), sh = (cwd, c) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh(root, 'git init -q --bare -b main origin.git');
  const clone = (d) => { sh(root, `git clone -q origin.git ${d}`); sh(join(root, d), 'git config user.email t@example.invalid && git config user.name t && git config commit.gpgsign false'); return join(root, d); };
  const put = (dir, text) => { mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), text); };
  const a = clone('a'); sh(a, 'git checkout -q -b main'); put(a, base); sh(a, 'git add -A && git commit -q -m base && git push -q origin main');
  const m = clone('m'); sh(m, 'git checkout -q main'); put(m, mainText); sh(m, 'git add -A && git commit -q -m "main moves the line" && git push -q origin main');
  sh(a, 'git checkout -q -b branch'); put(a, branchText); sh(a, 'git add -A && git commit -q -m "branch moves the line"');
  return a;
}

test('merge-main takes main\'s side of a conflicted parity inventory instead of stopping for a person', () => {
  const inv = 'docs/PARITY/site.md', a = repoFile(inv, 'cites line 10\n', 'cites line 12\n', 'cites line 11\n');
  const r = mergeMain(a);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(a, inv), 'utf8'), 'cites line 12\n');
  assert.equal(execSync('git status --porcelain', { cwd: a, encoding: 'utf8' }).trim(), '', 'the merge is committed');
});

test('merge-main still stops for a person on a conflict in a file nobody generates', () => {
  const a = repoFile('docs/notes.md', 'one\n', 'two\n', 'three\n');
  const r = mergeMain(a);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /conflicts need a person: docs\/notes\.md/);
});

test('a growth-inbox row never goes backwards, and a new ask is kept', () => {
  const table = (rows) => '| status | date | ask | source |\n| --- | --- | --- | --- |\n' + rows.join('\n') + '\n';
  const main = table(['| shipped abc | 2026-11-01 | share this card | plan |', '| open | 2026-11-02 | a new timer | idea |']);
  const pr = table(['| open | 2026-11-03 | share this card | old |', '| building | 2026-11-04 | a new timer | idea |', '| open | 2026-11-05 | draw a map | idea |']);
  const rows = (text) => text.split('\n').filter((l) => l.startsWith('|') && !/status|---/.test(l));
  const got = rows(mergeInbox(main, pr));
  assert.ok(got.some((l) => /shipped abc/.test(l) && /share this card/.test(l)), 'a shipped row stays shipped');
  assert.ok(got.some((l) => /building/.test(l) && /a new timer/.test(l)), 'open moves forward to building');
  assert.ok(got.some((l) => /draw a map/.test(l)));
  assert.deepEqual(mergeRegistry(['b', 'a'], ['c', 'a']), ['a', 'b', 'c']);
});

test('the copy rewriter and the conflict fixer each stop after two attempts', () => {
  let comments = [];
  const write = () => true;
  for (let i = 0; i < CAP; i++) {
    const step = guarded(comments, 'copy', write);
    assert.equal(step.allowed, true);
    assert.equal(step.wrote, true);
    comments = [{ id: 1, body: step.body }];
  }
  const third = guarded(comments, 'copy', write);
  assert.equal(third.allowed, false);
  assert.equal(third.wrote, false);
  const conflict = claim(comments, 'conflict');
  assert.equal(conflict.allowed, true);
  assert.equal(claim([{ body: conflict.body }], 'conflict').count, 2);
  assert.equal(claim([{ body: '<!-- fix-cap copy=0 conflict=2 -->' }], 'conflict').allowed, false);
});
