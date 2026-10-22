// node tools/progress-chart.test.mjs — the self card's week-by-week progress (lib/progress-chart.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weekly, progressHtml } from '../void-live-deploy/lib/progress-chart.js';
const now = Date.parse('2026-10-22T00:00:00Z');
const r = weekly([{ at: '2026-01-01T00:00:00Z', what: 'old: x' }, { at: '2026-10-21T00:00:00Z', what: 'ritual-template, asked' }, { at: '2026-10-20T00:00:00Z', what: 'calc: y' }], now, 4);
assert.equal(r.length, 4); assert.equal(r[3].built, 2); assert.equal(r[3].skills, 2); assert.equal(r[3].total, 3);
const h = progressHtml(r); assert.match(h, /<polyline/); assert.match(h, /2 this week\.</); assert.ok(!/\u2026/.test(h));
const real = weekly(JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8')), now);
assert.ok(real[11].total > 100);
console.log('progress-chart: ok');
import { testerHtml } from '../void-live-deploy/lib/progress-chart.js';
import { weeklyOf } from './tester-log.mjs';
const wk = weeklyOf([{ at: '2026-10-21T00:00:00Z', passed: 9, of: 10, ms: 400, failed: [{ ask: 'secret words' }] }, { at: '2026-10-20T00:00:00Z', passed: 8, of: 10, ms: 600 }], 2, now);
assert.deepEqual(wk[1], { from: wk[1].from, runs: 2, passed: 17, of: 20, ms: 600 }); assert.ok(!JSON.stringify(wk).includes('secret'));
const th = testerHtml({ weekly: [{ passed: 9, of: 10, ms: 500 }, ...wk] });
assert.match(th, /15% this week \(3 of 20, over 2 runs\)/); assert.match(th, /600 ms/);
assert.equal(testerHtml({}), '');
console.log('tester-trend: ok');
{ // a run that misses most of its checks at once is a tester or site outage: the caption says so and gives the rate without those runs (2026-10-22: 46% shown)
  const { testerHtml } = await import('../void-live-deploy/lib/progress-chart.js');
  const h = testerHtml({ weekly: [{ from: '2026-10-15', runs: 191, passed: 3151, of: 5810, broken: 95, brokenOf: 2238, brokenPassed: 22 }] });
  assert.match(h, /46% this week \(2659 of 5810, over 191 runs\)/); assert.match(h, /95 of those runs missed more than half/); assert.match(h, /without them 12% missed \(443 of 3572\)/);
}
