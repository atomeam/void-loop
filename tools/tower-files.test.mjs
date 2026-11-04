import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileOf, changedFloors, writeFloors, overlay } from './tower-files.mjs';

test('two floors that both moved become two files, and a floor that did not is left', () => {
  const before = { floors: { a: { speed: { at: '1' } }, b: { speed: { at: '1' } } } };
  const after = { floors: { a: { speed: { at: '2' } }, b: { speed: { at: '1' } }, c: { speed: { at: '3' } } } };
  assert.deepEqual(changedFloors(before, after), ['a', 'c']);
  const dir = mkdtempSync(join(tmpdir(), 'tower-'));
  const wrote = writeFloors(after, before, dir);
  assert.equal(wrote.length, 2);
  assert.ok(wrote.some((p) => p.endsWith(fileOf('a'))));
  const merged = overlay(before, [{ id: 'a', rows: after.floors.a }, { id: 'c', rows: after.floors.c }]);
  assert.equal(merged.floors.a.speed.at, '2');
  assert.equal(merged.floors.b.speed.at, '1');
  assert.equal(merged.floors.c.speed.at, '3');
});

test('the same floor id always names the same file', () => {
  assert.equal(fileOf('colour codes'), fileOf('colour codes'));
  assert.notEqual(fileOf('a'), fileOf('b'));
});
