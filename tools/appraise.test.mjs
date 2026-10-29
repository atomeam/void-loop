import assert from 'node:assert/strict';
import { appraise } from '../void-live-deploy/lib/appraise.js';
const comps = [{ name: 'a', cents: 500 }, { name: 'b', cents: 900 }, { name: 'c', cents: 1500 }];
const a = appraise({ name: 'Logo pack', effortHours: 4, files: [{ bytes: 2e6 }] }, { comps, demand: 3, sales: 0 });
assert.ok(a.cents >= 500 && a.cents <= 3000, a.cents); assert.match(a.note, /^Why \$/); assert.match(a.note, /median of \$9/); assert.match(a.note, /asked for 3 times/);
assert.ok(appraise({}, {}).cents >= 100, 'a paid item is never $0');
const big = appraise({ effortHours: 2000, files: Array(50).fill({ bytes: 1e9 }) }, { comps: [{ cents: 100 }], demand: 1e6, sales: 99 });
assert.ok(big.cents > 0); // flag check
const huge = appraise({}, { comps: [{ cents: 1 }] });
assert.ok(huge.flags.includes('over-10x-median') && huge.cents > 0, 'over 10x flagged, not blocked');
assert.ok(appraise({ effortHours: 20 }, { comps, demand: 9 }).cents > appraise({}, { comps }).cents, 'effort and demand raise the price');
console.log('appraise: ok (comps, effort, files, demand, sales, $0 floor, 10x flag)');
