// "what can you do" (lib/can-do.js, asked by Verse): a short answer built from skills/families.json, one ask per family that its own skill takes.
// Run: node --test tools/can-do.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canDo, canDoHtml, firstMatch, evidenceCount, asksCanDo, CAN_DO, forWords } from '../void-live-deploy/lib/can-do.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fam = { families: [
  { id: 'time', name: 'Time', for: 'timers and clocks', skills: [{ name: 'clock', tier: 'proven', why: 'a self-test, 2 browser-suite mentions, 3 real asks in the benchmark' }, { name: 'alarm', tier: 'proven', why: 'a self-test, 40 real asks in the benchmark' }, { name: 'beta', tier: 'tested', why: 'a self-test, 90 real asks in the benchmark' }] },
  { id: 'fun', name: 'Fun <b>', for: 'games: one picker', skills: [{ name: 'dice', tier: 'proven', why: 'a self-test, 9 real asks in the benchmark' }] },
  { id: 'none', name: 'Empty', for: 'x', skills: [{ name: 'ghost', tier: 'proven', why: '5 real asks in the benchmark' }] },
] };
const sk = (name, examples, re) => ({ name, examples, match: (lower) => re.test(lower) });
// routing order: "greedy" sits first and takes the alarm skill's own first example, so the card skips it
const loaded = [sk('greedy', ['set an alarm'], /^set an alarm$/), sk('alarm', ['set an alarm', 'wake me at 7'], /alarm|wake me/), sk('clock', ['make a clock'], /clock/), sk('beta', ['beta thing'], /beta/), sk('dice', ['roll a die <now>'], /roll/)];

test('can-do: one family per line, each with an ask its own skill takes first in routing order', () => {
  const f = canDo(fam, loaded);
  assert.equal(f.skills, 5);
  assert.deepEqual(f.families.map((x) => [x.id, x.skill, x.ask]), [['time', 'alarm', 'wake me at 7'], ['fun', 'dice', 'roll a die <now>'], ['none', '', '']]);
  assert.equal(f.families[0].proven, 2, 'a tested skill is never the example, however many asks it has');
  assert.equal(firstMatch(loaded, 'set an alarm'), 'greedy');
  assert.equal(firstMatch([{ name: 'bad', match() { throw new Error('x'); } }], 'a'), '');
  assert.equal(evidenceCount({ why: 'a self-test, 14 browser-suite mentions, 91 real asks in the benchmark' }), 105);
  assert.equal(forWords('games: one picker'), 'games');
});

test('can-do: the card escapes every word, links only asks that route, and says so when the list cannot be read', () => {
  const h = canDoHtml(esc, canDo(fam, loaded));
  assert.match(h, /I have 5 skills in 3 families/);
  assert.ok(h.includes('data-ask="wake me at 7" data-skill="alarm"') && h.includes('data-ask="roll a die &lt;now&gt;"') && h.includes('Fun &lt;b&gt;'));
  assert.ok(!h.includes('<now>') && !h.includes('Fun <b>'));
  assert.equal((h.match(/data-ask=/g) || []).length, 2);
  assert.match(canDoHtml(esc, canDo(null, [])), /could not read my own list/);
});

test('can-do: the asks it answers, and the page holds the same pattern', () => {
  for (const a of ['what can you do', 'What can you do?', 'what can verse do', 'what else can you do', 'what can void do for me']) assert.ok(asksCanDo(a), a);
  for (const a of ['what can i do', "what can you do now that you couldn't last week", 'what can you do that you could not before', 'what is a black hole']) assert.ok(!asksCanDo(a), a);
  const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  assert.ok(page.includes('const wantsCanDo = (lower) => ' + CAN_DO.toString() + '.test(lower);'), 'void.html wantsCanDo is lib/can-do.js CAN_DO');
});

test('can-do: on the real families.json every family has a line and the counts add up', () => {
  const real = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8'));
  const f = canDo(real, []);
  assert.equal(f.families.length, real.families.length);
  assert.equal(f.skills, Object.values(real.totals).reduce((a, b) => a + b, 0));
});
