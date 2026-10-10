// tools/heavy.mjs: the second heavy job waits for the first, a lock left by a dead process is taken over, and the wait has an end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, holder } from './heavy.mjs';

const fresh = () => join(mkdtempSync(join(tmpdir(), 'void-heavy-')), 'lock');

test('one at a time: the second job waits until the first releases, then holds the lock itself', async () => {
  const lock = fresh(), said = [];
  const release1 = await acquire('first', { lock });
  assert.equal(holder(lock).label, 'first');
  let second = null;
  const p = acquire('second', { lock, pollMs: 20, log: (m) => said.push(m) }).then((r) => { second = r; });
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(second, null, 'still waiting while first holds it');
  release1();
  await p;
  assert.equal(holder(lock).label, 'second');
  second();
  assert.equal(existsSync(lock), false, 'released');
});

test('a lock whose process is gone is taken over; a living holder is waited for until the wait runs out', async () => {
  const lock = fresh();
  mkdirSync(lock); writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: 99999999, label: 'gone', since: 'x' }));
  const release = await acquire('next', { lock, pollMs: 10 });
  assert.equal(holder(lock).label, 'next', 'the dead holder\'s lock was taken over');
  release();
  mkdirSync(lock); writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, label: 'busy', since: 'y' }));
  await assert.rejects(acquire('late', { lock, pollMs: 10, waitMs: 50, log: () => {} }), /still waiting .* for busy/);
});

test('VOID_HEAVY_OFF skips the lock (CI gives each job its own runner)', async () => {
  const lock = fresh(); process.env.VOID_HEAVY_OFF = '1';
  try { const release = await acquire('x', { lock }); assert.equal(existsSync(lock), false); release(); }
  finally { delete process.env.VOID_HEAVY_OFF; }
});
