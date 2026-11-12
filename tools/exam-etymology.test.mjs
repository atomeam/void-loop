// The definitions exam (lists run 19, asked by Verse 19 times: "include etymology and handle unknown terms"): an etymology ask is
// checked against Wiktionary's Etymology section, not the definition's gloss, and the unknown-word case is a word no dictionary
// has (zorbleflux became Verse's own game, so "define zorbleflux" was never an unknown term).
// Run: node --test tools/exam-etymology.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etymologyWords } from './exam.mjs';
import { judge } from '../void-live-deploy/lib/exam.js';

const extract = (t) => ({ query: { pages: { 1: { extract: t } } } });
const SALARY = '== English ==\n\n=== Etymology ===\nFrom Middle English salarie, from Anglo-Norman salarie, from Old French salaire, from Latin salārium ("wages").\n\n=== Pronunciation ===\nIPA\n\n=== Noun ===\nsalary\nFixed payment.';

test('etymology rival words come from the Etymology section, never from the definition', () => {
  const w = etymologyWords(extract(SALARY), 'salary');
  assert.ok(w.includes('middle') && w.includes('english') && w.includes('salarie'), w.join(','));
  assert.ok(!w.includes('payment') && !w.includes('fixed'));
  assert.deepEqual(etymologyWords(extract('== English ==\n=== Noun ===\nno history here'), 'x'), []);
  assert.deepEqual(etymologyWords(null, 'x'), []);
});
test('the public unknown-word case is a word nobody defines, not one of Verse\'s own skills', () => {
  const pub = JSON.parse(readFileSync(new URL('./exam-public.json', import.meta.url), 'utf8'));
  const gaps = pub.definitions.filter((a) => a.gap);
  assert.ok(gaps.length >= 1);
  for (const g of gaps) assert.notEqual(g.word, 'zorbleflux');
  assert.ok(pub.definitions.some((a) => /etymology/i.test(a.ask)), 'an etymology ask stays in the exam');
});
test('the define card\'s own not-found line passes the unknown-word check', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/define.js', import.meta.url), 'utf8');
  assert.match(src, /couldn\\'t find/);
  const r = judge('definitions', { text: 'glimbrastic I couldn\u2019t find \u201cglimbrastic\u201d in the dictionary. Check the spelling.', note: 'skill:define', ms: 300, overflow: false }, { gap: true });
  assert.equal(r.checks.rival, true); assert.equal(r.checks.skill, true);
});
