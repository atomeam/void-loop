// The actions card (void-live-deploy/skills/actions.js): the owner's view of the execution record (lib/actions.js).
// Run: node --test tools/actions-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { actionsOf, tally, tallyText, lineOf, MARK } from '../void-live-deploy/skills/actions.js';

test('the card opens on the ways people ask for the record, and not on look-alikes', () => {
  for (const ask of ['my actions', 'Show my actions', 'action log', 'the execution record', 'show me the execution record', "void's actions", 'what actions did you take', 'record of your actions'])
    assert.ok(actionsOf(ask), ask);
  for (const ask of ['what did you do today', 'what did you do', 'actions speak louder than words', 'define action', 'what do you do', 'what can you do', 'class action lawsuit', 'record a voice note', ''])
    assert.equal(actionsOf(ask), null, ask);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
});

test('the tally counts each state and reads as a sentence; an empty record says so', () => {
  const rows = [{ state: 'done' }, { state: 'done' }, { state: 'failed' }, { state: 'stubbed' }, { state: 'running' }, { state: 'odd' }, null];
  assert.deepEqual(tally(rows), { done: 2, failed: 1, stubbed: 1, running: 1 });
  assert.equal(tallyText(tally(rows)), '2 done · 1 failed · 1 stubbed (nothing left Void) · 1 still running or never reported back');
  assert.match(tallyText(tally([])), /^No actions recorded yet/);
});

test('a line carries the mark, the kind and ref, and what happened: the result when done, the error when failed, the gap when still running', () => {
  const started = '2026-10-09T20:44:48.000Z';
  const done = lineOf({ state: 'done', started, kind: 'automation.note', ref: 'daily-note schedule', result: 'wrote a note' });
  assert.ok(done.startsWith(MARK.done + ' '), done); assert.match(done, /automation\.note · daily-note schedule · wrote a note$/);
  const failed = lineOf({ state: 'failed', started, kind: 'automation.github.pr', ref: 'r1 manual', result: null, error: 'GitHub said 403' });
  assert.ok(failed.startsWith(MARK.failed + ' '), failed); assert.match(failed, /GitHub said 403$/);
  const running = lineOf({ state: 'running', started, kind: 'automation.http.post', ref: null, result: null, error: null });
  assert.ok(running.startsWith(MARK.running + ' '), running); assert.match(running, /no end recorded$/); assert.ok(!/· null/.test(running));
  const long = lineOf({ state: 'done', started, kind: 'k', result: 'x'.repeat(500) });
  assert.ok(long.length < 260, 'a long result is clipped');
});
