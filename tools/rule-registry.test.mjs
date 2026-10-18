// node --test tools/rule-registry.test.mjs: the rule registry in the book (asked by Verse: "Create a 'rule-registry' view within the
// leather tome that lists all active router rules as illuminated manuscript entries"), lib/rule-registry.js, its chapter in
// lib/guide.js compose, its page in lib/tome.js, and the asks that open it (skills/guide.js guideOf).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roman, rulesOf, rulePages, ruleEntryHtml, rulesPageHtml, inkOf, PER_PAGE, RULES_ID } from '../void-live-deploy/lib/rule-registry.js';
import { pageHtml } from '../void-live-deploy/lib/tome.js';
import { guideOf, pageFor } from '../void-live-deploy/skills/guide.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('roman numerals for the rule numbers', () => {
  assert.deepEqual([1, 4, 9, 14, 40, 90, 151, 3999].map(roman), ['I', 'IV', 'IX', 'XIV', 'XL', 'XC', 'CLI', 'MMMCMXCIX']);
  assert.equal(roman(0), '0'); assert.equal(roman(-3), '-3');
});

test('rulesOf: one rule per skill in routing order, ranked from 1, catching its own first ask', () => {
  const ex = { clock: ['make a clock', 'a clock'], weird: ['', '  '], timer: [' set a timer '] };
  const r = rulesOf(['clock', 'weird', 'timer', '', null], (n) => ex[n]);
  assert.deepEqual(r, [{ rank: 1, name: 'clock', catches: 'make a clock' }, { rank: 2, name: 'weird', catches: '' }, { rank: 3, name: 'timer', catches: 'set a timer' }]);
  assert.deepEqual(rulesOf(null), []);
});

test('rulePages: PER_PAGE to a page, titled by the first and last rule in numerals', () => {
  const rules = rulesOf(Array.from({ length: 19 }, (_, i) => 's' + i));
  const pages = rulePages(rules);
  assert.equal(pages.length, Math.ceil(19 / PER_PAGE));
  assert.deepEqual(pages.map((p) => p.title), ['Rules I–VIII', 'Rules IX–XVI', 'Rules XVII–XIX']);
  assert.ok(pages.every((p) => p.kind === 'rules' && p.chapter === RULES_ID && p.rules.length <= PER_PAGE));
  assert.deepEqual(pages.flatMap((p) => p.rules), rules, 'nothing lost, nothing reordered');
});

test('an entry is illuminated (an initial on its ink), numbered, named, and every value escaped', () => {
  const h = ruleEntryHtml({ rank: 3, name: '<x>"y', catches: 'say "<b>hi</b>" & go' }, esc);
  assert.ok(!h.includes('<x>') && !h.includes('<b>hi'), 'no raw markup from the data');
  assert.match(h, /class="tome-rx-cap" style="background-color:#[0-9a-f]{6}" aria-hidden="true">X</);
  assert.match(h, /Rule III/); assert.match(h, /data-ask="say &quot;&lt;b&gt;hi&lt;\/b&gt;&quot; &amp; go"/);
  assert.match(ruleEntryHtml({ rank: 1, name: 'clock', catches: '' }, esc), /catches what its own rule says/);
  assert.notEqual(inkOf(1), inkOf(2)); assert.equal(inkOf(1), inkOf(5));
  const page = { kind: 'rules', chapter: 'rules', title: 'Rules I–II', rules: [{ rank: 1, name: 'clock', catches: 'make a clock' }, { rank: 2, name: 'timer', catches: 'set a timer' }] };
  assert.equal(pageHtml(page, { chapters: [], pages: [], totals: {} }, esc), rulesPageHtml(page, esc), 'the tome sets a rules page with the registry');
  assert.equal((rulesPageHtml(page, esc).match(/<li class="tome-rx"/g) || []).length, 2);
});

test('the book carries every active router rule, in routing order, and "rule registry" opens it there', () => {
  const book = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/guide.json', import.meta.url), 'utf8'));
  const order = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  const chap = book.chapters.find((c) => c.id === 'rules');
  assert.ok(chap, 'a Rule registry chapter'); assert.equal(chap.name, 'Rule registry');
  const rules = book.pages.filter((p) => p.kind === 'rules').flatMap((p) => p.rules);
  assert.deepEqual(rules.map((r) => r.name), order, 'one rule per skill in skills/index.json, in its order');
  assert.deepEqual(rules.map((r) => r.rank), order.map((_, i) => i + 1));
  for (const a of ['rule registry', 'rule-registry', 'show the router rules', 'list all active router rules', 'open the rule registry', 'the routing rules in the book']) assert.deepEqual(guideOf(a), { at: 'rule registry' }, a);
  for (const a of ['house rules', 'the rules of chess', 'router', 'what are the rules']) assert.equal(guideOf(a), null, a);
  assert.equal(pageFor(book, 'rule registry'), chap.from);
});
