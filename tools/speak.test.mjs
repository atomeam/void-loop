// node --test tools/speak.test.mjs: Verse's spoken voice (frontier #16, first piece). Hold Space to talk; Verse answers out loud
// in one low voice, sentence by sentence (void-live-deploy/lib/speak.js, wired in void.html).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOICE, HOLD_MS, pickVoice, speakable, chunks, holdKey, phrases, cadence } from '../void-live-deploy/lib/speak.js';

const v = (name, lang, localService = true) => ({ name, lang, localService });

test('the voice: the page\'s language, a low one where there is one, never a novelty voice; none at all is fine', () => {
  const voices = [v('Samantha', 'en-US'), v('Bubbles', 'en-US'), v('Daniel', 'en-GB'), v('Alex', 'en-US'), v('Thomas', 'fr-FR'), v('Google US English', 'en-US', false)];
  assert.equal(pickVoice(voices, 'en-US').name, 'Alex');
  assert.equal(pickVoice(voices, 'en-AU').name, 'Daniel', 'no exact match: the same language, a low voice');
  assert.equal(pickVoice(voices, 'fr-FR').name, 'Thomas');
  assert.equal(pickVoice([v('Bubbles', 'en-US'), v('Samantha', 'en-US')], 'en-US').name, 'Samantha', 'no low voice: any plain one, never a novelty');
  assert.equal(pickVoice([], 'en-US'), null);
  assert.equal(pickVoice(undefined), null);
  assert.ok(VOICE.pitch < 1 && VOICE.rate <= 1, 'low and unhurried');
});

test('what is said: no code, links, citation marks or source line; sentences in order, the first one alone so it starts at once', () => {
  const card = 'Canberra is the capital of Australia. It was chosen in 1908 as a compromise between Sydney and Melbourne [1].\n```js\nconst x = 1;\n```\nSee https://example.com/a for more.\nSource: [1] Wikipedia · written by Verse';
  const s = speakable(card);
  for (const bad of [/const x/, /https?:/, /\[1\]/, /Source:/, /written by Verse/]) assert.doesNotMatch(s, bad);
  const c = chunks(card);
  assert.equal(c[0], 'Canberra is the capital of Australia.');
  assert.match(c.join(' '), /compromise between Sydney and Melbourne/);
  assert.ok(c.every((x) => x.length <= 220));
  const long = chunks(('word '.repeat(80) + '. ').repeat(40));
  assert.ok(long.every((x) => x.length <= 220), 'a long sentence is cut');
  assert.ok(long.join(' ').length <= 1900, 'a long page is capped');
  assert.deepEqual(chunks(''), []);
});

test('the held key: Space alone, not a repeat, not while typing, and only with nothing focused', () => {
  const body = { tagName: 'BODY', getAttribute: () => null };
  const k = (o = {}) => ({ code: 'Space', key: ' ', target: body, ...o });
  assert.equal(holdKey(k(), false), true);
  assert.equal(holdKey(k(), true), false, 'typing');
  assert.equal(holdKey(k({ repeat: true }), false), false);
  assert.equal(holdKey(k({ ctrlKey: true }), false), false);
  assert.equal(holdKey(k({ code: 'KeyA', key: 'a' }), false), false);
  for (const tagName of ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'DIV', 'CANVAS']) assert.equal(holdKey(k({ target: { tagName, getAttribute: () => null } }), false), false, tagName + ' keeps its own Space');
  assert.ok(HOLD_MS >= 150 && HOLD_MS <= 400, 'a tap stays a tap');
});

test('void.html holds Space to talk and speaks voice answers with lib/speak.js', () => {
  const html = fs.readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  assert.match(html, /import\('\/lib\/speak\.js'\)/);
  assert.match(html, /holdKey\(/);
  assert.match(html, /function replyAloud\(/);
});

test('the pacing: short phrases with a beat at commas, colons, dashes and sentence ends; no scrap of a word or two; nothing lost', () => {
  const card = 'Canberra is the capital of Australia. It was chosen in 1908, after years of argument, as a compromise between Sydney and Melbourne: neither city would let the other win.';
  const p = phrases(card);
  assert.deepEqual(p, ['Canberra is the capital of Australia.', 'It was chosen in 1908,', 'after years of argument,', 'as a compromise between Sydney and Melbourne:', 'neither city would let the other win.']);
  assert.equal(p.join(' '), speakable(card), 'every word, in order');
  const run = 'The model reads every line you paste and checks each call against the rules it knows and then it writes the fixes it is sure of';
  const r = phrases(run);
  assert.ok(r.length >= 2 && r.every((x) => x.length <= 90), 'a long phrase is cut at a joining word: ' + JSON.stringify(r));
  assert.match(r[1], /^(?:and|but|so|which|because|when|while|then|or)\b/);
  assert.deepEqual(phrases('Yes, I can.'), ['Yes, I can.'], 'a scrap joins its neighbour');
  assert.deepEqual(phrases(''), []);
  assert.ok(VOICE.pitch <= 0.65 && VOICE.rate < 0.95, 'a low, steady robot');
});

test('the cadence (asked by Verse): precise content is said slower than plain talk, never below 0.78', () => {
  const plain = cadence('Canberra is the capital of Australia, chosen as a compromise between Sydney and Melbourne.');
  const forge = cadence('Forge: print the bracket at 0.2 mm layers, 20% infill, nozzle at 210 °C; step 3 sets the tolerance to 0.15 mm.');
  const sim = cadence('The simulation ran 400 steps; at step 120 the ratio hit 1.6 and the voltage settled at 4.8 V.');
  assert.equal(plain, VOICE.rate, 'plain talk keeps the voice');
  assert.ok(forge < plain && sim < plain, JSON.stringify({ plain, forge, sim }));
  assert.ok(forge >= 0.78 && sim >= 0.78);
  assert.equal(cadence(''), VOICE.rate);
  assert.equal(cadence('It is 3:40 pm in Tokyo.'), VOICE.rate, 'a short answer keeps the pace');
});
