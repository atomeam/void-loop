// The four Verse Studio game skills: what asks open them and what asks must not (the rules have their own tests; the cards run in test_void.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import nullSweep from '../void-live-deploy/skills/null-sweep.js';
import mergeVoid from '../void-live-deploy/skills/merge-void.js';
import dimVoid from '../void-live-deploy/skills/dim-void.js';
import voidBreaker from '../void-live-deploy/skills/void-breaker.js';
import * as studio from '../void-live-deploy/lib/studio-card.js';
import { videoAskOf } from '../void-live-deploy/lib/video.js';

for (const s of [nullSweep, mergeVoid, dimVoid, voidBreaker]) {
  test(s.name + ' takes its examples and none of its near misses', () => {
    for (const e of s.examples) assert.ok(s.match(e.toLowerCase(), e), 'should match: ' + e);
    for (const n of s.nearMisses) assert.ok(!s.match(n.toLowerCase(), n), 'should not match: ' + n);
  });
  test(s.name + ' mounts a card kind and the video skill leaves its asks alone', () => {
    assert.equal(typeof Object.values(s.stageKinds)[0].mount, 'function');
    for (const e of s.examples) { const q = videoAskOf(e, { late: true }); assert.ok(!(q && q.kind === 'play'), 'video-play must not take: ' + e); }
  });
}
test('the studio frame exports what the cards use', () => {
  for (const k of ['studioCard', 'every', 'verdict']) assert.equal(typeof studio[k], 'function', k);
});
