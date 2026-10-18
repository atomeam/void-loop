// node --test tools/haiku.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import haiku from '../void-live-deploy/skills/haiku.js';

test('haiku takes write asks and refuses look-alikes', () => {
  for (const a of ['write a haiku', 'haiku about the void', 'make a haiku about rain', 'Haiku about the moon'])
    assert.ok(haiku.match(a.toLowerCase(), a), a);
  for (const a of ['what is a haiku', 'haiku poem history', 'how to write a haiku', 'haiku wikipedia'])
    assert.ok(!haiku.match(a.toLowerCase(), a), a);
});

test('a haiku card shows three lines', () => {
  let html = '';
  const api = {
    esc: (t) => String(t),
    showPage: (fn) => fn({ set innerHTML(v) { html = v; } }),
  };
  const name = haiku.run('haiku about the void', api);
  assert.equal(name, 'haiku');
  assert.match(html, /blank stage waits/);
  assert.match(html, /Source: static templates/);
});
