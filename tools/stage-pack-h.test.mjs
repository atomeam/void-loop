// Stage pack H (owner, 2026-10-18): negative summons, the echo that disagrees, the near choir. Pure logic only (lib/stage-pack-h.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from '../void-live-deploy/lib/stage-pack-h.js';

// the files under test: skills/negative-summons.js, skills/echo-disagrees.js, skills/near-choir.js (loaded below by name) and lib/stage-pack-h.js
const dir =resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const real = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  try { const m = (await import(resolve(dir, f))).default; if (m && m.name && m.match && Array.isArray(m.examples)) real.push(m); } catch (_) {}
}

test('negativeOf takes only "everything except X" shapes', () => {
  assert.equal(H.negativeOf('summon everything except urgency'), 'urgency');
  assert.equal(H.negativeOf('Summon anything but the noise!'), 'noise');
  assert.equal(H.negativeOf('show me everything without stress'), 'stress');
  for (const t of ['summon the ancient ones', 'everything except tuesday is fine', 'summon everything', 'summon a sticky', '']) assert.equal(H.negativeOf(t), '', t);
});

test('every curated pair names a real skill and one of its real examples', () => {
  const by = new Map(real.map((s) => [s.name, s]));
  for (const list of [...H.MOODS.map((m) => m.prefer), H.GENTLE_POOL]) {
    for (const [name, ask] of list) {
      assert.ok(by.has(name), 'skill ' + name + ' exists');
      assert.ok(by.get(name).examples.includes(ask), name + ' has the example "' + ask + '"');
    }
  }
});

test('summonSet: urgency maps to calm, up to 4, never a skill that carries the word', () => {
  const r = H.summonSet('urgency', real);
  assert.equal(r.opposite, 'calm');
  assert.ok(r.picks.length >= 1 && r.picks.length <= 4);
  for (const p of r.picks) assert.ok(!H.carries(real.find((s) => s.name === p.name), 'urgency'));
  assert.ok(r.picks.some((p) => p.name === 'breath'));
});

test('summonSet: a synonym uses the same mood; an unknown word falls back and drops skills that carry it', () => {
  assert.equal(H.summonSet('hurry', real).opposite, 'calm');
  const r = H.summonSet('moon', real);
  assert.equal(r.opposite, 'something else');
  assert.ok(r.picks.length > 0 && r.picks.every((p) => p.name !== 'moon' && p.name !== 'skycard'));
  const fake = [{ name: 'breath', examples: ['rush breathing'] }, { name: 'sticky', examples: ['a sticky'] }];
  assert.deepEqual(H.summonSet('rush', fake).picks.map((p) => p.name), ['sticky']);
  assert.deepEqual(H.summonSet('', real).picks, []);
});

test('echoOf takes the three asks and not an echo chamber', () => {
  assert.deepEqual(H.echoOf('echo this'), { kind: 'this', question: '' });
  assert.deepEqual(H.echoOf('Keep the echo.'), { kind: 'keep', question: '' });
  assert.deepEqual(H.echoOf('what would the echo say should i learn to code?'), { kind: 'ask', question: 'should i learn to code' });
  for (const t of ['echo chamber acoustics', 'echo dot setup', 'what is an echo', 'echo']) assert.equal(H.echoOf(t), null, t);
});

test('echo framing and labelling', () => {
  const p = H.echoPrompt('  should i learn   to code ');
  assert.match(p, /strongest honest counter-view/);
  assert.match(p, /3 sentences/);
  assert.ok(p.endsWith('should i learn to code'));
  assert.equal(H.ECHO_LABEL, 'echo: a second view, not a correction');
  assert.ok(H.echoPrompt('x'.repeat(900)).length < 440);
  assert.equal(H.limitSentences('**One.** Two! Three? Four.', 3), 'One. Two! Three?');
});

