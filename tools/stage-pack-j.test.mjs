// Stage pack B (owner, 2026-10-18, operating laws for thinking with a machine): ask-immune, four-channels, stakes-phase.
// Pure logic only. Run: node --test tools/stage-pack-b.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImmune, scan, verdict, clarity, quarantine, meet } from '../void-live-deploy/skills/ask-immune.js';
import { parseFour, split, channels, template } from '../void-live-deploy/skills/four-channels.js';
import { parseStakes, phaseOf, gate, toggle, dissentOk, COOL_MS } from '../void-live-deploy/skills/stakes-phase.js';

test('ask-immune: asks it takes and the look-alikes it leaves', () => {
  assert.equal(parseImmune('check my ask for vague goals'), '');
  assert.equal(parseImmune('immune check: make it better'), 'make it better');
  assert.equal(parseImmune('Immune check'), '');
  for (const a of ['what is the immune system', 'check my spelling', 'check my ask for typos', 'how do I boost my immune system']) assert.equal(parseImmune(a), null, a);
});

test('ask-immune: finds each pathogen and mounts its response', () => {
  const ids = (t) => scan(t).map((p) => p.id);
  assert.deepEqual(ids('make the app better'), ['vague']);
  assert.deepEqual(ids('cut load time to 2 seconds by 2026-11-01'), []);
  assert.deepEqual(ids('ship the login and also fix everything'), ['scope', 'scope']);
  assert.deepEqual(ids('conversion is 37.42% now'), ['precision']);
  assert.deepEqual(ids('conversion is 37.42% according to Stripe'), []);
  assert.equal(quarantine('ship the login and also fix everything'), 'ship the login fix');
});

test('ask-immune: fever blocks Accept until a unit, a date or a named person appears', () => {
  let v = verdict('make the app better and also fix everything');
  assert.ok(v.fever && v.needsDef && !v.canAccept);
  v = verdict('make the app better and also fix everything', 'faster');
  assert.ok(v.fever && !v.canAccept); // defined, but still no clarity marker
  v = verdict('make the app better and also fix everything', 'load under 2 seconds');
  assert.ok(!v.fever && v.canAccept);
  assert.ok(verdict('grow signups, ask Priya').clarity.person);
  assert.ok(!clarity('do it by Friday').person && clarity('do it by Friday').date);
  assert.ok(clarity('save $40').unit && clarity('in 3 weeks').unit);
  assert.equal(verdict('').canAccept, false);
});

test('ask-immune: antibodies count each kind once per check', () => {
  let a = meet({}, scan('better and also everything'));
  assert.deepEqual(a, { vague: 1, scope: 1 });
  a = meet(a, scan('better'));
  assert.deepEqual(a, { vague: 2, scope: 1 });
});

test('four-channels: asks it takes and the look-alikes it leaves', () => {
  assert.equal(parseFour('answer in four channels'), '');
  assert.equal(parseFour('answer in four channels: should we go?'), 'should we go?');
  for (const a of ['four channel audio receiver', 'answer in four words', 'what is a four channel amp', 'answer in two sentences']) assert.equal(parseFour(a), null, a);
});

test('four-channels: markers split, missing channels get prompts, the synthesis is never written', () => {
  const s = split('Is it sound? Claim: yes. Doubt: rent is high. Method: ask Sam. Risk: cost.');
  assert.equal(s.question, 'Is it sound?');
  assert.deepEqual(s.given, { claim: 'yes.', doubt: 'rent is high.', method: 'ask Sam.', risk: 'cost.' });
  const r = channels('Is it sound? Claim: yes.');
  assert.equal(r.cols.claim[0].text, 'yes.');
  for (const ch of ['doubt', 'method', 'risk']) assert.ok(r.cols[ch][0].prompt && r.cols[ch][0].text === template(ch, 'Is it sound?'), ch);
  assert.ok(!('synthesis' in r));
});

test('four-channels: a sentence in two channels collides and is not rendered twice', () => {
  const r = channels('Q? Claim: It is cheap. Doubt: it is cheap! It may break. Method: test it. Risk: It may break.');
  assert.deepEqual(r.cols.claim.map((s) => s.text), ['It is cheap.']);
  assert.deepEqual(r.cols.doubt.map((s) => s.text), ['It may break.']);
  assert.deepEqual(r.cols.risk, []);
  assert.deepEqual(r.collisions.map((c) => c.channels.join('>')), ['claim>doubt', 'doubt>risk']);
  const every = Object.values(r.cols).flat().map((s) => s.text.toLowerCase().replace(/[^a-z ]/g, ''));
  assert.equal(new Set(every).size, every.length);
});

test('stakes-phase: asks it takes and the look-alikes it leaves', () => {
  assert.deepEqual(parseStakes('set the stakes'), []);
  assert.deepEqual(parseStakes('set the stakes: money and people'), ['money', 'people']);
  assert.deepEqual(parseStakes('Set the stakes for deleting the account'), ['irreversible']);
  for (const a of ['set the table for four', 'what are the stakes in poker', 'raise the stakes in my game', 'set the timer for ten minutes']) assert.equal(parseStakes(a), null, a);
});

test('stakes-phase: phases jump (open, careful, frozen), there is no in-between', () => {
  assert.equal(phaseOf([]), 'open');
  assert.equal(phaseOf(['money']), 'careful');
  assert.equal(phaseOf(['irreversible']), 'careful');
  assert.equal(phaseOf(['money', 'people']), 'frozen');
  assert.equal(phaseOf(['money', 'money', 'nonsense']), 'careful');
});

test('stakes-phase: careful needs a dissent line and the cooling-off; frozen never confirms', () => {
  const t0 = 1000000;
  assert.ok(gate({ stakes: [] }, t0).canConfirm);
  const careful = { stakes: ['money'], dissent: '', coolStart: t0 };
  assert.ok(!gate(careful, t0 + COOL_MS + 1).canConfirm); // cooled, but no dissent
  assert.ok(!gate({ ...careful, dissent: 'rent may double' }, t0 + 1000).canConfirm); // dissent, but still cooling
  assert.ok(gate({ ...careful, dissent: 'rent may double' }, t0 + COOL_MS).canConfirm);
  assert.ok(!dissentOk('no') && !dissentOk('... !!') && dissentOk('it may fail'));
  const frozen = gate({ stakes: ['money', 'people'], dissent: 'we could all be wrong here', coolStart: 0 }, 1e12);
  assert.deepEqual(frozen.acts, ['read']);
  assert.ok(!frozen.canConfirm && !frozen.canEdit);
});

test('stakes-phase: changing phase restarts the cooling clock', () => {
  const s = toggle({ stakes: [], coolStart: 0 }, 'money', 5000);
  assert.deepEqual(s.stakes, ['money']); assert.equal(s.coolStart, 5000);
  assert.equal(toggle({ ...s, dissent: 'x y z' }, 'people', 9000).coolStart, 9000); // careful -> frozen
  assert.equal(toggle({ stakes: ['money'], coolStart: 5000 }, 'bogus', 9000).coolStart, 5000); // same phase, same clock
});

test('stage-pack: the shared escape keeps card text from becoming markup', async () => {
  const { escHtml } = await import('../void-live-deploy/lib/stage-pack.js');
  assert.equal(escHtml('<b onclick="x">&'), '&lt;b onclick=&quot;x&quot;&gt;&amp;');
});
