// The shared tool-page chain stays in step with the browser suite's page budget, on the PR that changes it (not after it merges).
// Every tool page loads /lib/toolkit.js and what it imports; the browser suite (tools/test_void.mjs SHARED_TOOL_FILES) leaves those
// out of a page's own module budget. #1663 added lib/brain-ask.js to the chain, the list did not name it, and shard 1 went red on
// main (the password strength page counted 4 own modules of 3). This test reads the static imports from lib/toolkit.js, follows
// them, and fails on the PR when one of them is not in the list. Run: node --test tools/shared-chain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy');

/** the site paths (/lib/x.js) a module pulls in at load: its static imports and re-exports, followed to the end. Dynamic import() is left out: it loads on use. */
export function chainOf(start) {
  const seen = new Set(), todo = [start];
  while (todo.length) {
    const p = todo.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    const src = fs.readFileSync(path.join(site, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      if (!/^\.{1,2}\/|^\//.test(m[1])) continue; // a bare name is not a site file
      todo.push(m[1].startsWith('/') ? m[1] : path.posix.join(path.posix.dirname(p), m[1]));
    }
  }
  return [...seen];
}

function sharedList() {
  const src = fs.readFileSync(path.join(root, 'tools', 'test_void.mjs'), 'utf8');
  const m = /^const SHARED_TOOL_FILES = \/(.+)\/;$/m.exec(src);
  assert.ok(m, 'tools/test_void.mjs has no SHARED_TOOL_FILES line in the form this test reads');
  return new RegExp(m[1]);
}

test('every module the shared toolkit chain loads is named in the browser suite\'s shared list', () => {
  const chain = chainOf('/lib/toolkit.js'), shared = sharedList();
  assert.ok(chain.length >= 2, 'the chain was read: ' + JSON.stringify(chain));
  const missing = chain.filter((f) => !shared.test(f));
  assert.deepEqual(missing, [], 'add these to SHARED_TOOL_FILES in tools/test_void.mjs (and check every tool page still fits its own budget): ' + missing.join(', '));
});

test('the walk follows imports into the chain (toolkit.js -> tool-sites.js -> self-sites.js)', () => {
  const chain = chainOf('/lib/toolkit.js');
  assert.ok(chain.includes('/lib/tool-sites.js') && chain.includes('/lib/self-sites.js') && chain.includes('/lib/brain-ask.js'), JSON.stringify(chain));
});
