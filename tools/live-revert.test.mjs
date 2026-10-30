// node tools/live-revert.test.mjs — the live-revert workflow stays a pull request, never a push to main or a force-push.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const y = readFileSync(new URL('../.github/workflows/live-revert.yml', import.meta.url), 'utf8');
const run = y.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
assert.ok(!/push[^\n]*origin (HEAD:)?main/.test(run), 'never pushes main');
assert.ok(!/--force|-f origin|push -f/.test(run), 'never force-pushes');
assert.match(run, /gh pr create[^\n]*--label automerge/); assert.match(run, /Verse-auto-revert:/);
assert.match(run, /conclusion == 'failure'/); assert.match(run, /already reverted/);
console.log('live-revert: ok');
