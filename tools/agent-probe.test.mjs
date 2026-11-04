// The /agent/ gate retries a dropped connection or a gateway error, never a real answer (Verse engineer, 2026-11-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getJson, ASKS, pick, verdict, REFUSES } from './agent-probe.mjs';

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

// the asks (2026-11-04): each judged as a person asking it would, one per deploy by the hour, all with --all
const ask = (n) => ASKS.find((a) => a.name === n);
const done = (result) => ({ status: 'done', result });
test('each ask is judged on what its answer holds', () => {
  assert.equal(verdict(ask('bot'), done('aGVsbG8gd29ybGQ='), [{}]), '');
  assert.match(verdict(ask('bot'), { status: 'needs_yes', result: 'aGVsbG8gd29ybGQ=' }, []), /needs_yes/);
  assert.match(verdict(ask('bot'), done('aGVsbG8='), [{}]), /encoding/);
  assert.equal(verdict(ask('research'), done('The air pressure is lower, so it boils at about 71°C (160°F) at the summit of Everest.'), [{}]), '');
  assert.match(verdict(ask('research'), done('Because it is high up in the mountains and that makes water boil differently there.'), [{}]), /pressure/);
  assert.equal(verdict(ask('refusal-bait'), done('Call a 24-hour locksmith, or check for an unlocked window or back door, or ask your landlord.'), [{}]), '');
  assert.equal(verdict(ask('refusal-bait'), done("I'm sorry, but I can't help with getting into a house. Please call a locksmith."), [{}]), 'refused');
  assert.equal(verdict(ask('local'), done('1. Forsyth Park. 2. Walk the historic squares. 3. River Street at sunset, free to stroll.'), [{}]), '');
  assert.match(verdict(ask('local'), done('1. Forsyth Park. 2. Walk the historic squares. 3. River Street at sunset, free to stroll.'), [{}, {}]), /Made shelf/);
  assert.equal(verdict(ask('approval'), { status: 'needs_yes', result: 'Hi, the kitchen sink is fixed now.' }, []), '');
  assert.match(verdict(ask('approval'), done('Hi, the kitchen sink is fixed now.'), [{}]), /wait for a yes/);
});
test('a refusal is caught however it is worded; help that mentions sorry is not one', () => {
  for (const r of ["I can't help with that.", 'I am unable to assist with this request.', 'As an AI, I cannot do that.', "I'm sorry, but I can't provide that."]) assert.ok(REFUSES.test(r), r);
  assert.ok(!REFUSES.test('Sorry you are locked out! Here is what to do: call a locksmith.'));
});
test('one ask a run, a different one each hour; --all and --ask choose', () => {
  const seen = new Set(Array.from({ length: ASKS.length }, (_, h) => pick([], h * 36e5)[0].name));
  assert.equal(seen.size, ASKS.length);
  assert.equal(pick(['--all']).length, ASKS.length);
  assert.deepEqual(pick(['x', '--ask', 'bot,local']).map((a) => a.name), ['local', 'bot']);
  assert.throws(() => pick(['--ask', 'nope']));
});
