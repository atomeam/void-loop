import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNS, MAX_AT_ONCE, select, distill, publicItems, checkpoint, asBlocks, actionableNews, dueReport, roundTrip, isDue } from '../void-live-deploy/lib/verse-runs.js';
import { blocksOf, publicBlocks } from '../void-live-deploy/lib/inbox-blocks.js';

const ev = { skills: 400, open: 'a tide chart for any harbour', floor: 'ndscalc.ru', misses: 3, news: 'Midterm data-center backlash hits' };
const sunday = new Date('2026-11-08T15:00:00Z'); // Sunday
const monday = new Date('2026-11-09T15:00:00Z');

test('fifteen runs, at most four at once, and a backlash headline is not a delivery ask', () => {
  assert.equal(RUNS.length, 15);
  assert.equal(actionableNews('Midterm data-center backlash hits'), null);
  assert.match(actionableNews('Workers AI outage: fix the free answer path'), /fix the free answer path/);
  const picked = select(RUNS, {}, sunday);
  assert.equal(picked.length, MAX_AT_ONCE);
  const again = select(RUNS, checkpoint({}, picked, sunday), sunday);
  assert.equal(again.length, MAX_AT_ONCE);
  assert.ok(again.every((r) => !picked.some((p) => p.id === r.id)));
});

test('owner runs stay off the public list, and the inbox parser drops a private block', () => {
  const rows = RUNS.map((r) => distill(r, ev));
  const pub = publicItems(rows);
  assert.ok(pub.length > 0);
  assert.equal(pub.some((r) => r.private), false);
  assert.ok(rows.find((r) => r.id === 'stamina').private);
  assert.equal(rows.find((r) => r.id === 'ai-news').skipped, 'not actionable');
  const text = asBlocks(rows, '2026-11-05');
  const kept = publicBlocks(blocksOf(text));
  assert.ok(kept.every((b) => !b.private));
  assert.deepEqual(roundTrip(text), kept.map((b) => b.ask));
  assert.equal(kept.some((b) => /stamina|eat and when to stop|weekly review/i.test(b.ask)), false);
});

test('the weekday hourly run is due on Monday, not on Sunday, and the model cap holds', () => {
  const hourly = RUNS.find((r) => r.id === 'growth-delivery');
  assert.equal(isDue(hourly, {}, monday), true);
  assert.equal(isDue(hourly, {}, sunday), false);
  const model = { id: 'model-run', every: 'daily', model: true, ask: () => 'x' };
  assert.equal(select([model], { day: '2026-11-09', calls: 20, last: {} }, monday).length, 0);
  assert.equal(dueReport(monday, ev).public.length <= MAX_AT_ONCE, true);
});

test('a pasted Growth inbox item block is read, and a private one is not', () => {
  const text = 'Growth inbox item\nstatus: open\nask: Practice one client discovery question on the handoff card\nsource: Client discovery practice\nprivate: no\n\nGrowth inbox item\nask: The owner weekly review\nprivate: yes\n';
  const rows = blocksOf(text);
  assert.equal(rows.length, 2);
  assert.equal(publicBlocks(rows).length, 1);
  assert.match(publicBlocks(rows)[0].ask, /client discovery/);
});
