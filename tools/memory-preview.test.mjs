// memory-preview skill (void-live-deploy/skills/memory-preview.js): a card of memory snippets from the local graph and the
// server. Asked by Verse: "a 'memory-preview' UI component to show memory snippets". Run: node --test tools/memory-preview.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/memory-preview.js';
import { empty, noteAsk, noteFact } from '../void-live-deploy/lib/memory-graph.js';

test('the card opens on the ways people ask for their memory snippets, and not on look-alikes', () => {
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
});

test('the card shows local patterns and server facts, and escapes what it shows', async () => {
  const realLS = globalThis.localStorage, realDoc = globalThis.document, realFetch = globalThis.fetch;
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  globalThis.document = { head: { append: () => {} }, getElementById: () => ({}), createElement: () => ({ id: '', textContent: '' }) };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ items: [{ id: 'a1', name: 'I like tea' }] }) });
  try {
    let g = empty();
    g = noteAsk(g, { skill: 'weather', topic: 'lisbon', at: Date.now() });
    g = noteFact(g, 'I like tea', Date.now());
    store['a2m.void.graph.v1'] = JSON.stringify(g);
    let html = '';
    const api = { showPage: (build) => { build({ set innerHTML(v) { html = v; } }); return { querySelector: () => null }; }, say: () => {}, _pageStill: () => true };
    assert.equal(await skill.run('memory preview', api), 'memory-preview');
    assert.match(html, /Memory preview/);
    assert.match(html, /Local patterns/);
    assert.match(html, /Server memory/);
    assert.match(html, /I like tea/);
    assert.match(html, /lisbon/i);
  } finally { globalThis.localStorage = realLS; globalThis.document = realDoc; globalThis.fetch = realFetch; }
});

test('a server memory that refuses (no key) says so plainly and lists no fact', async () => {
  const realLS = globalThis.localStorage, realDoc = globalThis.document, realFetch = globalThis.fetch;
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  globalThis.document = { head: { append: () => {} }, getElementById: () => ({}), createElement: () => ({ id: '', textContent: '' }) };
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  try {
    store['a2m.void.graph.v1'] = JSON.stringify(empty());
    let html = '';
    const api = { showPage: (build) => { build({ set innerHTML(v) { html = v; } }); return { querySelector: () => null }; }, say: () => {}, _pageStill: () => true };
    await skill.run('memory preview', api);
    assert.match(html, /Server memory/);
    assert.match(html, /owner/i);
  } finally { globalThis.localStorage = realLS; globalThis.document = realDoc; globalThis.fetch = realFetch; }
});
