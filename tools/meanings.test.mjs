import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanWord, sensesFrom } from '../void-live-deploy/lib/meanings.js';
import { UA, defineWord, answer } from '../void-live-deploy/functions/api/meanings.js';
import { failedFloors, floorKind, markWorks, pagesToRun, withOwner } from './floor-live.mjs';

test('a counted page that failed does not stay a floor', () => {
  const counted = { id: 'meanings', kind: 'page', works: true, checked: true };
  assert.deepEqual(failedFloors([counted, { id: 'qr', kind: 'page', works: false, checked: true }, { id: 'podcasts', kind: 'page', works: true }], [{ id: 'meanings', ok: false }]), ['meanings']);
  assert.deepEqual(failedFloors([{ id: 'podcasts', kind: 'page', works: false }], []), []);
  assert.deepEqual(failedFloors([{ id: 'songs', kind: 'page', works: true }], [{ id: 'songs', ok: false }]), []);
});

test('an unchecked miss is pending, and a checked miss fails the run', () => {
  assert.equal(floorKind({ kind: 'page', works: true, checked: true }, true), 'pass');
  assert.equal(floorKind({ kind: 'page', works: true, checked: true }, false), 'fail');
  assert.equal(floorKind({ kind: 'page', works: true }, false), 'pending');
  assert.equal(floorKind({ kind: 'page', checked: true, works: false }, false), 'pending');
  assert.equal(floorKind({ kind: 'page', checked: false, works: true }, false), 'pending');
});

test('a clean pass is the only thing that marks a page, and a miss is left false', () => {
  const src = "{ id: 'meanings', works: false }\n{ id: 'letters', works: false }\n{ id: 'qr', works: false }\n";
  const marked = markWorks(src, ['meanings']);
  assert.match(marked, /id: 'meanings', works: true/);
  assert.match(marked, /id: 'letters', works: false/);
  assert.equal(markWorks(src, ['missing']), null);
  assert.equal(markWorks("{ id: 'meanings', works: true }\n", ['meanings']), null);
  const cleared = markWorks("{ id: 'podcasts', works: true }\n", [], ['podcasts']);
  assert.match(cleared, /id: 'podcasts', works: false/);
  const sites = [
    { id: 'meanings', kind: 'page', checked: true, works: true },
    { id: 'podcasts', kind: 'page', works: false },
    { id: 'units', kind: 'page', works: false, checked: true },
    { id: 'songs', kind: 'page', works: true },
    { id: 'letters', kind: 'page', works: true, checked: true },
  ];
  assert.deepEqual(pagesToRun(sites, []).map((s) => s.id), ['meanings', 'letters']);
  assert.deepEqual(pagesToRun(sites, ['podcasts', 'songs', 'meanings']).map((s) => s.id), ['meanings']);
});

test('the owner pass stays on this site, so the analytics beacon is not sent it', () => {
  const headers = { authorization: 'Bearer already' };
  const home = withOwner('https://a-to-mind.com/meanings/', 'https://a-to-mind.com', 'secret', headers);
  assert.equal(home.authorization, 'Bearer secret');
  const beacon = withOwner('https://static.cloudflareinsights.com/beacon.min.js/token', 'https://a-to-mind.com', 'secret', headers);
  assert.equal(beacon.authorization, undefined);
  assert.equal(withOwner('https://a-to-mind.com/qr/', 'https://a-to-mind.com', '', headers).authorization, undefined);
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
