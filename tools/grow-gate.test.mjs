// node --test tools/grow-gate.test.mjs: one preview in flight at a time. grow-self.yml reads this state before it starts
// and closes the last preview on the live site before it probes anything new (owner, 2026-10-20).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPreview, previewOf, opened, closed, stateProblem, verifiedOf, openPreviews, CLEAN } from './grow-gate.mjs';

const preview = (at, tryAsk, by = 'verse', what = 'Verse hardened itself: 2 benchmark ask(s) for clock') => ({ at, by, kind: 'grow', what, try: tryAsk });

test('the newest hardening with an ask is the preview; asks are not previews and other writers are not', () => {
  const list = [
    preview('2026-10-20T10:00:00Z', 'play duel'),
    { at: '2026-10-20T11:00:00Z', by: 'verse', kind: 'grow', what: 'Verse hardened itself: art only', try: '' },
    { at: '2026-10-20T12:00:00Z', by: 'claude', kind: 'grow', what: 'Verse hardened itself: not mine', try: 'x' },
    preview('2026-10-20T09:00:00Z', 'open the book'),
  ];
  assert.equal(previewOf(list).try, 'play duel');
  assert.equal(previewOf([]), null);
  assert.equal(isPreview(list[1]), false, 'a run with no ask has no preview to close');
  assert.equal(isPreview(list[2]), false, 'only the loop itself opens a preview');
});

test('opening and closing keep the ask that was live, and a closed state needs a time', () => {
  const s = opened(null, { run: '123', at: '2026-10-20T12:00:00Z', what: 'Verse hardened itself: 2 benchmark ask(s) for clock', try: 'what time is it in tokyo' });
  assert.equal(s.status, 'open');
  assert.equal(stateProblem(s), null);
  const c = closed(s, { at: '2026-10-20T13:00:00Z', proof: 'answered live' });
  assert.equal(c.status, 'closed');
  assert.equal(c.try, 'what time is it in tokyo', 'the closed record still says what was proven');
  assert.equal(stateProblem(c), null);
  assert.match(stateProblem({ ...c, closedAt: null }), /closedAt/);
  assert.match(stateProblem({ ...s, status: 'waiting' }), /status/);
});

test('the live proof list and the labels that block a run', () => {
  const v = verifiedOf(JSON.stringify({ ok: ['  What time is it in Tokyo? ', 'play duel'] }));
  assert.ok(v.has(CLEAN('what time is it in tokyo')));
  assert.ok(v.has('play duel'));
  assert.equal(verifiedOf('not json').size, 0);

  const prs = [
    { number: 1, labels: [{ name: 'made by Verse' }] },
    { number: 2, labels: [{ name: 'automerge' }] },
    { number: 3, labels: [{ name: 'verse hardens' }] },
    { number: 4, labels: [] },
  ];
  assert.deepEqual(openPreviews(prs).map((p) => p.number), [1, 3]);
  assert.deepEqual(openPreviews(null), []);
});

test('the committed state is valid and names the preview that is waiting', () => {
  const s = JSON.parse(readFileSync(new URL('./grow-self.state.json', import.meta.url), 'utf8'));
  assert.equal(stateProblem(s), null);
  if (s.status === 'open') assert.ok(s.try, 'an open preview must carry the ask the close-out verifies');
});
