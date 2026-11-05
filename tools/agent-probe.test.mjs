// The /agent/ gate retries a dropped connection or a gateway error, never a real answer (Verse engineer, 2026-11-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getJson, ASKS, pick, verdict, REFUSES, inboxVerdict, reopenVerdict, approveVerdict, nudgeVerdict, nudgeRiskVerdict, asksForLiveNote, caughtUp, taskById, declineKept, noteWithTask } from './agent-probe.mjs';

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
  assert.equal(verdict(ask('inbox'), done('Base64 of "verse inbox": dmVyc2UgaW5ib3g='), [{}]), '');
  assert.match(verdict(ask('inbox'), done('not really'), [{}]), /encoding/);
  assert.equal(verdict(ask('steps'), done('Base64 of "made steps": bWFkZSBzdGVwcw=='), [{}]), '');
  assert.equal(verdict(ask('approve'), { status: 'needs_yes', result: 'Mom, dinner is at 6.' }, []), '');
  assert.equal(verdict(ask('approve'), { status: 'needs_yes', result: "I'm sorry, but I can't help with that." }, []), 'refused');
});
test('the inbox stays until it is marked seen, a finished task reopens, and a yes resumes without sending', () => {
  const id = 'abc', open = { inbox: [{ id, status: 'done' }] };
  assert.equal(inboxVerdict(id, open, open, { inbox: [] }), '');
  assert.match(inboxVerdict(id, { inbox: [] }, open, { inbox: [] }), /no inbox/);
  assert.match(inboxVerdict(id, open, { inbox: [] }, { inbox: [] }), /closed/);
  assert.match(inboxVerdict(id, open, open, open), /seen/);
  const steps = [{ line: 'Got it. Queued.' }, { line: 'Done. It is on your Made shelf.' }];
  assert.equal(reopenVerdict({ steps }, { steps }), '');
  assert.match(reopenVerdict({ steps: [{ line: 'Got it.' }] }, { steps }), /no step stream/);
  assert.match(reopenVerdict({ steps }, null), /Made shelf/);
  const waiting = { task: { id, status: 'needs_yes', result: 'Mom, dinner is at 6.' }, inbox: [{ id, status: 'needs_yes' }] };
  const resumed = { task: { id, status: 'done', result: 'Mom, dinner is at 6.', steps: [{ line: 'You said yes. Resumed. Nothing was sent or paid: the approved draft is on your Made shelf.' }] }, inbox: [{ id, status: 'done' }], made: [{}] };
  assert.equal(approveVerdict(waiting, resumed), '');
  assert.match(approveVerdict(waiting, { ...resumed, task: { ...resumed.task, result: 'other' } }), /draft changed/);
  assert.match(approveVerdict({ task: waiting.task, inbox: [] }, resumed), /not in the inbox/);
  assert.match(approveVerdict(waiting, { ...resumed, task: { ...resumed.task, status: 'needs_yes' } }), /did not resume/);
});
test('a refusal is caught however it is worded; help that mentions sorry is not one', () => {
  for (const r of ["I can't help with that.", 'I am unable to assist with this request.', 'As an AI, I cannot do that.', "I'm sorry, but I can't provide that."]) assert.ok(REFUSES.test(r), r);
  assert.ok(!REFUSES.test('Sorry you are locked out! Here is what to do: call a locksmith.'));
});
test('a note Verse wrote is grounded, free, and off the Made shelf; a send in it waits', () => {
  const task = { status: 'done', result: 'dmVyc2Ugd3JvdGUgZmlyc3Q=' };
  const note = { id: 'n', tier: 'free', status: 'done', ask: 'From what you asked before: base64 verse wrote first', result: 'Finished in the background. dmVyc2Ugd3JvdGUgZmlyc3Q=', steps: [{ line: 'Verse wrote first.' }] };
  assert.equal(nudgeVerdict(task, note, [{ id: 'job' }]), '');
  assert.match(nudgeVerdict(task, null, [{}]), /write first/);
  assert.match(nudgeVerdict(task, { ...note, tier: 'strong' }, [{}]), /free/);
  assert.match(nudgeVerdict(task, { ...note, status: 'needs_yes' }, [{}]), /waited/);
  assert.match(nudgeVerdict(task, note, [{ id: 'n' }]), /Made shelf/);
  const risk = { id: 'r', tier: 'free', status: 'needs_yes', ask: 'I can follow up on this, and I will wait for your yes: Send an email to my landlord saying the tap is fixed.', result: 'Nothing was sent, paid or deleted.', steps: [{ line: 'Verse wrote first.' }, { line: 'Nothing was sent.' }] };
  assert.equal(nudgeRiskVerdict(risk), '');
  assert.match(nudgeRiskVerdict({ ...risk, status: 'done' }), /did not wait/);
});
test('a no is the task it was sent to, and a note ask waits until this deploy is serving', () => {
  const member = { id: 'm', status: 'declined' };
  const note = { id: 'n', status: 'needs_yes', steps: [{ line: 'Verse wrote first.' }] };
  const tasks = [note, member];
  assert.equal(taskById(tasks, 'm'), member);
  assert.equal(declineKept({ ok: true, status: 'declined' }, member), '');
  assert.equal(declineKept({ ok: true, status: 'declined' }, tasks[0]), 'the no was not kept (needs_yes)');
  assert.equal(noteWithTask({ nudge: { id: 'n' } }), '');
  assert.equal(noteWithTask({ ok: true, id: 'm' }), 'note not with the task');
  assert.equal(caughtUp({ writesFirst: true, tasks: [] }), true);
  assert.equal(caughtUp({ ok: true, tasks: [] }), false);
  assert.equal(asksForLiveNote(ASKS.find((a) => a.name === 'nudge-risk')), true);
  assert.equal(asksForLiveNote(ASKS.find((a) => a.name === 'approval')), false);
});
test('one ask a run, a different one each hour; --all and --ask choose', () => {
  const seen = new Set(Array.from({ length: ASKS.length }, (_, h) => pick([], h * 36e5)[0].name));
  assert.equal(seen.size, ASKS.length);
  assert.equal(pick(['--all']).length, ASKS.length);
  assert.deepEqual(pick(['x', '--ask', 'bot,local']).map((a) => a.name), ['local', 'bot']);
  assert.throws(() => pick(['--ask', 'nope']));
});
