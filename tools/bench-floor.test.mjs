import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { nextFloor, MARGIN } from './bench-floor.mjs';

const floor = { score: 1773, total: 1773, date: '2026-10-07', note: 'the floor' };

test('a higher score raises the floor to the score minus the margin', () => {
  assert.deepEqual(nextFloor({ score: 1980, total: 1984 }, floor), { score: 1980 - MARGIN, total: 1984 });
});
test('an equal or lower score writes nothing', () => {
  assert.equal(nextFloor({ score: 1773 + MARGIN, total: 1984 }, floor), null); // earns exactly the floor: no change
  assert.equal(nextFloor({ score: 1773, total: 1984 }, floor), null);
  assert.equal(nextFloor({ score: 1000, total: 1984 }, floor), null);
});
test('the floor never goes down, in score or in total', () => {
  const next = nextFloor({ score: 1795, total: 1800 }, { score: 1773, total: 1900 }); // a run with fewer asks than the floor knew
  assert.deepEqual(next, { score: 1795 - MARGIN, total: 1900 });
});
test('anything that is not a number, or a score above its total, writes nothing', () => {
  assert.equal(nextFloor(null, floor), null);
  assert.equal(nextFloor({ score: 'many', total: 10 }, floor), null);
  assert.equal(nextFloor({ score: 2000, total: 1984 }, floor), null);
  assert.equal(nextFloor({ score: 1980, total: 1984 }, {}), null);
});
test('the command writes the file only when the floor rises, and keeps its note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'floor-')), f = join(dir, 'best.json'), r = join(dir, 'score.json');
  const run = () => spawnSync(process.execPath, ['tools/bench-floor.mjs', r, '--write', '--floor', f], { encoding: 'utf8' });
  writeFileSync(f, JSON.stringify(floor)); writeFileSync(r, JSON.stringify({ score: 1773, total: 1784, wrong: [] }));
  assert.match(run().stdout, /floor stays/); assert.equal(JSON.parse(readFileSync(f, 'utf8')).score, 1773);
  writeFileSync(r, JSON.stringify({ score: 1984, total: 1984, wrong: [] }));
  assert.match(run().stdout, /floor rises from 1773\/1773 to 1979\/1984/);
  const after = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(after.score, 1979); assert.equal(after.total, 1984); assert.equal(after.note, 'the floor');
});
