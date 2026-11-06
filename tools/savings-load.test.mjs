// The site tester's savings case (issue #2296): "how much do i need to save a month to have 1 million in 30 years at 7%"
// stayed in the suite, and the load past 1200 ms was the homepage's load event while three workers each fetched every
// tool page. The savings patterns are compiled once, and the worker keeps those pages a few at a time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ASK = 'how much do i need to save a month to have 1 million in 30 years at 7%';
const mod = await import(new URL('../void-live-deploy/skills/savings.js', import.meta.url).href);
const skill = mod.default;
const { parse, grow, monthsTo, monthlyFor, res } = mod._test;

test('the monthly million ask is the savings card, and it stays a site-test case under the 1200 ms load budget', () => {
  const q = parse(ASK);
  assert.equal(q.want, 'monthly');
  assert.equal(q.goal, 1e6);
  assert.equal(q.years, 30);
  assert.equal(q.rate, 7);
  assert.ok(Math.abs(monthlyFor(0, 7, 360, 1e6) - 819.69) < 0.01);
  assert.equal(skill.match(ASK, ASK), true);
  assert.equal(skill.match('compound interest on 10000 at 5% for 10 years', 'compound interest on 10000 at 5% for 10 years'), false);
  const saved = parse('how much will i have if i save 200 a month for 20 years at 7%');
  assert.equal(saved.want, 'grow');
  assert.ok(Math.abs(grow(0, 200, 7, 240) - 104185.33) < 0.5);
  const time = parse('how long to save 50000 if i save 500 a month');
  assert.equal(time.want, 'time');
  assert.equal(monthsTo(0, 500, 0, 50000), 100);
  assert.equal(skill.match('savings calculator', 'savings calculator'), true);
  assert.equal(skill.match('invest 10k and add 300 a month for 15 years at 6%', 'invest 10k and add 300 a month for 15 years at 6%'), true);
  const suite = JSON.parse(readFileSync(new URL('./site-test.json', import.meta.url), 'utf8'));
  assert.equal(suite.limits.loadMs, 1200);
  assert.ok(suite.cases.some((c) => c.ask === ASK));
  assert.equal(res.ADD_RE instanceof RegExp, true);
});

test('matching the savings ask thousands of times stays on the compiled patterns', () => {
  const before = res.ADD_RE;
  const t0 = performance.now();
  for (let i = 0; i < 4000; i++) skill.match(ASK, ASK);
  const ms = performance.now() - t0;
  assert.equal(res.ADD_RE, before);
  assert.ok(ms < 500, '4000 matches took ' + Math.round(ms) + ' ms');
});

test('the service worker keeps tool pages a few at a time and still finishes before it activates', () => {
  const sw = readFileSync(new URL('../void-live-deploy/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const PREFETCH_AT_ONCE = 8/);
  assert.match(sw, /await keepBatched\(c, KEPT\)/);
  assert.match(sw, /await keepBatched\(c, EXTRA\)/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.doesNotMatch(sw, /Promise\.all\(KEPT\.map/);
  assert.doesNotMatch(sw, /Promise\.all\(EXTRA\.map/);
});
