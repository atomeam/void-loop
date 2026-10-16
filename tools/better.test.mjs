// node --test tools/better.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVoiceAsks, builtAskIds, frictionCounts, queueLagHours, parseQueueMirror, trendOf, computeBetter,
} from './better.mjs';

test('parseVoiceAsks reads current asks and small flag', () => {
  const md = `## Void's current asks\n\n- Implement WebMCP. (daily) \`ask-1\`\n- Create a probe card. *(small)* (daily) \`ask-2\`\n\n## Log\n`;
  const a = parseVoiceAsks(md);
  assert.equal(a.length, 2);
  assert.equal(a[1].small, true);
  assert.equal(a[1].id, 'ask-2');
});

test('builtAskIds finds asked ids on ledger lines', () => {
  const ids = builtAskIds([{ asked: [{ id: 'ask-1', ask: 'x' }] }, { what: 'foo asked by Void', at: '2026-10-15' }]);
  assert.ok(ids.has('ask-1'));
  assert.ok(ids.has('at:2026-10-15'));
});

test('frictionCounts counts failing and unsure', () => {
  const f = frictionCounts({ families: [{ skills: [
    { name: 'a', tier: 'proven', failing: ['x'] },
    { name: 'b', tier: 'experiment' },
    { name: 'c', tier: 'proven' },
  ] }] });
  assert.equal(f.failing, 1);
  assert.equal(f.unsure, 1);
});

test('queueLagHours returns a median', () => {
  const now = Date.parse('2026-10-16T12:00:00Z');
  const rows = [
    { state: 'queued', asked: '2026-10-16T10:00:00Z' },
    { state: 'building', asked: '2026-10-16T08:00:00Z' },
  ];
  const h = queueLagHours(rows, now);
  assert.ok(h >= 2 && h <= 4);
});

test('parseQueueMirror skips header', () => {
  const md = `| id | target | state | asked | note |\n| --- | --- | --- | --- | --- |\n| abc | will:x | queued | 2026-10-15T12:00 | note |`;
  assert.equal(parseQueueMirror(md).length, 1);
  assert.equal(parseQueueMirror(md)[0].id, 'abc');
});

test('trendOf detects better when friction drops', () => {
  const prev = { scores: { ask_throughput: 0.2, friction_total: 10, queue_lag_hours: 20, probe_yield: 0.1 } };
  const cur = { scores: { ask_throughput: 0.3, friction_total: 6, queue_lag_hours: 15, probe_yield: 0.2 } };
  assert.equal(trendOf(cur, prev), 'better');
});

test('computeBetter returns summary and small_eligible', () => {
  const voice = `## Void's current asks\n\n- Big refactor. \`ask-big\`\n- Small card. *(small)* \`ask-sm\`\n\n## Log\n`;
  const cur = computeBetter({
    voice,
    ledger: [{ kind: 'grow', at: new Date().toISOString(), what: 'x asked by Void', asked: [{ id: 'ask-sm' }] }],
    fam: { families: [{ skills: [{ name: 'a', tier: 'experiment' }] }] },
    queueMd: '',
    probeStats: { proposed: 4, passed: 1, rate: 25 },
    prev: null,
  });
  assert.ok(cur.scores);
  assert.equal(cur.trend, 'same');
  assert.ok(cur.summary);
  assert.ok(Array.isArray(cur.small_eligible));
});
