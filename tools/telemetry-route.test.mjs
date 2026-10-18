// The telemetry route (lib/telemetry.js, skills/telemetry-route.js): a pasted developer log is read, a question or a short line is left alone.
// node --test tools/telemetry-route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { telemetryOf, failuresOf, summaryOf, signalsOf } from '../void-live-deploy/lib/telemetry.js';
import skill from '../void-live-deploy/skills/telemetry-route.js';

const LOG = `Fixes so far:
- **Near choir:** its tap buttons broke on example asks containing quotes, so the tap ran a stub ask.
- **Rubber band:** the suite dragged before the skill was listening.
FAIL stage pack h: "what almost answered that" lists up to 3 other skills
Not fixed yet: the undo pile failed only in my long combined local run.
Committed a7de5ca and pushed; PR 1083 is a draft. 159/162 passed. The fast checks passed on the untouched branch.`;

test('a pasted CI report is read: commits, PRs, the pass count and what is failing', () => {
  const t = telemetryOf(LOG);
  assert.ok(t, 'taken'); assert.equal(t.kind, 'ci');
  assert.ok(t.shas.includes('a7de5ca')); assert.deepEqual(t.prs, ['1083']); assert.deepEqual(t.passed, { ok: 159, of: 162 });
  assert.ok(t.failures.some((f) => /stage pack h/.test(f)));
  assert.ok(summaryOf(t).some((l) => /Pull requests: #1083/.test(l)));
});

test('questions, instructions and short lines are never taken', () => {
  for (const q of ['why is my ci red', 'fix this failing test', 'what is a browser suite', 'the browser suite failed on 57ab1f2e', 'FAIL', '',
    'why does my CI keep failing when the unit tests pass locally and the browser suite is red on main after every deploy that I push to the pull request branch?'])
    assert.equal(telemetryOf(q), null, q);
  assert.equal(telemetryOf('a '.repeat(200)), null, 'long but no evidence');
});

test('failuresOf drops lines that say nothing failed, caps at six and clips long lines', () => {
  assert.deepEqual(failuresOf('no failures here at all, everything is fine today\nNothing red and no conflicts in this one'), []);
  const many = Array.from({ length: 9 }, (_, i) => 'FAIL check number ' + i + ' ' + 'x'.repeat(130)).join('\n');
  const f = failuresOf(many); assert.equal(f.length, 6); assert.ok(f.every((l) => l.length <= 110));
});

test('the skill takes its example and leaves its near misses; the card escapes what it shows', () => {
  for (const e of skill.examples) assert.equal(skill.match(e.toLowerCase(), e), true);
  for (const n of skill.nearMisses) assert.equal(skill.match(n.toLowerCase(), n), false, n);
  let html = ''; const api = { esc: (s) => String(s).replace(/</g, '&lt;'), stage: { ask() {} }, showPage: (b) => { const p = { innerHTML: '' }; b(p); html = p.innerHTML; return { addEventListener() {} }; } };
  assert.equal(skill.run(LOG.replace('stage pack h', '<b>x</b>'), api), 'telemetry-route');
  assert.ok(html.includes('&lt;b') && !html.includes('<bx'));
  assert.equal(skill.run('why is my ci red', api), 'none');
  assert.ok(signalsOf(LOG).length >= 4);
});

test('a builder\'s own report of a run is not a list of failures: narration and "red checks" as a name are left out, a real "fails on main" stays (the card of 2026-10-18)', () => {
  const report = ["I'm making it opt-in so red checks only grow on their own after the garden's test failures have been shown. ⏎ Committing the opt-in fix and running the remaining finish steps (fast checks, push, PR body). ⏎ Confirmed the merge commit 92189bd.",
    'Pushing the changes and opening the PR now. ⏎ Took Void\'s first open ask from the card and shipped it as PR #1090, labelled for automerge.',
    'Once a garden has been shown or asked for its test failures, every mount reads incidents.json and plants each failing check of the incidents it has not seen.',
    'The same check failing again becomes a weed, a rule written beside it compost. First contact plants only the newest incident, so an old stage is not flooded.',
    'Three garden browser checks pass in a real browser. The fast checks are clean apart from four reds that are not this branch\'s: book-face fails identically on main (page 304 runs off its sheet), claude-brain needs an npm package the container never installed.',
    'Commit e819d8d went red on main after the merge; the suite ran 464/465 passed.'].join('\n');
  const f = failuresOf(report);
  assert.ok(f.some((l) => /book-face fails identically/.test(l)), 'the real failure stays: ' + JSON.stringify(f));
  assert.ok(f.some((l) => /went red on main/.test(l)), 'a commit that went red stays: ' + JSON.stringify(f));
  for (const bad of [/^I'm making/, /^Committing/, /^Pushing/, /^Took Void/, /^Once a garden/, /^First contact/, /^Three garden/]) assert.ok(!f.some((l) => bad.test(l)), 'narration left out: ' + bad + ' in ' + JSON.stringify(f));
  const t = telemetryOf(report);
  assert.ok(t && t.prs.includes('1090') && t.shas.includes('92189bd'), 'still read as a report');
  assert.equal(t.failures.length, 2, 'two real ones, not six: ' + JSON.stringify(t.failures));
  assert.deepEqual(failuresOf('the error garden grows a sprout for every red check of the suite; red checks grow in it by themselves'), [], '"red checks" as a name is not a state');
  assert.deepEqual(failuresOf('verify-main is red since #411: the proposal card check FAILS on every head'), ['verify-main is red since 411: the proposal card check FAILS on every head'], 'a state line stays (clean() strips the #)');
});

test('a builder\'s own sentence behind a list marker, and a failure that passed on its own, are not still failing (2026-10-18 card)', () => {
  assert.deepEqual(failuresOf("- I didn't touch films; it failed once under load and passed on its own."), []);
  assert.deepEqual(failuresOf("1. I did not look into it; it keeps failing on main."), [], 'narration behind a number');
  assert.deepEqual(failuresOf('The suite failed on the first run and passed again on a re-run.'), []);
  assert.deepEqual(failuresOf('The check is still red on main and nobody has fixed it yet.').length, 1, 'a real one stays');
  assert.equal(failuresOf('- **book-face:** fails on plain origin/main too, page 305 off the sheet').length, 1, 'a bullet name line stays');
});
