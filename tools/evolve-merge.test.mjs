import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promote, record } from './evolve-merge.mjs';

const report = {
  target: 'throw-off',
  ranked: [{ strategy: 'synthesis', fitness: 0.92, newlyBroken: 0 }],
  champion: { skill: 'throw-off', strategy: 'synthesis', fitness: 0.92, patterns: ['toss|fling'] },
  proposed: [{ ask: 'chuck it off the screen', want: 'skill:throw-off' }, { ask: 'fling it off the screen', want: 'skill:throw-off' }],
};

test('a clean champion is promotable, but only page-proven asks enter the bank', () => {
  const { packet, rows } = promote(report, { proof: [{ ask: 'chuck it off the screen' }] });
  assert.equal(packet.ok, true);
  assert.deepEqual(packet.proposed, ['chuck it off the screen', 'fling it off the screen']);
  assert.deepEqual(packet.proven, ['chuck it off the screen']);
  assert.deepEqual(rows, [{ ask: 'chuck it off the screen', want: 'skill:throw-off' }]);
  assert.match(packet.prBody, /synthesis champion/);
});

test('a champion is refused when it regresses, is weak, or carries a secret-shaped pattern', () => {
  const broken = promote({ ...report, ranked: [{ ...report.ranked[0], newlyBroken: 1 }] });
  assert.equal(broken.packet.ok, false);
  assert.match(broken.packet.why.join(' '), /newly breaks/);
  const weak = promote({ ...report, champion: { ...report.champion, fitness: 0.1 } });
  assert.equal(weak.packet.ok, false);
  const secret = promote({ ...report, champion: { ...report.champion, patterns: ['sk-abcdefghijklmnopqrstuvwxyz1234'] } });
  assert.equal(secret.packet.ok, false);
  assert.match(secret.packet.why.join(' '), /address, a key/);
  const none = promote({ ...report, champion: null });
  assert.equal(none.packet.ok, false);
});

test('an oversized patch trips the entropy cap', () => {
  const huge = promote({ ...report, champion: { ...report.champion, patterns: ['x'.repeat(1001)] } });
  assert.equal(huge.packet.ok, false);
  assert.match(huge.packet.why.join(' '), /entropy cap/);
});

test('promotion packets only grow', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-promotion-'));
  const path = resolve(dir, 'void.evolve.promotions.json');
  assert.equal(record({ at: '1' }, path), 1);
  assert.equal(record({ at: '2' }, path), 2);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')).map((p) => p.at), ['1', '2']);
});
