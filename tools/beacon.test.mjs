// lib/beacon.js: the same round gives the same numbers for anyone, in range, unbiased, unique when asked; the relays are tried in turn
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { numbers, nth, fetchRound, roundUrl, CHAIN, RELAYS } from '../void-live-deploy/lib/beacon.js';

const R = 'b0bec2287189fc88719cc66df2d9cc1d64475b8432f1216a1cf202fa46a96aa8'; // drand quicknet round 33351876, as the scout read it live
test('the rule is SHA-256 of "<randomness>:<i>:<k>", checkable by hand', async () => {
  const d = createHash('sha256').update(R + ':0:0').digest(), x = d.readUInt32BE(0), span = 100, lim = Math.floor(4294967296 / span) * span;
  assert.ok(x < lim, 'the first try is in range for a span of 100 (true for this round)'); assert.equal(await nth(R, 0, 1, 100), 1 + (x % span));
});
test('the same round gives the same numbers; another round, others', async () => {
  assert.deepEqual(await numbers(R, 1, 100, 10), await numbers(R, 1, 100, 10));
  assert.notDeepEqual(await numbers(R, 1, 100, 10), await numbers('2ce2b8fee2046f26fe6487cccb1c3a9de11d38b6017dd4487f265009c55a0296', 1, 100, 10));
});
test('in range, unique when asked, and spread evenly over many draws', async () => {
  const v = await numbers(R, -5, 5, 2000); assert.ok(v.every((x) => x >= -5 && x <= 5));
  const counts = {}; for (const x of v) counts[x] = (counts[x] || 0) + 1; for (let x = -5; x <= 5; x++) assert.ok(counts[x] > 120 && counts[x] < 245, x + ': ' + counts[x]); // expect ~182 each
  const u = await numbers(R, 1, 49, 6, true); assert.equal(new Set(u).size, 6); assert.equal((await numbers(R, 1, 5, 9, true)).length, 5);
  assert.deepEqual(await numbers(R, 10, 1, 3), await numbers(R, 1, 10, 3), 'a range written backwards is the same range');
});
test('a round is fetched from the first relay that answers it, and a wrong answer is not taken', async () => {
  assert.equal(roundUrl(33351876), RELAYS[0] + '/' + CHAIN + '/public/33351876');
  const tried = []; const get = async (u) => { tried.push(u); if (u.startsWith(RELAYS[0])) return new Response('down', { status: 503 }); return new Response(JSON.stringify({ round: 33351876, randomness: R })); };
  assert.deepEqual(await fetchRound(33351876, get), { round: 33351876, randomness: R }); assert.equal(tried.length, 2);
  await assert.rejects(fetchRound(5, async () => new Response(JSON.stringify({ round: 6, randomness: R }))), 'a different round is refused');
});
