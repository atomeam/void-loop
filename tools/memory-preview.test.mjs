// memory-preview skill (void-live-deploy/skills/memory-preview.js): one card of memory snippets - the local patterns this
// browser keeps and the records V01D keeps on its server - drawn side by side. Asked by Verse: "Implement a 'memory-preview'
// UI component to allow users to see memory snippets" (ask-20261020-2131-2). The export's own look is memory-graph's
// (tools/memory-graph.test.mjs, ask-20261021-1627-2) and questions from server memory are memory's (tools/memory.test.mjs).
// node --test tools/memory-preview.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { serverRecords, previewHtml, previewAskOf } from '../void-live-deploy/skills/memory-preview.js';
import { empty, noteAsk, noteFact } from '../void-live-deploy/lib/memory-graph.js';

const OWN = { 'a2m.void.owner.v1': 'a-test-owner-key' }; // sessionToken() needs one, or the card never reaches the server
const stub = (extra = {}) => {
  const realLS = globalThis.localStorage, realDoc = globalThis.document, realFetch = globalThis.fetch;
  const store = { ...OWN, ...extra };
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  globalThis.document = { head: { append: () => {} }, getElementById: () => ({}), createElement: () => ({ id: '', textContent: '' }) };
  return { store, done: () => { globalThis.localStorage = realLS; globalThis.document = realDoc; globalThis.fetch = realFetch; } };
};
const pageApi = () => { let html = ''; const page = { get innerHTML() { return html; }, set innerHTML(v) { html = String(v); } }; return { api: { esc: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), showPage: (build) => { build(page); return { querySelector: () => null }; }, say: () => {} }, html: () => html }; };

test('the card opens on the snippet wordings and leaves memory-graph its export look, and memory its questions', () => {
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
  assert.ok(previewAskOf('show my memory snippets'));
  assert.ok(previewAskOf('what memories do I have'));
  // "preview my memory" / "what's in my memory export" belong to memory-graph (its PREVIEW_RE): the two must never race
  assert.ok(!previewAskOf('preview my memory'));
  assert.ok(!previewAskOf("what's in my memory export"));
  assert.ok(!previewAskOf('what did I build with react'));
});

test('/api/memory?view=export answers records (the shape it really ships); items is only read as a fallback', () => {
  assert.deepEqual(serverRecords({ records: [{ id: 'a', name: 'tea' }] }), [{ id: 'a', name: 'tea' }]);
  assert.deepEqual(serverRecords({ items: [{ id: 'b' }] }), [{ id: 'b' }]);
  assert.deepEqual(serverRecords({}), []);
  assert.deepEqual(serverRecords(null), []);
  assert.deepEqual(serverRecords({ records: 'nope' }), []);
});

test('the card shows local patterns and the server records, and escapes what it shows', async () => {
  const s = stub();
  let asked = null;
  globalThis.fetch = async (u) => { asked = String(u); return { ok: true, status: 200, json: async () => ({ records: [{ id: 'a1', name: 'project <react>', kind: 'project', updated: '2026-10-19T00:00:00Z' }] }) }; };
  try {
    let g = empty();
    g = noteAsk(g, { skill: 'weather', topic: 'lisbon', at: Date.now() });
    g = noteFact(g, 'I like tea', Date.now());
    s.store['a2m.void.graph.v1'] = JSON.stringify(g);
    const P = pageApi();
    assert.equal(await skill.run('memory preview', P.api), 'memory-preview');
    const html = P.html();
    assert.match(html, /Memory preview/);
    assert.match(html, /Local patterns/);
    assert.match(html, /Server memory/);
    assert.match(html, /project &lt;react&gt;/, 'a record with a tag in it is escaped, not drawn');
    assert.match(html, /updated 2026-10-19/);
    assert.match(html, /project/, 'the record keeps its kind');
    assert.match(html, /lisbon/i, 'the local interest is on the card');
    assert.match(html, /I like tea/, 'a "you told me" line is on the card');
    assert.match(html, /a2m\.void\.graph\.v1/, 'the card says which store each half came from');
    assert.match(asked, /\/api\/memory\?view=export/);
    assert.match(html, /data-action="refresh"/, 'Refresh is on the card');
  } finally { s.done(); }
});

test('a server that refuses, or is out of reach, is said plainly and lists no record', async () => {
  const s = stub({ 'a2m.void.graph.v1': JSON.stringify(empty()) });
  try {
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    const a = pageApi(); await skill.run('memory preview', a.api);
    assert.match(a.html(), /owner/i);
    assert.match(a.html(), /Server memory/);
    assert.ok(!/project/.test(a.html()), 'a refusal lists nothing');

    globalThis.fetch = async () => { throw new Error('offline'); };
    const b = pageApi(); await skill.run('memory preview', b.api);
    assert.match(b.html(), /out of reach/i, 'a fetch that throws is a sentence, never a crash');
  } finally { s.done(); }
});

test('no key at all says who may read the server, and the card still opens', async () => {
  const s = stub({ 'a2m.void.graph.v1': JSON.stringify(empty()) });
  delete s.store['a2m.void.owner.v1'];
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return { ok: true, status: 200, json: async () => ({ records: [] }) }; };
  try {
    const P = pageApi(); await skill.run('memory preview', P.api);
    assert.match(P.html(), /Unlock Verse first/, 'the locked server is explained, not hidden');
    assert.ok(!fetched, 'without a key nothing is sent');
  } finally { s.done(); }
});

test('the markup is pure: the same stores always draw the same card', () => {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;');
  const local = { on: true, asks: 2, first: '2026-10-20', interests: [{ label: 'tea', n: 3, conf: 0.9, skill: 'recipe' }], facts: ['I like tea'] };
  assert.equal(previewHtml(esc, local, { records: [], error: null }), previewHtml(esc, local, { records: [], error: null }));
  assert.match(previewHtml(esc, { on: false, asks: 0, interests: [], facts: [] }, { records: [], error: null }), /Off\./, 'remembering off says so');
  assert.match(previewHtml(esc, { on: true, asks: 0, interests: [], facts: [] }, { records: [], error: null }), /Nothing yet/, 'an empty store says so');
});
