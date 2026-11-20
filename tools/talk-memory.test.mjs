// Talk memory: "my name is Sam" then "what is my name" (lib/talk-memory.js, functions/api/answer.js, void.html showAnswer). Run: node --test tools/talk-memory.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { talkOf, talkBlock, introOf, introAnswer, talkRead, talkAdd, TALK_MAX, TALK_IDLE_MS } from '../void-live-deploy/lib/talk-memory.js';
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
test('an introduction is answered without a model, and only a plain one', () => {
  assert.equal(introOf('my name is Sam'), 'Sam');
  assert.equal(introOf('Hi, my name is sam!'), 'Sam');
  assert.equal(introOf('call me Ana Lopez'), 'Ana Lopez');
  assert.equal(introOf('my name is not important but what is the capital of France'), null);
  assert.equal(introOf('what is my name'), null);
  assert.match(introAnswer('Sam'), /Sam.*this tab/);
});
test('the tab keeps the last turns, forgets after quiet, and the server bounds what it reads', () => {
  const s = store();
  for (let i = 0; i < 12; i++) talkAdd(s, 'ask ' + i, 'answer ' + i, 1000 + i);
  const t = talkRead(s, 2000);
  assert.equal(t.length, TALK_MAX); assert.equal(t[0].ask, 'ask 4');
  assert.deepEqual(talkRead(s, 2000 + TALK_IDLE_MS), []);
  const got = talkOf({ talk: [{ ask: 'my name is Sam', answer: 'Nice to meet you, Sam.' }, 'junk', { ask: 'x'.repeat(999) }] });
  assert.equal(got.length, 2); assert.equal(got[1].ask.length, 160);
  assert.equal(talkOf({}), null); assert.equal(talkOf({ talk: 'no' }), null);
  assert.match(talkBlock(got), /They said: my name is Sam/);
});
test('the answer path reads talk, never caches it, and the page sends it from sessionStorage', () => {
  const a = readFileSync(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url), 'utf8');
  assert.match(a, /masked \|\| self \|\| told \|\| before \|\| talk \? null/);
  assert.match(a, /!before && !talk\) try \{/);
  assert.match(a, /!before && !talk && storable\(/);
  assert.match(a, /talkBlock\(talk\) \+ beforeBlock\(follows\)/);
  for (const f of ['../void.html', '../void-live-deploy/void.html']) {
    const v = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(v, /sessionStorage\.getItem\(TALK_KEY\)/);
    assert.match(v, /\.\.\.\(talk\.length \? \{ talk \} : \{\}\)/);
  }
});
