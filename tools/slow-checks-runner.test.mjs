// The two longest browser checks (perf3d, glyphs) run on their own runners in verify.yml (asked by Verse; lists run 16): a job of their own,
// one matrix entry each, and neither runs inside the browser suite's shards or the fast tests any more, so neither holds the other jobs up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const verify = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
const action = readFileSync(new URL('../.github/actions/void-test/action.yml', import.meta.url), 'utf8');
const jobOf = (name) => { const m = verify.match(new RegExp('\\n  ' + name + ':\\n([\\s\\S]*?)(?=\\n  [a-z][\\w-]*:\\n|$)')); return m ? m[1] : ''; };

test('slow-browser-checks is its own job with perf3d and glyphs, each its own runner', () => {
  const job = jobOf('slow-browser-checks');
  assert.ok(job, 'verify.yml has the slow-browser-checks job');
  assert.match(job, /check: \[perf3d, glyphs\]/);
  assert.match(job, /fail-fast: false/);
  assert.match(job, /run: node tools\/perf3d\.test\.mjs/);
  assert.match(job, /run: node tools\/test_glyphs\.mjs/);
  assert.doesNotMatch(job, /needs:/, 'it waits on no other job');
});
test('the browser suite no longer runs perf3d after a shard, and the fast tests skip glyphs there', () => {
  assert.doesNotMatch(jobOf('browser-suite'), /perf3d\.test\.mjs/);
  assert.match(jobOf('python-tests'), /glyphs: skip/);
  assert.match(action, /inputs\.glyphs != 'skip'/, "the shared action honours glyphs: skip");
  assert.match(action, /glyphs:\n\s+description:[^\n]*\n\s+default: with/, 'every other caller still runs glyphs');
});
