import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanWord, sensesFrom } from '../void-live-deploy/lib/meanings.js';
import { UA, defineWord, answer } from '../void-live-deploy/functions/api/meanings.js';
import { failedFloors } from './floor-live.mjs';

test('a counted page that failed does not stay a floor', () => {
  assert.deepEqual(failedFloors([{ id: 'meanings', works: true }, { id: 'qr', works: false }], [{ id: 'meanings', ok: false }]), ['meanings']);
  assert.deepEqual(failedFloors([{ id: 'qr', works: false }], []), []);
});

test('a word is one to three words of letters', () => {
  assert.equal(cleanWord(' serendipity '), 'serendipity');
  assert.equal(cleanWord('déjà vu'), 'déjà vu');
  assert.equal(cleanWord('define <script>'), '');
  assert.equal(cleanWord('https://example.com'), '');
});

test('senses keep the part of speech, three lines, and one short example', () => {
  const senses = sensesFrom({ en: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A <b>happy</b> accident.', examples: ['A serendipity.'] }, { definition: '   ' }] }] });
  assert.equal(senses.length, 1);
  assert.equal(senses[0].pos, 'noun');
  assert.equal(senses[0].defs[0], 'A happy accident.');
  assert.equal(senses[0].ex, 'A serendipity.');
  assert.deepEqual(sensesFrom(null), []);
  assert.deepEqual(sensesFrom({}), []);
});

test('the dictionary call sends the Verse user agent and returns clean JSON', async () => {
  let sent = '';
  const fetchImpl = async (_url, opt) => {
    sent = opt.headers['user-agent'];
    return { ok: true, status: 200, json: async () => ({ en: [{ partOfSpeech: 'Interjection', definitions: [{ definition: 'A greeting.' }] }] }) };
  };
  const hello = await defineWord('hello', fetchImpl);
  assert.equal(sent, UA);
  assert.equal(hello.status, 200);
  assert.equal(hello.body.found, true);
  assert.equal(hello.body.senses[0].defs[0], 'A greeting.');
  const missing = await defineWord('zzqxnotaword', async () => ({ ok: false, status: 404, json: async () => ({}) }));
  assert.equal(missing.body.found, false);
  assert.equal(missing.body.senses.length, 0);
  const blocked = await defineWord('hello', async () => ({ ok: false, status: 403, json: async () => ({}) }));
  assert.equal(blocked.status, 502);
  const prev = globalThis.fetch;
  globalThis.fetch = async (_url, opt) => {
    sent = opt.headers['user-agent'];
    return { ok: true, status: 200, json: async () => ({ en: [{ partOfSpeech: 'Interjection', definitions: [{ definition: 'A greeting.' }] }] }) };
  };
  try {
    const res = await answer(new Request('https://a-to-mind.com/api/meanings?word=hello'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.found, true);
    assert.equal(sent, UA);
  } finally { globalThis.fetch = prev; }
});
