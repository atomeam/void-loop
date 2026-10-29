import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 2026-10-18: the scheduled benchmark on main was cancelled by another run on main, so tools/bench.misses.json (what the self card's "failing" list
// reads) stayed two days old. A run on main must never cancel another run on main; a newer push to a pull request may cancel its own older run.
test('the benchmark workflow cancels superseded pull request runs only, never a run on main', () => {
  const y = readFileSync(new URL('../.github/workflows/bench.yml', import.meta.url), 'utf8');
  const m = /concurrency:\s*\n\s*group: ([^\n]+)\n(?:\s*#[^\n]*\n)*\s*cancel-in-progress: ([^\n]+)/.exec(y);
  assert.ok(m, 'bench.yml has a concurrency block');
  assert.match(m[1], /pull_request\.number \|\| github\.ref/, 'one group per pull request, one for main');
  assert.match(m[2], /github\.event_name == 'pull_request'/, 'only pull request runs are cancelled');
  assert.doesNotMatch(m[2].trim(), /^true$/, 'a literal true would let one run on main cancel another');
});
