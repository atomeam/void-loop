// One suite check for the new-year countdown. node tools/test_countdown.mjs
import assert from 'node:assert/strict';
import { countdownOf, countdownPage } from '../void-live-deploy/skills/countdown.js';

const nye = countdownOf('days until new year', new Date(2026, 9, 3));
assert.equal(nye.days, 90);
assert.equal(nye.when, '2027-01-01');
assert.match(countdownPage(nye), /90 days/);
assert.equal(countdownPage(nye).includes('/api/publish'), false);
assert.equal(countdownOf('how many days until friday', new Date(2026, 9, 3)), null);
assert.equal(countdownOf('days until new year', new Date(2026, 0, 1)).days, 0);
const examples = ['days until new year', "days until new year's day", 'how many days until the new year', 'countdown to new year', 'days until new years'];
assert.ok(examples.every((e) => countdownOf(e, new Date(2026, 9, 3))));
console.log('countdown ok');
