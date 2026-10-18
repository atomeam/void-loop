// Fixed-input tests for the convert card's pure maths and ask-reading (void-live-deploy/lib/convert-math.js). No browser.
import assert from 'node:assert/strict';
import { convert, fmt, pairOf, askOf, toBase, fromBase, KINDS } from '../void-live-deploy/lib/convert-math.js';
import skill from '../void-live-deploy/skills/convert.js';

// maths, both ways
assert.equal(fmt(convert('temperature', 1, 0, 98.6)), '37');
assert.equal(fmt(convert('temperature', 0, 1, 100)), '212');
assert.equal(fmt(convert('temperature', 2, 0, 0)), '-273.15');
assert.equal(fmt(convert('temperature', 1, 0, 72)), '22.22222');
assert.equal(fmt(convert('length', 4, 1, 5)), '8.04672');
assert.equal(fmt(convert('length', 1, 4, 8.04672)), '5');
assert.equal(fmt(convert('mass', 3, 1, 1)), '453.5924');
assert.equal(fmt(convert('volume', 2, 3, 1)), '16');
assert.equal(fmt(convert('data', 3, 0, 1)), '1,048,576');
assert.equal(fmt(convert('speed', 1, 0, 60)), '96.56064');
// a round trip returns the start for every kind
for (const k of Object.keys(KINDS)) assert.ok(Math.abs(fromBase(k, 1, toBase(k, 1, 12.5)) - 12.5) < 1e-9, k);
assert.equal(fmt(NaN), ''); assert.equal(fmt(-0), '0'); assert.equal(fmt(1234.5), '1,234.5');

// pairs
assert.deepEqual(pairOf('miles', 'km'), { kind: 'length', from: 4, to: 1 });
assert.deepEqual(pairOf('f', 'c'), { kind: 'temperature', from: 1, to: 0 });
assert.equal(pairOf('miles', 'kg'), null);
assert.equal(pairOf('km', 'km'), null);

// asks that open the card (the old ones still do)
assert.deepEqual(askOf('unit converter'), { open: true });
assert.deepEqual(askOf('temperature converter'), { open: true, kind: 'temperature' });
assert.deepEqual(askOf('give me a converter for 5 miles to km'), { open: true, kind: 'length', value: 5, from: 4, to: 1 });
assert.deepEqual(askOf('close the converter'), { close: true });
// the new keep forms
assert.deepEqual(askOf('keep a converter for miles and km'), { open: true, kind: 'length', from: 4, to: 1 });
assert.deepEqual(askOf('keep a converter for f and c'), { open: true, kind: 'temperature', from: 1, to: 0 });
assert.deepEqual(askOf('convert card for 72 f to c'), { open: true, kind: 'temperature', value: 72, from: 1, to: 0 });
assert.deepEqual(askOf('keep 5 miles to km as a card'), { open: true, kind: 'length', value: 5, from: 4, to: 1 });
assert.deepEqual(askOf('5 miles in km as a converter card'), { open: true, kind: 'length', value: 5, from: 4, to: 1 });
assert.deepEqual(askOf('72 f to c as a card'), { open: true, kind: 'temperature', value: 72, from: 1, to: 0 });

// asks that are not this card's stay where they were
for (const a of ['5 miles in km', '72 f to c', 'convert 3 cups to ml', 'convert 5 miles to km', 'currency converter', 'pdf converter', 'time zone converter', 'calculator',
  '5 miles in kg as a card', 'keep a note', 'keep this', 'keep a converter for usd and eur']) assert.equal(askOf(a), null, a);
for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), 'near miss: ' + a);
for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'example: ' + a);
console.log('convert-math: ok');
