import test from 'node:test';
import assert from 'node:assert/strict';
import { declared, movedNames, lookups, dangling, updated, ANCHOR } from './moved-check.mjs';

test('a name removed from the page and added in skills/ is moved (asked by Verse)', () => {
  const page = '--- a/void.html\n+++ b/void.html\n-  function mountCalendar(el) {\n-  const keepThis = 1;\n+  const keepThis = 2;\n';
  const skill = '+++ b/skills/calendar.js\n+export function mountCalendar(el) {\n';
  assert.deepEqual(movedNames(page, skill), ['mountCalendar']);
  assert.deepEqual(movedNames(page, '+const other = 1;'), []);
});
test('a check that finds a name in page html is a lookup', () => {
  const t = "check('x', /mountCalendar/.test(pg.html) && ok)\nconst a = html.includes('stagePlace')\nconst b = /timer/.test(said);";
  assert.deepEqual(lookups(t).map((l) => [l.line, l.name]), [[1, 'mountCalendar'], [2, 'stagePlace']]);
});
test('only a lookup for a name the page lost and another file declares dangles', () => {
  const t = "check('p', /mountCalendar/.test(pg.html) && /<div id=\"stage\"/.test(pg.html))\ncheck('q', /stillHere/.test(pg.html))";
  const page = '<div id="stage"></div> function stillHere() {}';
  const bad = dangling('t.mjs', t, page, declared('export function mountCalendar() {}'));
  assert.deepEqual(bad.map((b) => b.name), ['mountCalendar']);
  assert.equal(dangling('t.mjs', t, page, new Set()).length, 0, 'a name nothing declares is not a move');
});
test('the update points the lookup at the stage and says why', () => {
  const o = updated("check('p', /mountCalendar/.test(pg.html) && ok)", 'mountCalendar');
  assert.ok(o.includes('/' + ANCHOR + '/.test(pg.html)') && o.includes('moved-check: mountCalendar moved out of the page'));
  assert.ok(updated("html.includes('stagePlace')", 'stagePlace').includes(".includes('" + ANCHOR + "')"));
});
