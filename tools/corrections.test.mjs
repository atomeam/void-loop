// The correction channel on the self card (asked by Void). node --test tools/corrections.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { CORRECTIONS, clean, makeCorrection, addCorrection, readCorrections, recentAnswered, wantsCorrection, skillName, chosenAnswer, mountForm } from '../void-live-deploy/lib/corrections.js';
import { STORES } from '../void-live-deploy/lib/state.js';
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };

test('the channel is the self family\'s own store, apart from the look\'s', () => {
  assert.equal(CORRECTIONS.family, 'self');
  assert.notEqual(CORRECTIONS.key, STORES.look.key);
  assert.equal(STORES.corrections.key, CORRECTIONS.key);
  assert.ok(!readFileSync(new URL('../void-live-deploy/lib/corrections.js', import.meta.url), 'utf8').includes('look.v1'), 'no path to the look state');
  const s = mem(); s.setItem(STORES.look.key, '{"stars":1}');
  addCorrection({ text: 'wrong clock', ask: 'make a clock', skill: 'skill:clock' }, s);
  assert.deepEqual(s.keys().sort(), [STORES.look.key, CORRECTIONS.key].sort());
  assert.equal(s.getItem(STORES.look.key), '{"stars":1}', 'the look is untouched');
});
test('a record is metadata only, clipped, and empty text is refused', () => {
  const c = makeCorrection({ text: '  it\u0000 was\n\nwrong ' + 'x'.repeat(500), ask: 'a'.repeat(400), skill: 'skill:Clock', wanted: 'a timer', extra: 'dropped' }, Date.parse('2026-10-17T10:00:00Z'));
  assert.deepEqual(Object.keys(c).sort(), ['ask', 'at', 'skill', 'text', 'wanted']);
  assert.equal(c.at, '2026-10-17T10:00:00.000Z'); assert.equal(c.skill, 'clock'); assert.equal(c.text.length, CORRECTIONS.textMax); assert.ok(c.text.startsWith('it was wrong')); assert.equal(c.ask.length, CORRECTIONS.askMax);
  assert.equal(makeCorrection({ text: '   ' }), null); assert.equal(makeCorrection(null), null);
  assert.equal(skillName('<script>'), ''); assert.equal(clean(null, 5), '');
});
test('corrections keep in order, are capped, and survive bad storage', () => {
  const s = mem();
  for (let i = 0; i < CORRECTIONS.max + 5; i++) assert.ok(addCorrection({ text: 'n' + i }, s, 1000 + i).ok);
  const all = readCorrections(s); assert.equal(all.length, CORRECTIONS.max); assert.equal(all.at(-1).text, 'n' + (CORRECTIONS.max + 4));
  assert.equal(addCorrection({ text: '' }, s).ok, false);
  s.setItem(CORRECTIONS.key, 'not json'); assert.deepEqual(readCorrections(s), []);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(readCorrections(bad), []); assert.equal(addCorrection({ text: 'a' }, bad).ok, false);
});
test('recent answers come from the loop log: skills only, newest first, one per ask', () => {
  const log = [{ ask: 'make a clock', note: 'skill:clock' }, { ask: 'menu', note: 'menu' }, { ask: 'make a timer', note: 'skill:timer' }, { ask: 'Make a clock', note: 'skill:clock' }, { note: 'skill:x' }];
  assert.deepEqual(recentAnswered(log), [{ ask: 'Make a clock', skill: 'clock' }, { ask: 'make a timer', skill: 'timer' }]);
  assert.deepEqual(recentAnswered(null), []);
});
test('the correction intents', () => {
  for (const q of ['tell void what it got wrong', 'void got this wrong', 'correct void on its self card', 'open your self card, I want to correct you']) assert.ok(wantsCorrection(q), q);
  for (const q of ['make my void deep blue', 'what is a clock', 'open the self card']) assert.ok(!wantsCorrection(q), q);
});

import { familyMap, groupByFamily, logHtml } from '../void-live-deploy/lib/corrections.js';
const FAM = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock' }, { name: 'timer' }] }, { id: 'words', name: 'Words', skills: [{ name: 'poem' }] }] };
test('the log groups corrections by the family of the skill that answered', () => {
  assert.equal(familyMap(FAM).get('timer').id, 'time'); assert.equal(familyMap(null).size, 0);
  const list = [{ skill: 'clock', text: 'a' }, { skill: 'poem', text: 'b' }, { skill: 'timer', text: 'c' }, { skill: 'mystery', text: 'd' }, { skill: '', text: 'e' }, { text: '' }, null];
  const g = groupByFamily(list, FAM);
  assert.deepEqual(g.map((x) => [x.id, x.items.length]), [['unplaced', 2], ['time', 2], ['words', 1]]); // biggest first, ties by name
  assert.deepEqual(g.find((x) => x.id === 'time').items.map((c) => c.text), ['c', 'a'], 'newest first');
  assert.deepEqual(groupByFamily([], FAM), []); assert.deepEqual(groupByFamily(undefined, FAM), []);
});
test('the log is empty with no number when nothing is kept, and escapes untrusted text', () => {
  const empty = logHtml([], FAM); assert.match(empty, /No corrections yet/); assert.ok(!/\d/.test(empty.replace(/<[^>]*>/g, '')), 'no invented number');
  const html = logHtml([{ skill: 'clock', ask: '<img src=x onerror=alert(1)>', text: '"><script>alert(1)</script>' }], FAM);
  assert.ok(!html.includes('<script') && !html.includes('<img'), 'escaped'); assert.match(html, /&lt;script&gt;/); assert.match(html, /Time <span[^>]*>\(1\)/);
});

test('the placeholder is not an answer: nothing is chosen and nothing is saved', () => {
  const recent = [{ ask: 'make a clock', skill: 'clock' }, { ask: 'make a timer', skill: 'timer' }];
  assert.equal(chosenAnswer(recent, ''), null); assert.equal(chosenAnswer(recent, undefined), null); assert.equal(chosenAnswer(recent, 'x'), null); assert.equal(chosenAnswer(recent, '5'), null); assert.equal(chosenAnswer(recent, '-1'), null);
  assert.equal(chosenAnswer(recent, '0').skill, 'clock'); assert.equal(chosenAnswer(recent, '1').skill, 'timer');
  const mk = () => { const n = { children: [], listeners: {}, value: '', append(...k) { this.children.push(...k); }, replaceChildren() {}, addEventListener(e, f) { this.listeners[e] = f; } }; return n; };
  const doc = { createElement: () => mk() }; const s = mem(), f = mountForm(mk(), doc, { storage: s, log: [{ ask: 'make a clock', note: 'skill:clock' }] });
  f.select.value = ''; f.box.value = 'wrong'; f.save.listeners.click();
  assert.deepEqual(readCorrections(s), [], 'placeholder selected: nothing stored');
  f.select.value = '0'; f.save.listeners.click();
  assert.equal(readCorrections(s)[0].skill, 'clock');
});
