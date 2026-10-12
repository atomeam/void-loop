// tools/review-bench.mjs: a finding within WINDOW lines of a broken line in the same file is a catch; any other bug or risk is noise.
import assert from 'node:assert/strict';
import { score, WINDOW, deepFindings, checkedNoise } from './review-bench.mjs';
import { renderFindings } from '../void-live-deploy/lib/review-api.js';
const f = (file, line, kind = 'bug') => ({ file, line, kind });
assert.equal(score([f('a.js', 10 + WINDOW)], 'a.js', [10]).caught, true);
assert.equal(score([f('a.js', 11 + WINDOW)], 'a.js', [10]).caught, false);
assert.equal(score([f('b.js', 10)], 'a.js', [10]).caught, false);
assert.equal(score([f('a.js', 40), f('a.js', 50, 'style')], 'a.js', [10]).noise.length, 1); // style is not noise
// the closer read's rendered lines read back into findings
const text = renderFindings([{ file: 'skills/watch.js', line: 57, kind: 'bug', text: 'data.watches may be missing.', quote: 'if (!data.watches.length) x();' }]);
assert.deepEqual(deepFindings(text), [{ file: 'skills/watch.js', line: 57, kind: 'bug', message: 'data.watches may be missing.', deep: true }]);
assert.deepEqual(deepFindings(null), []);
// a noise finding read by hand carries what was found; one nobody checked says so
const known = [{ commit: 'abc', file: 'a.js', line: 40, verdict: 'false', why: 'no' }];
assert.deepEqual(checkedNoise([f('a.js', 40 + WINDOW)], 'abc', known).map((x) => x.verdict), ['false']);
assert.deepEqual(checkedNoise([f('a.js', 40)], 'other', known).map((x) => x.verdict), ['']);
assert.deepEqual(checkedNoise([f('b.js', 40)], 'abc', known).map((x) => x.verdict), ['']);
console.log('review-bench: all passed');
