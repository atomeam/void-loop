// The /agent/ gate retries a dropped connection or a gateway error, never a real answer (Verse engineer, 2026-11-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getJson } from './agent-probe.mjs';

const answer = (status, body) => ({ status, json: async () => body });
const quiet = { pause: 1, say: () => {} };

test('a dropped connection is tried again and the next answer counts', async () => {
  let n = 0;
  const fetcher = async () => { if (++n === 1) throw new TypeError('fetch failed', { cause: new Error('other side closed') }); return answer(200, { ok: true }); };
  assert.deepEqual(await getJson('u', {}, { ...quiet, fetcher }), { ok: true });
  assert.equal(n, 2);
});

test('a gateway 502 is tried again; a real answer is never retried', async () => {
  let n = 0;
  assert.deepEqual(await getJson('u', {}, { ...quiet, fetcher: async () => (++n < 3 ? answer(502, {}) : answer(200, { tasks: [] })) }), { tasks: [] });
  assert.equal(n, 3);
  n = 0;
  assert.deepEqual(await getJson('u', {}, { ...quiet, fetcher: async () => { n++; return answer(400, { ok: false }); } }), { ok: false });
  assert.equal(n, 1);
});

test('a connection that keeps dropping still fails the probe, and other errors are not retried', async () => {
  let n = 0;
  await assert.rejects(getJson('u', {}, { ...quiet, tries: 3, fetcher: async () => { n++; throw new TypeError('fetch failed'); } }), TypeError);
  assert.equal(n, 3);
  n = 0;
  await assert.rejects(getJson('u', {}, { ...quiet, fetcher: async () => { n++; throw new RangeError('bad'); } }), RangeError);
  assert.equal(n, 1);
});
