// The everyday names for two tools with nothing else in the ask: "uuid generator" opens the UUID card (skills/util.js), and
// "timestamp converter 1700000000" converts the number (skills/formulas.js). Each of these fell to an article on 2026-10-30.
import test from 'node:test';
import assert from 'node:assert/strict';
import util, { utilOf } from '../void-live-deploy/skills/util.js';
import formulas, { filled } from '../void-live-deploy/skills/formulas.js';

test('the UUID card by its tool names', () => {
  for (const a of ['uuid', 'guid', 'uuid generator', 'UUID Generator', 'guid generator', 'random uuid', 'a random guid', 'uuid v4', 'uuid v4 generator', 'uuid4', 'online uuid generator', 'generate a uuid', 'generate random uuid', 'create a guid'])
    assert.deepEqual(utilOf(a), { kind: 'uuid' }, a);
  for (const a of ['what is a uuid', 'uuid vs guid', 'uuid format', 'how long is a uuid', 'uuid python'])
    assert.equal(utilOf(a), null, a);
});

test('the epoch converter with the number after its name', () => {
  for (const a of ['timestamp converter 1700000000', 'convert timestamp 1700000000', 'epoch converter 1700000000', 'unix timestamp converter 1700000000', 'timestamp 1700000000', 'epoch: 1700000000', 'convert this timestamp 1700000000', 'timestamp to date 1700000000']) {
    const r = filled(a);
    assert.ok(r, a);
    assert.equal(r.calc.id, 'unix-time', a);
    assert.equal(r.given.v, '1700000000', a);
  }
  // a short number is not a timestamp, and a question about timestamps is not a conversion
  for (const a of ['timestamp 12', 'what is a timestamp', 'timestamp converter']) assert.equal(filled(a), null, a);
});

test('the examples still match and the near misses still do not', () => {
  for (const s of [util, formulas]) {
    for (const e of s.examples) assert.ok(s.match(e.toLowerCase(), e), s.name + ': ' + e);
    for (const n of s.nearMisses) assert.ok(!s.match(n.toLowerCase(), n), s.name + ': ' + n);
  }
});
