// tools/collide.mjs on fakes: overlapping pairs and a branch's files against open PRs.
import assert from 'node:assert/strict';
import { overlaps, against } from './collide.mjs';
const prs = [{ number: 1, title: 'a', files: ['x.js', 'domains/handoff.md'] }, { number: 2, title: 'b', files: ['x.js', 'y.js', 'domains/handoff.md'] }, { number: 3, title: 'c', files: ['z.js'] }];
assert.deepEqual(overlaps(prs), [{ a: 1, b: 2, shared: ['x.js', 'domains/handoff.md'] }]);
assert.deepEqual(overlaps([prs[2]]), []);
const h = against(['y.js', 'domains/handoff.md'], prs);
assert.equal(h[0].number, 2); assert.deepEqual(h[0].real, ['y.js']); assert.deepEqual(h[1].real, []);
assert.deepEqual(against(['q.js'], prs), []);
console.log('collide: 6 checks passed');
