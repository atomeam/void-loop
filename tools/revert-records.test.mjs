import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { withoutAdded, entrySpans, dropEntries } from './revert-records.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LEDGER = 'void-live-deploy/void.growth.json', BENCH = 'tools/bench.json', PAGE = 'void.html';

test('withoutAdded drops only what the reverted commit added', () => {
  const ours = [{ ask: 'a' }, { ask: 'b' }, { ask: 'c' }];
  assert.deepEqual(withoutAdded(BENCH, ours, [{ ask: 'a' }, { ask: 'b' }], [{ ask: 'a' }]), [{ ask: 'a' }, { ask: 'c' }]);
  assert.deepEqual(withoutAdded('index.json', ['x', 'y'], ['x', 'y'], ['x', 'y']), ['x', 'y'], 'a commit that added nothing drops nothing');
});

test('dropEntries keeps every other byte of a mixed-style file', () => {
  const t = '[\n  {\n    "ask": "a, [b]",\n    "want": "x"\n  },\n  {"ask": "c \\"q\\"", "want": "y"},\n  {"ask": "d"}\n]\n';
  assert.equal(entrySpans(t).length, 3);
  assert.equal(dropEntries(t, new Set()), t);
  assert.equal(dropEntries(t, new Set([1])), '[\n  {\n    "ask": "a, [b]",\n    "want": "x"\n  },\n  {"ask": "d"}\n]\n');
  assert.equal(dropEntries(t, new Set([2])), '[\n  {\n    "ask": "a, [b]",\n    "want": "x"\n  },\n  {"ask": "c \\"q\\"", "want": "y"}\n]\n');
  assert.deepEqual(JSON.parse(dropEntries(t, new Set([0, 1, 2]))), []);
  assert.equal(dropEntries('["a", "b", "c"]\n', new Set([0])), '["b", "c"]\n');
});

// a real jam: a commit adds a ledger line, a bench ask and breaks the page; later merges append after it; then it is reverted
function repo() {
  const d = mkdtempSync(join(tmpdir(), 'revert-records-')), sh = (c) => execSync(c, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh('git init -q -b main && git config user.email t@example.invalid && git config user.name t && git config commit.gpgsign false');
  mkdirSync(join(d, 'void-live-deploy'), { recursive: true }); mkdirSync(join(d, 'tools'), { recursive: true });
  const put = (f, t) => writeFileSync(join(d, f), t);
  put(LEDGER, '[\n  {"at": "1", "by": "a", "kind": "build", "what": "base"}\n]\n');
  put(BENCH, '[\n  {\n    "ask": "base ask",\n    "want": "x"\n  }\n]\n');
  put(PAGE, 'good page\n');
  sh('git add -A && git commit -q -m base');
  put(LEDGER, '[\n  {"at": "1", "by": "a", "kind": "build", "what": "base"},\n  {"at": "2", "by": "b", "kind": "build", "what": "the broken one"}\n]\n');
  put(BENCH, '[\n  {\n    "ask": "base ask",\n    "want": "x"\n  },\n  {"ask": "broken ask", "want": "y"}\n]\n');
  put(PAGE, 'broken page\n');
  sh('git add -A && git commit -q -m broken');
  const bad = sh('git rev-parse HEAD').trim();
  put(LEDGER, '[\n  {"at": "1", "by": "a", "kind": "build", "what": "base"},\n  {"at": "2", "by": "b", "kind": "build", "what": "the broken one"},\n  {"at": "3", "by": "c", "kind": "fix", "what": "later"}\n]\n');
  put(BENCH, '[\n  {\n    "ask": "base ask",\n    "want": "x"\n  },\n  {"ask": "broken ask", "want": "y"},\n  {"ask": "later ask", "want": "z"}\n]\n');
  sh('git add -A && git commit -q -m later');
  return { d, sh, bad };
}

test('a revert that conflicts only in the records goes through, keeping history and what merged since', () => {
  const { d, sh, bad } = repo();
  assert.throws(() => sh(`git revert --no-commit ${bad}`), 'without the tool the revert jams');
  const r = spawnSync(process.execPath, [join(here, 'revert-records.mjs')], { cwd: d, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(d, PAGE), 'utf8'), 'good page\n', 'the broken change is taken back');
  const ledger = JSON.parse(readFileSync(join(d, LEDGER), 'utf8')).map((x) => x.what);
  assert.deepEqual(ledger, ['base', 'the broken one', 'later'], 'history is never taken back');
  assert.equal(readFileSync(join(d, BENCH), 'utf8'), '[\n  {\n    "ask": "base ask",\n    "want": "x"\n  },\n  {"ask": "later ask", "want": "z"}\n]\n', 'only the reverted ask goes; the rest byte for byte');
  assert.equal(sh('git diff --name-only --diff-filter=U').trim(), '', 'nothing left conflicted');
  sh('git commit -q -m revert');
});

test('a conflict outside the records still stops for a person', () => {
  const { d, sh, bad } = repo();
  writeFileSync(join(d, PAGE), 'someone changed it since\n');
  sh('git add -A && git commit -q -m since');
  try { sh(`git revert --no-commit ${bad}`); } catch (_) {}
  const r = spawnSync(process.execPath, [join(here, 'revert-records.mjs')], { cwd: d, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /outside the append-only records: void\.html/);
});
