// stage pack C (owner, 2026-10-18): the pure logic of the codex, echo chamber, time capsule and whisper network (lib/stage-pack-c.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { codexOf, codexItem, fileItem, searchCodex, groupByFamily, rangeOf, echoOf, echoes, dateOf, capsuleOf, hashWord, snapshotOf, newCapsule, openable, restorable, whisperOf, findThingId, addWhisper, takeWhispers, loadList, saveList } from '../void-live-deploy/lib/stage-pack-c.js';
import skills from '../void-live-deploy/skills/codex.js';
import echo from '../void-live-deploy/skills/echo-chamber.js';
import cap from '../void-live-deploy/skills/time-capsule.js';
import whisper from '../void-live-deploy/skills/whisper-network.js';

const NOW = new Date(2026, 9, 18, 12).getTime(); // Sunday 2026-10-18

test('codex asks are tight', () => {
  assert.deepEqual(codexOf('file this in the codex'), { op: 'file' });
  assert.deepEqual(codexOf('Open the codex on space'), { op: 'open', topic: 'space' });
  assert.deepEqual(codexOf('what have I collected about space?'), { op: 'about', topic: 'space' });
  for (const no of ['codex gigas', 'the da vinci codex', 'what is the codex alimentarius', 'file this report']) assert.equal(codexOf(no), null, no);
});

test('filing is idempotent, searchable and grouped by family', () => {
  const a = codexItem({ ask: 'moon tonight', title: 'Moon', text: 'waxing gibbous', skill: 'moontonight' }, 1);
  const b = codexItem({ ask: 'tip on 40', title: 'Tip', text: '8 dollars', skill: 'tip' }, 2);
  assert.equal(codexItem({}), null);
  let l = fileItem(fileItem(fileItem([], a), b), a);
  assert.equal(l.length, 2);
  assert.equal(searchCodex(l, 'moon').length, 1);
  assert.equal(searchCodex(l, 'moon gibbous').length, 1);
  assert.equal(searchCodex(l, 'moon dollars').length, 0);
  assert.equal(searchCodex(l, '').length, 2);
  const fam = { families: [{ name: 'Sky and earth', skills: [{ name: 'moontonight' }] }, { name: 'Numbers', skills: [{ name: 'tip' }] }] };
  assert.deepEqual(groupByFamily(l, fam).map((g) => g.family), ['Sky and earth', 'Numbers']);
  assert.equal(groupByFamily([{ skill: 'zzz', t: 1 }], fam)[0].family, 'Other');
  assert.equal(fileItem([], a).length, 1);
  assert.equal(Array.from({ length: 230 }, (_, i) => i).reduce((acc, i) => fileItem(acc, codexItem({ ask: 'q' + i }, i)), []).length, 200);
});

test('ranges of days', () => {
  const day = (r) => new Date(r.from).getDay();
  assert.equal(day(rangeOf('last tuesday', NOW)), 2);
  assert.equal(new Date(rangeOf('last tuesday', NOW).from).getDate(), 13);
  assert.equal(new Date(rangeOf('yesterday', NOW).from).getDate(), 17);
  assert.equal(rangeOf('this week', NOW).to - rangeOf('this week', NOW).from, 7 * 864e5);
  assert.equal(rangeOf('sunday', NOW).from, new Date(2026, 9, 18).getTime());
  assert.equal(new Date(rangeOf('last sunday', NOW).from).getDate(), 11);
  assert.equal(rangeOf('whenever', NOW), null);
});

test('echo asks and what they replay', () => {
  assert.equal(echoOf('replay my best answers from this week', NOW).kind, 'best');
  assert.equal(echoOf('what did I decide last tuesday', NOW).kind, 'decide');
  assert.equal(echoOf('what did I decide', NOW).range, null);
  for (const no of ['echo chamber meaning', 'replay the game', 'what did i decide to have for lunch', 'what did I decide on a whim']) assert.equal(echoOf(no, NOW), null, no);
  const t = (d) => new Date(2026, 9, d, 9).toISOString();
  const log = [
    { t: t(16), ask: 'which is better, rust or go?', score: 'pass', note: 'skill:compare' },
    { t: t(17), ask: 'moon tonight', score: 'pass', note: 'skill:moontonight' },
    { t: t(17), ask: 'junk', score: 'fail', note: 'skill:x' },
    { t: t(17), ask: 'what did I decide yesterday', score: 'pass', note: 'skill:echo-chamber' },
    { t: t(3), ask: 'old one', score: 'pass', note: 'skill:y' },
  ];
  const q = echoOf('replay my best answers from this week', NOW);
  const best = echoes({ log, codex: [{ ask: 'filed one', t: new Date(2026, 9, 14).getTime(), skill: 'tip', text: 'x' }] }, q);
  assert.deepEqual(best.map((r) => r.ask), ['filed one', 'moon tonight', 'which is better, rust or go?']);
  const dec = echoes({ log, codex: [] }, echoOf('what did I decide', NOW));
  assert.deepEqual(dec.map((r) => r.ask), ['which is better, rust or go?']);
});

