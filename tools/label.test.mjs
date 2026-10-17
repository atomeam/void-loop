// Labels and arrows (skills/label.js): the ghosting on restore asked by Void. Run: node --test tools/label.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

test('ghosting on restore (asked by Void): only the first drawing within the window after load is a restore', async () => {
  const { restoring, GHOST_WINDOW_MS } = await import('../void-live-deploy/skills/label.js');
  assert.equal(restoring(300, false), true); assert.equal(restoring(GHOST_WINDOW_MS + 1, false), false, 'labelled later in the visit: no ghost');
  assert.equal(restoring(300, true), false, 'once is enough'); assert.equal(restoring(-1, false), false);
});
