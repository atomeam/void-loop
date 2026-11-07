// The site tester closes its own items (tools/site-test-close.mjs): the title back to its ask, the recheck's verdict, the queue job for one
// that still fails. Run: node tools/site-test-close.test.mjs
import assert from 'node:assert/strict';
import { askOf, caseFor, verdicts, issueJobsOf } from './site-test-close.mjs';

// the five shapes tools/site-test.mjs writes (the two real open items of 2026-11-06 among them)
assert.deepEqual(askOf('site-test: fix: "play reversi" console: Cannot read properties of undefined (reading \'queue\')'), { kind: 'fix', ask: 'play reversi' });
assert.deepEqual(askOf('site-test: fix: "longevity trial watch" load 1233 ms > 1200'), { kind: 'fix', ask: 'longevity trial watch' });
assert.deepEqual(askOf('site-test: fix: "send it away" only "waking up" appeared, never the answer'), { kind: 'fix', ask: 'send it away' });
assert.deepEqual(askOf('site-test: teach Verse "yo calculator" (means "calculator", skill:calc): refused'), { kind: 'teach', ask: 'yo calculator' });
assert.deepEqual(askOf('site-test: quality upgrade: weakest answer was "hi" (12 chars)'), { kind: 'weak', ask: 'hi', chars: 12 });
assert.equal(askOf('Verse watchdog: main is failing'), null, 'not a site-test title');
assert.equal(askOf('site-test: fix: "a very long ask that was cut before its closing quote'), null, 'a title cut inside its ask names no whole ask');

const suite = { cases: [{ ask: 'Play Reversi', waitMs: 6000 }] };
assert.deepEqual(caseFor(suite, 'play reversi'), { ask: 'Play Reversi', waitMs: 6000 }, 'the suite\'s own case, with its wait');
assert.deepEqual(caseFor(suite, 'longevity trial watch'), { ask: 'longevity trial watch' });

const items = [{ number: 1, title: 'site-test: fix: "play reversi" console: x' }, { number: 2, title: 'site-test: fix: "longevity trial watch" load 1233 ms > 1200' },
  { number: 3, title: 'site-test: quality upgrade: weakest answer was "hi" (12 chars)' }, { number: 4, title: 'site-test: fix: "not asked" nothing appeared' }, { number: 5, title: 'odd' }];
const v = verdicts(items, [{ ask: 'Play Reversi', ok: true, loadMs: 300 }, { ask: 'longevity trial watch', ok: false, why: ['load 1500 ms > 1200'] }, { ask: 'hi', ok: true, chars: 30 }]);
assert.deepEqual(v.map((x) => x.close), [true, false, true, false, false], 'only a pass (or a grown weak answer) closes');
assert.match(v[0].why, /passed on the live site \(home page load 300 ms\)/);
assert.match(v[1].why, /still fails: load 1500 ms/);
assert.equal(verdicts([items[2]], [{ ask: 'hi', ok: true, chars: 20 }])[0].close, false, 'a weak answer closes only past twice its old length');

const now = Date.parse('2026-11-06T16:00:00Z');
const jobs = issueJobsOf([{ number: 2387, title: items[0].title, created_at: '2026-11-06T06:13:02Z' }, { number: 9, title: items[1].title, created_at: '2026-11-06T15:30:00Z' },
  { number: 8, title: 'Verse loop paused', created_at: '2026-11-01T00:00:00Z' }, { number: 7, title: items[0].title, created_at: '2026-11-01T00:00:00Z', pull_request: {} },
  { number: 6, title: items[0].title, created_at: '2026-11-01T00:00:00Z' }], ['issue:6'], now);
assert.deepEqual(jobs.map((j) => j.target), ['issue:2387'], 'one job per old open site-test issue, never twice, never a PR, a fresh item, or another kind of issue');
assert.match(jobs[0].ask, /^Fix site-test issue #2387 on live a-to-mind\.com/);
assert.ok(jobs[0].ask.length <= 200);
console.log('site-test-close: all checks passed');
