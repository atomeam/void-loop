// lib/toolkit.js: the tools that go together, one accent colour for all of them, and text that reads on it
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, RELATED, relatedOf, hexOf, inkOn, accent, setAccent, ACCENT_KEY } from '../void-live-deploy/lib/toolkit.js';
import fs from 'node:fs';

test('every tool page is linked to at least one other, only to tools that exist, never to itself, and the page carries the row', () => {
  for (const [p, rel] of Object.entries(RELATED)) {
    assert.ok(TOOLS[p], p); assert.ok(rel.length >= 1, p); assert.ok(!rel.includes(p), p);
    for (const r of rel) assert.ok(TOOLS[r], p + ' -> ' + r);
    const html = fs.readFileSync(new URL('../void-live-deploy' + p + 'index.html', import.meta.url), 'utf8');
    assert.match(html, /<nav id="related"/, p); assert.match(html, /mountRelated\([^,]+, '\/[a-z0-9-]+\/'/, p);
  }
  for (const p of Object.keys(TOOLS)) assert.ok(RELATED[p], p + ' has related tools');
  assert.deepEqual(relatedOf('/random-user/')[0], { href: '/wheel/', label: 'Wheel of names' }); assert.deepEqual(relatedOf('/nope/'), []);
});
test('colours: hex in any short form, and the text that reads on it', () => {
  assert.equal(hexOf('#F53'), '#ff5533'); assert.equal(hexOf('6d4aff'), '#6d4aff'); assert.equal(hexOf('red'), null); assert.equal(hexOf('#12345'), null);
  assert.equal(inkOn('#ffff00'), '#111111'); assert.equal(inkOn('#1a1a40'), '#ffffff'); assert.equal(inkOn('#6d4aff'), '#ffffff');
});
test('the accent is kept on this device and put on the page; a bad colour is refused; null takes it away', () => {
  const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const props = new Map(), root = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
  assert.equal(accent(root), null); assert.equal(setAccent('nope', root), false);
  assert.equal(setAccent('#ff0', root), true); assert.equal(mem.get(ACCENT_KEY), '#ffff00'); assert.equal(props.get('--accent'), '#ffff00'); assert.equal(props.get('--on-accent'), '#111111');
  assert.equal(accent(root), '#ffff00'); assert.equal(setAccent(null, root), true); assert.equal(accent(root), null); assert.equal(props.has('--accent'), false);
  delete globalThis.localStorage;
});
