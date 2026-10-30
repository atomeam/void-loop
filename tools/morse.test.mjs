// the morse skill (skills/morse.js): its examples reach it, its near misses do not (util's "x in morse" asks among them),
// the text is encoded letter by letter with / between words, and run() puts the code on a page, escaped, with nothing fetched.
//   node --test tools/morse.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { payloadOf, toMorse } from '../void-live-deploy/skills/morse.js';

test('every example is claimed and no near miss is', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
  for (const a of ['sos in morse', 'hello in morse code', 'morse code of sos', 'morse alphabet', 'morse code ...---...']) assert.ok(!skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.suite().ok, true);
});

test('the text to encode comes after the ask', () => {
  assert.equal(payloadOf('morse code hello'), 'hello');
  assert.equal(payloadOf('Please translate to morse Hello World!'), 'Hello World');
  assert.equal(payloadOf('encode in morse code sos'), 'sos');
  assert.equal(payloadOf('what is morse'), null);
});

test('letters split by spaces, words by /, unknown signs left out', () => {
  assert.equal(toMorse('sos'), '... --- ...');
  assert.equal(toMorse('Hi 5'), '.... .. / .....');
  assert.equal(toMorse('a,b'), '.- -...');
});

test('run shows the code and the text on a page, through esc', async () => {
  const el = { innerHTML: '' }; const seen = [];
  const said = await skill.run('morse code sos', { showPage: (f) => { f(el); return el; }, esc: (s) => { seen.push(s); return String(s); } });
  assert.equal(said, 'morse');
  assert.deepEqual(seen, ['... --- ...', 'sos']);
  assert.match(el.innerHTML, /^<h2>Morse<\/h2><p [^>]*>\.\.\. --- \.\.\.<\/p><div class="sub">sos<\/div>$/);
});
