// tools/review-bench.mjs: a finding within WINDOW lines of a broken line in the same file is a catch; any other bug or risk is noise.
import assert from 'node:assert/strict';
import { score, WINDOW } from './review-bench.mjs';
const f = (file, line, kind = 'bug') => ({ file, line, kind });
assert.equal(score([f('a.js', 10 + WINDOW)], 'a.js', [10]).caught, true);
assert.equal(score([f('a.js', 11 + WINDOW)], 'a.js', [10]).caught, false);
assert.equal(score([f('b.js', 10)], 'a.js', [10]).caught, false);
assert.equal(score([f('a.js', 40), f('a.js', 50, 'style')], 'a.js', [10]).noise.length, 1); // style is not noise
console.log('review-bench: all passed');
