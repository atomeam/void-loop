import test from 'node:test';
import assert from 'node:assert/strict';
import { propose, applyCopy, planChecks, advance, ship } from '../void-live-deploy/lib/growth-runner.js';
import { demo } from './growth-runner.mjs';

test('a change is proposed, applied to a copy, tested, and only then ready to commit', () => {
  const bad = propose({ files: [{ path: '../secret.txt', text: 'no' }] });
  assert.equal(bad.ok, false);
  const prop = propose({ files: [{ path: 'notes/hello.txt', text: 'hello\n' }] }, '2026-11-21');
  assert.equal(prop.record.state, 'proposed');
  assert.equal(applyCopy({ 'notes/hello.txt': 'old' }, prop.record.files)['notes/hello.txt'], 'hello\n');
  assert.ok(planChecks(prop.record.files).some((c) => c.startsWith('stranger gate')));
  const tested = advance(prop.record, { pass: true, checks: ['copy'], at: '2026-11-21' });
  assert.equal(tested.state, 'tested');
  const shipped = ship(tested);
  assert.equal(shipped.record.state, 'shipped');
  assert.deepEqual(shipped.push, ['git', 'push', 'origin', 'HEAD']);
  assert.ok(!JSON.stringify(shipped).includes('ghp_') && !JSON.stringify(shipped).includes('token='));
  assert.equal(advance(prop.record, { pass: false, why: 'the stranger gate failed' }).state, 'rolled');
  assert.equal(ship(prop.record).ok, false);
});

test('the demo really writes the copy and removes it', () => {
  const out = demo();
  assert.equal(out.ok, true);
  assert.equal(out.record.state, 'shipped');
});
