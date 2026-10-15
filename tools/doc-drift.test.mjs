// tools/doc-drift.mjs on fakes.
import assert from 'node:assert/strict';
import { pathsIn, exists } from './doc-drift.mjs';
assert.deepEqual(pathsIn('see `tools/a.mjs`, `lib/x.js:12`, `docs/*.md`, `node tools/b.mjs`, `foo.js`, `https://x/y.js`, `tools/<name>.mjs`'), ['tools/a.mjs', 'lib/x.js']);
const has = (p) => ['tools/a.mjs', 'void-live-deploy/lib/x.js'].includes(p);
assert.equal(exists('lib/x.js', has), true); assert.equal(exists('tools/a.mjs', has), true); assert.equal(exists('tools/gone.mjs', has), false);
console.log('doc-drift: 4 checks passed');
