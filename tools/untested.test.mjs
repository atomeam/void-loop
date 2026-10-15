// tools/untested.mjs on fakes.
import assert from 'node:assert/strict';
import { untested, ratchet } from './untested.mjs';
const files = [{ path: 'void-live-deploy/lib/a.js', bytes: 10 }, { path: 'void-live-deploy/lib/b.js', bytes: 99 }, { path: 'void-live-deploy/skills/a.js', bytes: 5 }];
assert.deepEqual(untested(files, ["import x from '../void-live-deploy/lib/a.js'"]).map((f) => f.path), ['void-live-deploy/lib/b.js', 'void-live-deploy/skills/a.js']);
assert.deepEqual(untested(files, ['lib/a.js lib/b.js skills/a.js']), []);
assert.deepEqual(ratchet(3, 4), { ok: true, lower: true }); assert.equal(ratchet(5, 4).ok, false);
console.log('untested: 4 checks passed');
