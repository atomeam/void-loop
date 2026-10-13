// tools/review-overrides.mjs: each "void-review: ok" line, and which rule still fires there once the marker is taken out
import assert from 'node:assert/strict';
import { overridesIn, summarize } from './review-overrides.mjs';
const code = [
  'const a = 1;',
  "el.innerHTML = name; // void-review: ok: name is fixed text",
  '// void-review: ok: the next line is fine',
  '// (a second comment line)',
  "box.innerHTML = '<b>' + esc(x) + '</b>';",
].join('\n');
const rows = overridesIn('x.js', code);
assert.deepEqual(rows.map((r) => [r.line, r.rules]), [[2, ['inner-html']], [5, []]]); // the marker on its own line speaks for the next line of code
const s = summarize(rows);
assert.deepEqual(s.rules, [{ rule: 'inner-html', n: 1 }]);
assert.equal(s.idle.length, 1);
assert.deepEqual(overridesIn('y.js', 'const b = 2;'), []);
console.log('review-overrides: all passed');
