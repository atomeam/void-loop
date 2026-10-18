// lib/honest.js: a want's reason never claims what Verse cannot back (the owner's zero-lie policy, 2026-10-12)
import assert from 'node:assert/strict';
import { honestBecause } from '../void-live-deploy/lib/honest.js';
const fact = 'asked 9 times, last 2026-10-11';
assert.equal(honestBecause('It is the most frequent thing people are asking me to do.', fact), fact, 'the reported lie');
for (const s of ['Everyone wants a list.', 'People always ask for this.', 'It is the top request.', 'It was asked 40 times.', 'It is the most common ask.'])
  assert.equal(honestBecause(s, fact), fact, s);
assert.equal(honestBecause('It joins my old parts into a persistent system that handles multi-step jobs.', fact), 'It joins my old parts into a persistent system that handles multi-step jobs.', 'a plain reason stays in Verse\'s words');
assert.equal(honestBecause('', fact), fact);
assert.equal(honestBecause('the most loved', ''), 'it is on my list of open work', 'no fact to fall back on: a plain line, never the claim');
console.log('honest: all passed');
