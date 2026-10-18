// Stage pack B (owner, 2026-10-18): error garden, idea certificate, noun heat, hunting question. Pure logic only.
// Run: node --test tools/stage-pack-b.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { words, sameThing } from '../void-live-deploy/lib/stage-words.js';
import { escHtml, tidy } from '../void-live-deploy/lib/stage-pack.js';
import errorGarden, { gardenIntent, plant, writeRule, stageOf } from '../void-live-deploy/skills/error-garden.js';
import ideaCert, { certIntent, issue, bury } from '../void-live-deploy/skills/idea-certificate.js';
import nounHeat, { heatIntent, polarity, entriesFrom, heatOf } from '../void-live-deploy/skills/noun-heat.js';
import hunting, { questionIntent, register, release, face, pick } from '../void-live-deploy/skills/hunting-question.js';

test('words: content words, stems, same thing said twice', () => {
  assert.deepEqual(words('I sent the emails before checking!'), ['sent', 'email', 'before', 'check']);
  assert.ok(sameThing('sent the email before checking it', 'I sent emails before checking'));
  assert.ok(!sameThing('sent the email before checking it', 'forgot to water the plants'));
  assert.ok(!sameThing('', 'x'));
});

test('error garden: sprout, weed, compost', () => {
  assert.deepEqual(gardenIntent('plant my mistake: I sent the email before checking it'), { act: 'plant', text: 'I sent the email before checking it' });
  assert.deepEqual(gardenIntent('show my error garden'), { act: 'show' });
  assert.equal(gardenIntent('write a rule for my mistake: sent email before checking => read it aloud first').act, 'rule');
  for (const a of ['how do I garden', 'what is an error budget', 'plant tomatoes in spring', 'plant my mistake:']) assert.equal(gardenIntent(a), null, a);
  let r = plant([], 'I sent the email before checking it', 1);
  assert.equal(r.stage, 'sprout');
  r = plant(r.plants, 'sent emails before checking', 2);
  assert.equal(r.plants.length, 1); assert.equal(r.stage, 'weed'); assert.equal(r.plants[0].count, 2);
  r = plant(r.plants, 'forgot the milk', 3);
  assert.equal(r.plants.length, 2); assert.equal(r.stage, 'sprout');
  const w = writeRule(r.plants, 'sent email before checking', 'read it aloud first');
  assert.equal(w.stage, 'compost'); assert.equal(stageOf(w.plants[0]), 'compost'); assert.equal(w.plants[0].rule, 'read it aloud first');
  assert.equal(writeRule(r.plants, 'unknown thing entirely', 'a rule').index, -1);
  assert.equal(writeRule(r.plants, 'forgot the milk', '  ').index, -1);
  assert.equal(plant(w.plants, 'sent the email before checking', 4).stage, 'compost'); // a repeat of a composted one keeps its rule
});

test('idea certificate: refuses without a why, buries only with a death note', () => {
  const k = certIntent('keep this idea: a stage that remembers | why: it makes coming back feel like home | parent: make it feel alive | rejected: a login wall; a feed');
  assert.equal(k.act, 'keep'); assert.equal(k.idea, 'a stage that remembers'); assert.equal(k.parent, 'make it feel alive'); assert.deepEqual(k.rejected, ['a login wall', 'a feed']);
  for (const a of ['what is a certificate', 'keep this note', 'bury the lede']) assert.equal(certIntent(a), null, a);
  const bare = certIntent('keep this idea: a stage that remembers');
  assert.equal(issue([], bare).ok, false);
  assert.match(issue([], bare).reason, /why/);
  const ok = issue([], k, 1000);
  assert.ok(ok.ok); assert.equal(ok.cert.n, 1);
  assert.equal(issue(ok.certs, k).ok, false); // already kept
  assert.equal(bury(ok.certs, 'stage remembers', '').ok, false);
  assert.match(bury(ok.certs, '#1', '').reason, /death note/);
  const dead = bury(ok.certs, '#1', 'it was not needed after all', 2000);
  assert.ok(dead.ok); assert.equal(dead.certs[0].dead.note, 'it was not needed after all');
  assert.equal(bury(dead.certs, '#1', 'again please').ok, false); // already buried
  assert.equal(certIntent('bury idea 1 | death note: no longer true').act, 'bury');
});

