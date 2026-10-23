// The fact skill: its own examples match, near misses do not, and its card says what the service said (or its built-in fact) with a source.
// Run: node --test tools/fact.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fact, { isFact } from '../void-live-deploy/skills/fact.js';

const page = () => { const el = { html: '' }; Object.defineProperty(el, 'innerHTML', { get() { return el.html; }, set(v) { el.html = v; } }); return el; };
const api = (el) => ({ showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), _pageStill: () => true });

test('fact: its examples match and its near misses do not', () => {
  for (const e of fact.examples) assert.ok(fact.match(e.toLowerCase(), e), e);
  for (const n of fact.nearMisses) assert.ok(!fact.match(n.toLowerCase(), n), n);
  assert.ok(isFact('Tell me a fact!') && !isFact('what is a fact'));
});
test('fact: the card shows the service fact, escaped, with its source', async () => {
  const was = globalThis.fetch;
  globalThis.fetch = async () => ({ json: async () => ({ text: 'Honey <never> spoils', source_url: 'https://uselessfacts.jsph.pl/x' }) });
  try { const el = page(); assert.equal(await fact.run('fun fact', api(el)), 'fact'); assert.match(el.html, /Honey &lt;never&gt; spoils/); assert.match(el.html, /Source: <a href="https:\/\/uselessfacts/); } finally { globalThis.fetch = was; }
});
test('fact: when the service does not answer, the card gives its own fact', async () => {
  const was = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('down'); };
  try { const el = page(); assert.equal(await fact.run('fun fact', api(el)), 'fact'); assert.match(el.html, /Zanzibar/); } finally { globalThis.fetch = was; }
});
