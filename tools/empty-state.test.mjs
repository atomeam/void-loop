// node --test tools/empty-state.test.mjs: the empty stage and the ask bar (void-live-deploy/lib/empty-state.js, wired in void.html).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SUGGESTIONS, pickSuggestion, createLinkState, offlineView, OFFLINE_PLACEHOLDER, keyboardInset, mayAutofocus, contrast, over } from '../void-live-deploy/lib/empty-state.js';

const skillsDir = path.resolve(import.meta.dirname, '../void-live-deploy/skills');
const index = JSON.parse(fs.readFileSync(path.join(skillsDir, 'index.json'), 'utf8'));
const skills = [];
for (const n of index) { const m = await import(path.join(skillsDir, n + '.js')); if (m.default && m.default.match) skills.push(m.default); }

test('every suggestion is one of its skill\'s own examples and routes to that skill, never the article fallback', () => {
  assert.ok(SUGGESTIONS.length >= 8);
  for (const { ask, skill } of SUGGESTIONS) {
    const owner = skills.find((s) => s.name === skill);
    assert.ok(owner, skill + ' exists');
    const own = (owner.examples || []).map((e) => e.toLowerCase());
    assert.ok(own.some((e) => e === ask.toLowerCase() || ask.toLowerCase().includes(e) || e.includes(ask.toLowerCase())), ask + ' is an example of ' + skill);
    const first = skills.find((s) => { try { return s.match(ask.toLowerCase(), ask); } catch (_) { return false; } });
    assert.ok(first, ask + ' routes to a skill');
    assert.equal(first.name, skill, ask + ' routes to ' + skill);
  }
});

test('the picker never repeats the last suggestion and copes with one-item and empty lists', () => {
  for (let i = 0; i < 200; i++) assert.notEqual(pickSuggestion(SUGGESTIONS, 'play othello'), 'play othello');
  assert.equal(pickSuggestion([{ ask: 'a' }, { ask: 'b' }], 'a', () => 0), 'b');
  assert.equal(pickSuggestion(['only'], 'only'), 'only');
  assert.equal(pickSuggestion([], 'x'), '');
});

test('offline state: the browser flag, or two failed same-origin requests in a row; any success or the online event clears it', () => {
  const s = createLinkState();
  assert.equal(s.offline, false);
  s.fail(); assert.equal(s.offline, false);
  s.fail(); assert.equal(s.offline, true);
  s.ok(); assert.equal(s.offline, false);
  s.setOnline(false); assert.equal(s.offline, true);
  s.fail(); s.setOnline(true); assert.equal(s.offline, false);
  assert.equal(offlineView(true).placeholder, OFFLINE_PLACEHOLDER);
  assert.equal(offlineView(true).halo, 'amber');
  assert.equal(offlineView(false).halo, null);
  assert.equal(offlineView(false).placeholder, 'Ask V01D');
});

test('keyboard inset: how much of the bottom the keyboard covers; browser-chrome wobble is not a keyboard', () => {
  assert.equal(keyboardInset(800, { height: 500, offsetTop: 0 }), 300);
  assert.equal(keyboardInset(800, { height: 450, offsetTop: 50 }), 300);
  assert.equal(keyboardInset(800, { height: 780, offsetTop: 0 }), 0);
  assert.equal(keyboardInset(800, null), 0);
});

test('autofocus: fine pointers only, never from another field or a dialog', () => {
  assert.equal(mayAutofocus({ finePointer: true, activeTag: 'BODY' }), true);
  assert.equal(mayAutofocus({ finePointer: false, activeTag: 'BODY' }), false);
  assert.equal(mayAutofocus({ finePointer: true, activeTag: 'TEXTAREA' }), false);
  assert.equal(mayAutofocus({ finePointer: true, activeTag: 'DIV', activeEditable: true }), false);
  assert.equal(mayAutofocus({ finePointer: true, activeTag: 'BODY', inDialog: true }), false);
});

test('contrast maths: white on black is 21, and a half-covered white backdrop is folded in before measuring', () => {
  assert.ok(Math.abs(contrast([255, 255, 255], [0, 0, 0]) - 21) < 0.01);
  assert.deepEqual(over([0, 0, 0], 0.5, [255, 255, 255]).map(Math.round), [128, 128, 128]);
});
