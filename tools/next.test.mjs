import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotLines, summary, takeNext } from './next.mjs';
import { readFrontier } from './frontier.mjs';

test('a session with no token reads the public snapshot: terms and counts, never ask text', () => {
  const lines = snapshotLines({ at: '2026-10-11T06:23:00Z', distinctAsks: 40, terms: [{ term: 'tide', asks: 5, misses: 9 }], make: [{ term: 'boat', asks: 3, misses: 3 }] });
  assert.match(lines[0], /2026-10-11 \(40 distinct asks/);
  assert.ok(lines.some((l) => /tide {2}\(5 asks, 9 misses\)/.test(l)));
  assert.ok(lines.some((l) => /boat/.test(l)));
  assert.deepEqual(snapshotLines(null), ['The miss snapshot is not readable.']);
});

test('summary reads the real frontier', () => {
  const s = summary(readFrontier());
  assert.ok(Array.isArray(s.steps) && s.open.length > 0);
});

test('there is always a next thing: never "nothing to do"', () => {
  assert.match(takeNext({ steps: [{ n: 3, title: 'The salvage shelf' }], open: [{ title: 'A' }] }), /^cleanup step 3/);
  assert.match(takeNext({ open: [{ title: 'Paid Void' }] }), /^Paid Void/);
  assert.match(takeNext({ targets: [{ title: 'Verification loop' }] }), /^Verification loop/);
  assert.match(takeNext({}), /Void's top ask/);
  const s = summary(readFrontier());
  assert.ok(s.targets.length >= 5 && s.targets[0].title === 'Verification loop' && s.take.length > 0, JSON.stringify(s.targets));
});
