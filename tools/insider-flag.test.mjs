// The insider flag (docs/WIDER-USE.md point 11): a page that only makes sense to one scene's fans is flagged; a plain lead, an any-topic
// framing or an everyday example clears it. Pure; one pass over the site's own HTML (no browser, no network).
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { insiderFlags, htmlFacts, allPages, SKIP } from './insider-flag.mjs';

test('(a) jargon or a franchise name before the plain job in the first 15 words is flagged; the job first, or any-topic framing, is not', () => {
  assert.equal(insiderFlags({ text: 'FNCS scrim tracker for your squad' }).flagged, true);
  assert.equal(insiderFlags({ text: 'Kanban board with WIP limits' }).reasons[0].code, 'a');
  assert.equal(insiderFlags({ text: 'Track tasks on a board; Kanban columns and WIP limits for experts' }).flagged, false, 'the job comes first');
  assert.equal(insiderFlags({ text: 'Fortnite scores for any game or sport' }).flagged, false, 'any-topic framing opens it');
  assert.equal(insiderFlags({ text: 'Verse Back Make a PDF smaller' }).flagged, false, 'site name and nav words are skipped, known acronyms pass');
});
test('(b) two scene words on plain counting are flagged unless framed for anyone', () => {
  assert.equal(insiderFlags({ text: 'Points table', labels: 'Eliminations | Placement points' }).reasons.map((r) => r.code).join(), 'b');
  assert.equal(insiderFlags({ text: 'Points table', labels: 'Kills | Kill' }).flagged, false, 'one word, plural or not, is not two');
  assert.equal(insiderFlags({ text: 'Points table for any sport', labels: 'Eliminations | Placement points' }).flagged, false);
});
test('(c) an insider default with no everyday example is flagged; a preset or an example clears it', () => {
  assert.equal(insiderFlags({ text: 'Make a list', defaults: 'Tilted Towers' }).reasons[0].code, 'c');
  assert.equal(insiderFlags({ text: 'Make a list', defaults: 'Tilted Towers', examples: 1 }).flagged, false);
  assert.equal(insiderFlags({ text: 'Make a list', defaults: 'Tilted Towers', labels: 'Try an everyday example' }).flagged, false);
});
test('htmlFacts reads what a page shows without scripts, styles or nav links; every page is walked and /tournaments/ is skipped', () => {
  const f = htmlFacts('<body><nav><a href="/">Home</a></nav><h1>Kanban</h1><script>x="BPM"</script><label>Tick</label><input placeholder="sage" value="hp"><button data-preset>Try</button></body>');
  assert.match(f.text, /^Kanban/); assert.doesNotMatch(f.text, /BPM|Home/); assert.match(f.labels, /Tick/); assert.match(f.defaults, /sage/); assert.match(f.defaults, /hp/); assert.ok(f.examples >= 1);
  const pages = allPages(); assert.ok(pages.length > 50); assert.ok(SKIP.includes('/tournaments/')); assert.ok(!pages.filter((p) => !SKIP.includes(p.path)).some((p) => p.path === '/tournaments/'));
});
