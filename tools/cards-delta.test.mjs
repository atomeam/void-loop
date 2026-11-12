// tools/cards-delta.mjs (lists run 20): the pull request's review runs the generated cards' checks, and only a card the pull request
// itself leaves stale blocks it. Run: node --test tools/cards-delta.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { staleSteps, added, STEPS, FIX } from './cards-delta.mjs';

test('the FAIL lines of a refresh check are the stale steps', () => {
  const out = 'ok    index        368 skills\nFAIL  families     status-digest has no family\nok    guide        ok\nFAIL  what         1 skill without a line\nstale: families, what (run node tools/refresh.mjs)';
  assert.deepEqual(staleSteps(out), ['families', 'what']);
  assert.deepEqual(staleSteps('ok    index\nok    first'), []);
});
test('only what this head adds counts', () => {
  assert.deepEqual(added(['families', 'map'], ['map']), ['families']);
  assert.deepEqual(added(['guide'], ['guide']), []);
  assert.deepEqual(added([], ['families']), []);
});
test('it checks the cards that follow from the skills, and names the fix for a missing family', () => {
  for (const s of ['index', 'families', 'guide', 'what']) assert.ok(STEPS.includes(s), s);
  assert.match(FIX.families, /tools\/families\.mjs/);
});
test('Verse review runs it and counts it in the verdict', () => {
  const y = readFileSync(new URL('../.github/workflows/void-review.yml', import.meta.url), 'utf8');
  assert.match(y, /node tools\/cards-delta\.mjs --base "\$BASEREF"/);
  assert.match(y, /CARDS: \$\{\{ steps\.cards\.outcome \}\}/);
  assert.match(y, /for o in [^\n]*"\$CARDS"/);
});
