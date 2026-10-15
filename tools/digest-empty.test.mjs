// node --test tools/digest-empty.test.mjs: issue #766, "what did this video teach?" with no video read yet showed nothing.
// It now shows a card that says how, with a sample video to try.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/digest.js';
test('no video yet: a card, not just a whisper', async () => {
  let html = '', asked = '';
  const el = { innerHTML: '', querySelector: () => ({ addEventListener: (_, f) => f() }) };
  const api = { esc: (s) => s, say: () => {}, stage: { ask: (a) => { asked = a; } }, showPage: (f) => { f(el); html = el.innerHTML; return el; } };
  assert.ok(skill.match('what did this video teach?', 'what did this video teach?'));
  assert.equal(await skill.run('what did this video teach?', api), 'digest');
  assert.match(html, /What this video teaches/); assert.match(html, /Try a sample video/);
  assert.match(asked, /^summarize https:/);
});
