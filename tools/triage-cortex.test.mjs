import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { scopeOf, preflight, changedLines, splitBoard, CAPS } from './triage-cortex.mjs';

test('a task that names a file or a failing test passes; a vague one is refused', () => {
  assert.equal(preflight({ kind: 'next', text: 'make Verse smarter and more capable' }).ok, false);
  assert.equal(preflight({ kind: 'next', text: 'improve the store page' }).ok, false);
  const f = preflight({ kind: 'next', text: 'Add a CSV export to void-live-deploy/skills/tables.js' });
  assert.equal(f.ok, true); assert.deepEqual(f.files, ['void-live-deploy/skills/tables.js']);
  const t = preflight({ kind: 'next', text: 'make failing test "fly stars move" pass' });
  assert.equal(t.ok, true); assert.deepEqual(t.tests, ['fly stars move']);
  assert.deepEqual(scopeOf('see tools/lab-theme.test.mjs.').files, ['tools/lab-theme.test.mjs']);
  assert.deepEqual(scopeOf('[assimilation gap] site A → /a/ (2026-10-28): the weather tools.').files, ['void-live-deploy/a/index.html']);
  assert.deepEqual(scopeOf('see tools/lab-theme.test.mjs.').tests, ['tools/lab-theme.test.mjs']);
});

test('red checks, probes and grooms are already scoped; a red check with no name is not', () => {
  assert.equal(preflight({ kind: 'fix', check: 'families' }).ok, true);
  assert.equal(preflight({ kind: 'heal', check: 'void-review' }).ok, true);
  assert.equal(preflight({ kind: 'fix', check: '' }).ok, false);
  assert.equal(preflight({ kind: 'probe' }).ok, true);
  assert.equal(preflight({ kind: 'groom' }).ok, true);
});

test('caps, changed lines and the think-tank board split', () => {
  assert.deepEqual(CAPS, { issues: 1, reads: 6, lines: 120 });
  assert.equal(changedLines('10\t2\ta.js\n-\t-\timg.png\n100\t9\tb.js\n'), 121);
  const b = splitBoard(['read more papers', 'wire docs/NEXT.md ranking into tools/verse-loop.mjs']);
  assert.deepEqual(b, { scoped: ['wire docs/NEXT.md ranking into tools/verse-loop.mjs'], unscoped: ['read more papers'] });
});

test('the CLI answers in one JSON line, exit 0, well under a second', () => {
  const t0 = Date.now();
  const out = JSON.parse(execFileSync(process.execPath, [new URL('./triage-cortex.mjs', import.meta.url).pathname, '--task', 'tidy things up'], { encoding: 'utf8' }));
  assert.equal(out.ok, false); assert.equal(out.caps.reads, 6);
  assert.ok(Date.now() - t0 < 1000, 'took ' + (Date.now() - t0) + ' ms');
});