test('echoUsable: only a model-written reply is an echo; busy, off and rate limits say so', () => {
  assert.equal(H.echoUsable(200, { answer: 'A. B. C. D.' }).text, 'A. B. C.');
  assert.equal(H.echoUsable(200, { answer: 'An excerpt.', note: 'model busy, from the web' }).ok, false);
  assert.equal(H.echoUsable(200, null).ok, false);
  const r = H.echoUsable(429, { answer: null, note: 'slow down' });
  assert.equal(r.ok, false);
  assert.match(r.why, /slow down/);
  assert.match(H.echoUsable(200, { answer: null }).why, /Nothing was spent/);
});

test('choirOf takes only the near-choir asks', () => {
  for (const t of ['show the near choir', 'what almost answered that', 'What almost answered it?']) assert.equal(H.choirOf(t), true, t);
  for (const t of ['choir practice near me', 'church choir hymns', 'show the choir']) assert.equal(H.choirOf(t), false, t);
});

test('lastRealAsk skips the pack\'s own asks', () => {
  assert.equal(H.lastRealAsk(['show the near choir', 'echo this', 'summon everything except noise', 'weather in oslo', 'tip']), 'weather in oslo');
  assert.equal(H.lastRealAsk(['show the near choir']), '');
  assert.equal(H.lastRealAsk(null), '');
});

test('nearChoir: matchers that also accept come first, then word overlap; the answerer is left out; max 3', () => {
  const skills = [
    { name: 'tip', examples: ['tip on 40 dollars'] },
    { name: 'recipe', examples: ['recipe for pancakes'] },
    { name: 'pancake-flip', examples: ['flip a pancake'] },
    { name: 'weather', examples: ['weather in paris'] },
    { name: 'sleep', examples: ['sleep calculator'] },
    { name: 'near-choir', examples: ['pancake near choir'] },
  ];
  const ask = 'pancake recipe tip';
  const r = H.nearChoir(ask, skills, (s) => s.name === 'recipe' || s.name === 'tip');
  assert.equal(r.taker, 'tip');
  assert.equal(r.near[0].name, 'recipe');
  assert.match(r.near[0].why, /matcher/);
  assert.equal(r.near[0].ask, 'recipe for pancakes');
  assert.ok(r.near.length <= 3 && r.near.every((n) => n.name !== 'tip' && n.name !== 'near-choir'));
  assert.ok(r.near.some((n) => n.name === 'pancake-flip' && /pancake/.test(n.why)));
  assert.deepEqual(H.nearChoir('', skills, () => true).near, []);
  assert.equal(H.nearChoir('zzz qqq', skills, () => false).near.length, 0);
  const many = Array.from({ length: 9 }, (_, i) => ({ name: 's' + i, examples: ['pancake ' + i] }));
  assert.equal(H.nearChoir('pancake', many, () => false).near.length, 3);
  assert.equal(H.nearChoir('pancake', many, () => { throw new Error('boom'); }).near.length, 3);
});

test('the three skills are real, tight and registered', async () => {
  const by = new Map(real.map((s) => [s.name, s]));
  for (const n of ['negative-summons', 'echo-disagrees', 'near-choir']) {
    const s = (await ({ 'negative-summons': () => import(resolve(dir, 'negative-summons.js')), 'echo-disagrees': () => import(resolve(dir, 'echo-disagrees.js')), 'near-choir': () => import(resolve(dir, 'near-choir.js')) })[n]()).default; // each loaded by its own file name, as well as in the folder scan above
    assert.equal(s.name, n);
    assert.ok(by.get(n), n + ' is also in the folder scan');
    for (const e of s.examples) assert.equal(s.match(e.toLowerCase(), e), true, n + ' takes "' + e + '"');
    for (const e of s.nearMisses) assert.equal(s.match(e.toLowerCase(), e), false, n + ' leaves "' + e + '"');
  }
  for (const t of ['summon the ancient ones', 'echo chamber acoustics', 'choir practice near me'])
    for (const n of ['negative-summons', 'echo-disagrees', 'near-choir']) assert.equal(by.get(n).match(t, t), false, n + ' leaves "' + t + '"');
});