test('noun heat: warm, cold and burning, sorted', () => {
  assert.ok(heatIntent('how hot are my nouns') && heatIntent('noun heat'));
  for (const a of ['how hot is it today', 'what is a noun', 'how hot should the oven be']) assert.ok(!heatIntent(a), a);
  assert.equal(polarity('yes: ship the garden'), 'yes'); assert.equal(polarity("no: don't ship the garden"), 'no'); assert.equal(polarity('plain note'), '');
  const things = { a: { kind: 'sticky', text: 'yes: ship the garden' }, b: { kind: 'sticky', text: 'no: ship the garden later' }, c: { kind: 'notepad', text: 'bread recipe' }, d: { kind: 'timer', text: 'ignored' } };
  const entries = entriesFrom(things, ['more garden work', 'make a counter', 'how hot are my nouns']); // newest first
  assert.equal(entries.length, 5); assert.ok(!entries.some((e) => /hot are/.test(e.text)));
  const rows = heatOf(entries);
  const by = Object.fromEntries(rows.map((r) => [r.term, r]));
  assert.equal(by.ship.label, 'burning'); assert.equal(by.garden.label, 'burning'); assert.equal(by.bread.label, 'cold');
  assert.equal(rows[0].label, 'burning');
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].heat >= rows[i].heat);
  assert.deepEqual(heatOf([]), []);
});

test('hunting question: registered once, released only with a reason', () => {
  assert.deepEqual(questionIntent("a question I'm avoiding: should I quit my job"), { act: 'register', q: 'should I quit my job' });
  assert.equal(questionIntent('a question I am avoiding: am I ready').act, 'register');
  assert.equal(questionIntent('release my question quit my job | reason: I decided to stay').reason, 'I decided to stay');
  assert.equal(questionIntent('I faced quit my job').act, 'faced');
  for (const a of ['ask me a question', 'what is the question', 'the question of the day']) assert.equal(questionIntent(a), null, a);
  const r = register([], 'should I quit my job', 1);
  assert.ok(r.ok);
  assert.equal(register(r.qs, 'Should I quit my job?').ok, false); // once
  assert.equal(pick(r.qs, 0).q, 'should I quit my job');
  assert.equal(release(r.qs, 'quit my job', '').ok, false);
  assert.equal(release(r.qs, 'quit my job', 'ok').ok, false);
  const rel = release(r.qs, 'quit my job', 'I decided to stay and be kind to myself', 2);
  assert.ok(rel.ok); assert.equal(pick(rel.qs, 0), null); assert.equal(rel.qs[0].status, 'released');
  const two = register(register([], 'am I ready', 1).qs, 'do I love her', 2).qs;
  assert.deepEqual([0, 1, 2].map((v) => pick(two, v).q), ['am I ready', 'do I love her', 'am I ready']);
  assert.equal(face(two, 'am I ready').qs[0].status, 'faced');
  assert.equal(face(two, 'something else entirely').ok, false);
});

test('the four skills carry their examples, near-misses and a stage kind', () => {
  for (const [sk, kind] of [[errorGarden, 'errgarden'], [ideaCert, 'ideacert'], [nounHeat, 'nounheat'], [hunting, 'hunted']]) {
    assert.ok(sk.stageKinds[kind] && typeof sk.stageKinds[kind].mount === 'function', sk.name);
    for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), sk.name + ' takes ' + e);
    for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), sk.name + ' leaves ' + n);
  }
});

test("stage pack helpers: escaping and tidy asks", () => {
  assert.equal(escHtml("<b>\"x\"</b> & y"), "&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y");
  assert.equal(tidy("  plant   my mistake: x.  "), "plant my mistake: x");
});
