// The contextual shortcut (asked by Verse): node --test tools/shortcut.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { suggestionsFor } from '../void-live-deploy/skills/shortcut.js';

test('the asks reach it, the look-alikes do not', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
test('dinner time suggests food, late night suggests winding down, commute hours a ride; one is always there', () => {
  assert.equal(suggestionsFor(18)[0].ask, 'food and rides'); assert.match(suggestionsFor(18)[0].line, /dinner/);
  assert.equal(suggestionsFor(12)[0].ask, 'food and rides'); assert.match(suggestionsFor(12)[0].line, /lunch/);
  assert.match(suggestionsFor(23)[0].ask, /sleep/); assert.equal(suggestionsFor(2)[1].ask, 'box breathing');
  assert.ok(suggestionsFor(8).some((s) => /ride/.test(s.ask)));
  for (let h = 0; h < 24; h++) assert.ok(suggestionsFor(h).length >= 2, 'hour ' + h);
  assert.equal(suggestionsFor(-1)[0].family, suggestionsFor(23)[0].family);
});
test('every suggestion is an ask other skills already answer, so the button leads somewhere', async () => {
  const names = ['rides', 'recipe', 'sleep', 'breath', 'timer', 'calendar'];
  const mods = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await import('../void-live-deploy/skills/' + n + '.js')).default])));
  const asks = [...new Set([...Array(24).keys()].flatMap((h) => suggestionsFor(h).map((s) => s.ask)))];
  for (const a of asks) assert.ok(Object.values(mods).some((m) => m.match(a.toLowerCase(), a)), 'nothing answers: ' + a);
});
