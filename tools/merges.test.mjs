// The merge log (skills/merges.js, asked by Verse): GitHub's closed pull requests read into the merged ones, newest first, each saying
// how it got in; the card answers only its own asks. Run: node --test tools/merges.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { mergedOf, mergesHtml } from '../void-live-deploy/skills/merges.js';

const pr = (n, merged_at, labels, extra = {}) => ({ number: n, title: 'PR ' + n, merged_at, html_url: 'https://github.com/atomeam/void-loop/pull/' + n, labels: labels.map((name) => ({ name })), ...extra });

test('merges: merged pull requests only, newest first, with how each got in', () => {
  const rows = mergedOf([pr(1, '2026-10-16T03:00:00Z', ['automerge']), pr(2, null, ['automerge']), pr(3, '2026-10-16T04:00:00Z', ['made by Verse', 'automerge']), pr(4, '2026-10-16T02:00:00Z', []), pr(5, '2026-10-16T01:00:00Z', ['made by Verse', 'waits for owner'], { html_url: 'https://evil.example/5' })]);
  assert.deepEqual(rows.map((r) => r.number), [3, 1, 4, 5]);
  assert.equal(rows[0].how, 'made by Verse, merged itself'); assert.equal(rows[1].how, "merged itself on Verse's review"); assert.equal(rows[2].how, 'merged by hand'); assert.equal(rows[3].how, 'made by Verse, approved by the owner');
  assert.equal(rows[3].url, 'https://github.com/atomeam/void-loop/pull/5', 'only GitHub links');
  assert.equal(rows[0].at, '2026-10-16 04:00');
  assert.equal(mergedOf(Array.from({ length: 30 }, (_, i) => pr(i, '2026-10-16T00:00:' + String(i).padStart(2, '0') + 'Z', []))).length, 10);
  assert.deepEqual(mergedOf(null), []);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  assert.match(mergesHtml(esc, mergedOf([pr(9, '2026-10-16T05:00:00Z', [], { title: '<b>x</b>' })])), /#9<\/a> &lt;b&gt;x&lt;\/b&gt;/);
  assert.match(mergesHtml(esc, []), /Nothing merged lately/);
});

test('merges: the card answers its own asks and leaves the rest', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of ['what did the bot merge today', 'What merged this week?', 'show me the merge log']) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
});

test("Verse's own pull requests say what got better; a cycle that added nothing is left out", async () => {
  const { plainTitle, mergedOf: of } = await import('../void-live-deploy/skills/merges.js');
  assert.equal(plainTitle('Verse hardens itself: 9 benchmark ask(s) for fakeuser, wheel, gradient'), 'Better at fakeuser, wheel and gradient: 9 more ways of asking answered right');
  assert.equal(plainTitle('Verse hardens itself: 1 benchmark ask(s) for baseconv'), 'Better at baseconv: 1 more way of asking answered right');
  assert.equal(plainTitle('Verse hardens itself: nothing to add this cycle'), null);
  assert.equal(plainTitle('Tower: one endless queue'), 'Tower: one endless queue');
  const rows = of([{ number: 2, merged_at: '2026-10-24T15:18:00Z', title: 'Verse hardens itself: nothing to add this cycle' }, { number: 1, merged_at: '2026-10-24T15:00:00Z', title: 'Showcase' }]);
  assert.deepEqual(rows.map((r) => r.number), [1]);
});
