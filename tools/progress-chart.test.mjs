// node tools/progress-chart.test.mjs — the self card's week-by-week progress (lib/progress-chart.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weekly, progressHtml } from '../void-live-deploy/lib/progress-chart.js';
const now = Date.parse('2026-10-22T00:00:00Z');
const r = weekly([{ at: '2026-01-01T00:00:00Z', what: 'old: x' }, { at: '2026-10-21T00:00:00Z', what: 'ritual-template, asked' }, { at: '2026-10-20T00:00:00Z', what: 'calc: y' }], now, 4);
assert.equal(r.length, 4); assert.equal(r[3].built, 2); assert.equal(r[3].skills, 2); assert.equal(r[3].total, 3);
const h = progressHtml(r); assert.match(h, /<polyline/); assert.match(h, /2 this week, across 2 skills/); assert.ok(!/\u2026/.test(h));
const real = weekly(JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8')), now);
assert.ok(real[11].total > 100);
console.log('progress-chart: ok');
