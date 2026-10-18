// tools/pool.mjs: the gate that runs the pure checks side by side, the ordered results, the pool size, and the report helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGate, runOrdered, poolSize, slowest, fmtMs, runNode } from './pool.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('poolSize: one per core up to 4, one fewer while a browser check runs, never below 1', () => {
  assert.equal(poolSize(false, 8), 4);
  assert.equal(poolSize(false, 2), 2);
  assert.equal(poolSize(true, 8), 3);
  assert.equal(poolSize(true, 4), 3);
  assert.equal(poolSize(true, 1), 1);
  assert.equal(poolSize(false, 0), 1);
});

test('makeGate: never more than the limit at once, and all of them finish', async () => {
  let now = 0, peak = 0;
  const gate = makeGate(() => 3);
  const task = () => async () => { now++; peak = Math.max(peak, now); await sleep(5); now--; return 1; };
  const out = await runOrdered(Array.from({ length: 12 }, task), gate);
  assert.equal(out.length, 12); assert.equal(peak, 3); assert.equal(gate.running(), 0);
});

test('runOrdered: results come back in task order, not finish order', async () => {
  const gate = makeGate(() => 4);
  const delays = [30, 1, 20, 5, 10];
  const out = await runOrdered(delays.map((d, i) => async () => { await sleep(d); return i; }), gate);
  assert.deepEqual(out, [0, 1, 2, 3, 4]);
});

test('runOrdered: a task that throws becomes { error } at its place and the rest still run', async () => {
  const gate = makeGate(() => 2);
  const out = await runOrdered([async () => 'a', async () => { throw new Error('boom'); }, () => 'c'], gate);
  assert.equal(out[0], 'a'); assert.equal(out[1].error.message, 'boom'); assert.equal(out[2], 'c');
});

test('makeGate: the limit is read as slots free, so a browser check can take one slot away and give it back', async () => {
  let limit = 4, now = 0, peak = 0;
  const gate = makeGate(() => limit);
  const task = async () => { now++; peak = Math.max(peak, now); await sleep(10); now--; };
  limit = 1; // "a browser check started"
  const first = runOrdered(Array.from({ length: 4 }, () => task), gate);
  await first;
  assert.equal(peak, 1, 'with the limit at 1 they ran one at a time');
  peak = 0; limit = 3;
  await runOrdered(Array.from({ length: 9 }, () => task), gate);
  assert.equal(peak, 3);
});

test('makeGate: a limit of 0 or less still lets one run (nothing can starve forever)', async () => {
  const gate = makeGate(() => 0);
  assert.equal(await gate(async () => 'ran'), 'ran');
});

test('slowest: the n slowest, slowest first, and the input is left alone', () => {
  const t = [{ name: 'a', ms: 5 }, { name: 'b', ms: 50 }, { name: 'c', ms: 20 }, { name: 'd', ms: 1 }];
  assert.deepEqual(slowest(t, 2).map((x) => x.name), ['b', 'c']);
  assert.deepEqual(t.map((x) => x.name), ['a', 'b', 'c', 'd']);
  assert.equal(slowest(t).length, 4);
});

test('fmtMs: seconds under a minute and a half, minutes after', () => {
  assert.equal(fmtMs(1234), '1.2s'); assert.equal(fmtMs(89000), '89.0s'); assert.equal(fmtMs(125000), '2m05s');
});

test('runNode: ok on exit 0, not ok otherwise, output is stdout then stderr with node warnings dropped, a timeout is a failure', async () => {
  const ok = await runNode(['-e', 'console.log("hi"); console.error("ExperimentalWarning: x"); console.error("err")']);
  assert.equal(ok.ok, true); assert.deepEqual(ok.out, ['hi', 'err']);
  const bad = await runNode(['-e', 'console.log("no"); process.exit(3)']);
  assert.equal(bad.ok, false); assert.equal(bad.out.at(-1), 'no');
  const slow = await runNode(['-e', 'setTimeout(() => {}, 5000)'], { timeout: 100 });
  assert.equal(slow.ok, false);
  const missing = await runNode([`${process.cwd()}/no-such-file-here.mjs`]);
  assert.equal(missing.ok, false);
});
