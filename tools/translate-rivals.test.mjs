// node tools/translate-rivals.test.mjs: what /translate/ took from DeepL Write and the other translators (lib/translate-write.js and the
// write mode of POST /api/translate): the prompt, what comes back, the changes word by word, the saved phrases as CSV.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as T from '../void-live-deploy/lib/translate-write.js';
import { onRequestPost } from '../void-live-deploy/functions/api/translate.js';

const req = (body) => new Request('https://a-to-mind.com/api/translate', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.' + Math.floor(Math.random() * 200) }, body: JSON.stringify(body) });

test('DeepL Write\'s four styles and four tones', () => {
  assert.deepEqual(T.STYLES.filter((s) => s.id).map((s) => s.id), ['simple', 'business', 'academic', 'casual']);
  assert.deepEqual(T.TONES.filter((s) => s.id).map((s) => s.id), ['enthusiastic', 'friendly', 'confident', 'diplomatic']);
});

test('the prompt names the language, the style and the tone, and asks for the text only', () => {
  const m = T.writePrompt('I has a apple', 'en', 'business', 'friendly');
  assert.match(m[0].content, /English editor/); assert.match(m[0].content, /Output only/);
  assert.match(m[1].content, /business register/); assert.match(m[1].content, /friendly tone/); assert.match(m[1].content, /I has a apple/);
  assert.doesNotMatch(T.writePrompt('x', 'fr')[1].content, /register|tone\./); assert.match(T.writePrompt('x', 'fr')[0].content, /French/);
});

test('what comes back: quotes and a lead-in dropped, a runaway answer refused', () => {
  assert.equal(T.rewrittenOf('"I have an apple."', 'I has a apple.'), 'I have an apple.');
  assert.equal(T.rewrittenOf('Here is the improved text: I have an apple.', 'I has a apple.'), 'I have an apple.');
  assert.equal(T.rewrittenOf('', 'abc'), ''); assert.equal(T.rewrittenOf('x'.repeat(500), 'short text'), ''); assert.equal(T.rewrittenOf('a', 'a much longer sentence here'), '');
});

test('the changes, word by word, rebuild both texts', () => {
  const a = 'I has a apple. It are red.', b = 'I have an apple. It is red.', ch = T.changes(a, b);
  assert.equal(ch.filter((c) => c.op !== '+').map((c) => c.t).join(''), a); assert.equal(ch.filter((c) => c.op !== '-').map((c) => c.t).join(''), b);
  assert.deepEqual(ch.filter((c) => c.op === '+').map((c) => c.t), ['have', 'an', 'is']); assert.equal(T.changedWords(ch), 3);
  assert.deepEqual(T.changes('same', 'same'), [{ t: 'same', op: '=' }]);
});

test('saved phrases as CSV: quoted where needed, no formula injection', () => {
  const csv = T.phrasesCsv([{ q: 'hello, friend', out: 'hola, amigo', from: 'en', to: 'es' }, { q: '=HYPERLINK("x")', out: 'a "b"', detected: 'en', to: 'fr' }]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Text,Translation,From,To'); assert.equal(lines[1], '"hello, friend","hola, amigo",en,es'); assert.equal(lines[2], '"\'=HYPERLINK(""x"")","a ""b""",en,fr');
});

test('POST { mode: write }: the improved text and its changes from the model', async () => {
  const seen = []; const env = { AI: { run: async (m, a) => { seen.push(a.messages); return { response: 'I have an apple.' }; } } };
  const r = await onRequestPost({ request: req({ mode: 'write', text: 'I has a apple.', lang: 'en', style: 'simple', tone: 'nope' }), env }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.text, 'I have an apple.'); assert.equal(j.style, 'simple'); assert.equal(j.tone, ''); assert.equal(j.changed, 2); assert.equal(j.lang, 'en');
  assert.match(seen[0][1].content, /simple words/);
});

test('POST { mode: write }: honest errors with no text, too much, or no model', async () => {
  let r = await onRequestPost({ request: req({ mode: 'write', text: '' }), env: {} }); assert.equal(r.status, 400);
  r = await onRequestPost({ request: req({ mode: 'write', text: 'x'.repeat(T.WRITE_MAX + 1) }), env: {} }); assert.equal(r.status, 400);
  r = await onRequestPost({ request: req({ mode: 'write', text: 'I has a apple' }), env: {} }); assert.equal(r.status, 503); assert.match((await r.json()).error, /model/);
  r = await onRequestPost({ request: req({ mode: 'write', text: 'I has a apple' }), env: { AI: { run: async () => ({ response: '' }) } } }); assert.equal(r.status, 503);
});