test('capsule asks, dates and the hashed word', async () => {
  assert.equal(capsuleOf('seal a time capsule until 2027-01-01').until, new Date(2027, 0, 1).getTime());
  assert.equal(capsuleOf('seal a time capsule until 1 january 2027').until, new Date(2027, 0, 1).getTime());
  assert.equal(capsuleOf('seal a time capsule until february 30 2027'), null);
  assert.deepEqual(capsuleOf('seal a capsule for the word aurora'), { op: 'seal', word: 'aurora' });
  assert.deepEqual(capsuleOf('open the capsule aurora'), { op: 'open', word: 'aurora' });
  assert.deepEqual(capsuleOf('open my capsules'), { op: 'due' });
  for (const no of ['what is a time capsule', 'time capsule song', 'capsule wardrobe', 'open the capsule', 'seal the envelope']) assert.equal(capsuleOf(no), null, no);
  assert.ok(Number.isNaN(dateOf('someday')));
  const h = await hashWord(' Aurora ');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, await hashWord('aurora'));
  const snap = snapshotOf({ a: { id: 'a', kind: 'clock' }, b: { id: 'b', kind: 'sticky', text: 'milk' } });
  assert.equal(snap.things.length, 2);
  assert.ok(snapshotOf({}).error);
  const word = newCapsule({ hash: h }, snap.things, NOW);
  assert.ok(!JSON.stringify(word).includes('aurora'), 'the word itself is never kept');
  assert.equal(openable(word, { hash: h }), true);
  assert.equal(openable(word, { hash: await hashWord('other') }), false);
  assert.equal(openable(word, {}), false);
  const dated = newCapsule({ until: NOW + 864e5 }, snap.things, NOW);
  assert.equal(openable(dated, { now: NOW }), false);
  assert.equal(openable(dated, { now: NOW + 864e5 }), true);
  const back = restorable(word, (t, i) => 'n' + i);
  assert.deepEqual(back.map((x) => x.id), ['n0', 'n1']);
  assert.equal(word.things[0].id, 'a');
});

test('whispers surface once', () => {
  assert.deepEqual(whisperOf('leave a whisper on the clock: remember milk'), { target: 'the clock', text: 'remember milk' });
  assert.equal(whisperOf('Leave a whisper on the note: call: back').text, 'call: back');
  for (const no of ['whisper of the heart', 'leave a whisper', 'leave a message for mom', 'leave a whisper on the clock:']) assert.equal(whisperOf(no), null, no);
  const things = { c1: { id: 'c1', kind: 'clock' }, s1: { id: 's1', kind: 'sticky', label: 'groceries' }, s2: { id: 's2', kind: 'sticky' } };
  assert.equal(findThingId(things, { kind: 'clock' }), 'c1');
  assert.equal(findThingId(things, { kind: 'sticky', name: 'groceries' }), 's1');
  assert.equal(findThingId(things, { kind: 'timer' }), '');
  assert.equal(findThingId(things, { self: true }, 's2'), 's2');
  let l = addWhisper([], 'c1', 'remember milk', 1);
  l = addWhisper(l, 's1', 'other', 2);
  const { shown, rest } = takeWhispers(l, 'c1');
  assert.equal(shown.length, 1);
  assert.equal(takeWhispers(rest, 'c1').shown.length, 0, 'once');
  let many = []; for (let i = 0; i < 5; i++) many = addWhisper(many, 'c1', 'n' + i, i);
  assert.equal(many.length, 3);
});

test('the store round trips and breaks gracefully', () => {
  const mem = new Map(); const s = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(loadList('codex', s), []);
  assert.equal(saveList('codex', [{ a: 1 }], s), true);
  assert.deepEqual(loadList('codex', s), [{ a: 1 }]);
  mem.set('a2m.void.codex.v1', 'not json');
  assert.deepEqual(loadList('codex', s), []);
});

test('each skill takes its examples and none of its near misses', () => {
  for (const sk of [skills, echo, cap, whisper]) {
    for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), sk.name + ' takes ' + e);
    for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), sk.name + ' leaves ' + n);
  }
});
