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
