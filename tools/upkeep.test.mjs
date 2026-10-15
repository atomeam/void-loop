// tools/upkeep.mjs pure helpers. Run: node --test tools/upkeep.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visitsByMoment, handoffDone } from './upkeep.mjs';

test('upkeep: clip visits sum by moment, ignore bad ids, biggest first', () => {
  assert.deepEqual(visitsByMoment([{ clip: '20261015-clock-mini', visits: 3 }, { clip: '20261016-clock-mini', visits: 2 }, { clip: '20261015-weather-diorama', visits: 9 }, { clip: '_stats', visits: 5 }]),
    { 'weather-diorama': 9, 'clock-mini': 5 });
});

test('upkeep: a merged branch moves from Working on to Just finished, others stay', () => {
  const md = '# H\n\n## Working on\n\n- Grok Bot · helper/x · the thing · 2026-10-15\n- Claude · deep/y · other · 2026-10-15\n\n## Just finished\n\n- **old**: done\n\n## Up for grabs\n';
  const out = handoffDone(md, 'helper/x', 'https://github.com/o/r/pull/9', '2026-10-15');
  assert.match(out, /## Just finished\n\n- \*\*the thing \(Grok Bot, 2026-10-15\)\*\*: shipped in https:\/\/github.com\/o\/r\/pull\/9\.\n- \*\*old\*\*/);
  assert.doesNotMatch(out.split('## Just finished')[0], /helper\/x/);
  assert.match(out, /deep\/y/);
  assert.equal(handoffDone(md, 'nope', 'u'), md);
});
