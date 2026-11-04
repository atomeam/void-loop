import test from 'node:test';
import assert from 'node:assert/strict';
import snippet, { snippetOf } from '../void-live-deploy/skills/snippet.js';

test('a named python function is that function, and a bare code ask says there are several', () => {
  assert.equal(snippetOf('write a python function factorial of n').kind, 'factorial');
  assert.equal(snippetOf('now make factorial(0) return 1').kind, 'factorial');
  assert.equal(snippetOf('escribe una función python que invierta un texto').kind, 'reverse');
  assert.equal(snippetOf('code').kind, 'which');
  assert.equal(snippetOf('http status 404'), null);
  assert.equal(snippetOf('dress code'), null);
  for (const e of snippet.examples) assert.ok(snippet.match(e.toLowerCase(), e), e);
  for (const n of snippet.nearMisses) assert.equal(snippet.match(n.toLowerCase(), n), false, n);
});
