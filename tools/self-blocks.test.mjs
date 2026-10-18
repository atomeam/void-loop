// lib/self-blocks.js: the growth velocity on the self card (asked by Void: "a 'growth-velocity' sparkline on the self card that tracks the rate of
// 'Next' items moving to 'Shipped' over the last 7 days"). The card's sections and folding are tested in tools/card-share.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { velocity, velocityLabel, velocityHtml, selfSections, selfHtml, sectionHtml, VELOCITY_DAYS, VELOCITY_EVERY } from '../void-live-deploy/lib/self-blocks.js';

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NOW = Date.parse('2026-10-18T12:00:00Z');
const asked = [{ ask: 'a', at: '2026-10-18T01:00:00Z', times: 1 }, { ask: 'b', at: '2026-10-18T23:59:00Z', times: 2 }, { ask: 'c', at: '2026-10-16T05:00:00Z', times: 1 },
  { ask: 'd', at: '2026-10-11T23:00:00Z', times: 1 }, { ask: 'e', at: 'never' }, null, { ask: 'f' }];

test('velocity: the last 7 days by the day each ask was built, today last; out-of-week, undated and junk entries count for nothing', () => {
  assert.equal(VELOCITY_DAYS, 7); assert.equal(VELOCITY_EVERY, 60e3);
  const v = velocity(asked, NOW);
  assert.deepEqual(v.days.map((d) => d.day), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.deepEqual(v.days.map((d) => d.n), [0, 0, 0, 0, 1, 0, 2]);
  assert.equal(v.total, 3); assert.equal(v.today, 2);
  assert.equal(velocityLabel(v), '3 built this week · 2 today');
  assert.deepEqual(velocity(asked, '2026-10-18T12:00:00Z').days.map((d) => d.n), [0, 0, 0, 0, 1, 0, 2], 'now may be an ISO string');
  assert.equal(velocity(asked, Date.parse('2026-10-12T00:00:00Z')).days.map((d) => d.n).join(''), '0000010', 'a week back (the 6th to the 12th), only the 11th is in');
});

test('velocity: an empty week (no list, a number, nothing recent) is seven zeros, a flat line and "nothing built this week"', () => {
  for (const a of [undefined, null, 90, [], asked.slice(3)]) { const v = velocity(a, NOW); assert.deepEqual(v.days.map((d) => d.n), [0, 0, 0, 0, 0, 0, 0]); assert.equal(v.total, 0); assert.equal(velocityLabel(v), 'nothing built this week'); }
  const html = velocityHtml(velocity([], NOW), esc);
  assert.match(html, /<polyline points="3\.0,16\.0 16\.0,16\.0 29\.0,16\.0 42\.0,16\.0 55\.0,16\.0 68\.0,16\.0 81\.0,16\.0"/, 'a flat line along the bottom');
  assert.match(html, /<span class="vs-vel-label">nothing built this week<\/span>/);
});

test('velocity: the block is the sparkline (7 points, 7 ticks, the latest a dot, scaled to the busiest day) and its label, every value escaped', () => {
  const html = velocityHtml(velocity(asked, NOW), (x) => '[' + esc(x) + ']');
  assert.match(html, /^<div class="vs-velocity" data-total="\[3\]" data-today="\[2\]" title="\[Asks of mine built each day, the last 7 days: 10-12 0, 10-13 0, 10-14 0, 10-15 0, 10-16 1, 10-17 0, 10-18 2\]"><svg class="vs-spark" width="84" height="18"/);
  assert.equal((html.match(/<line class="sp-tick"/g) || []).length, 7);
  assert.match(html, /<polyline points="3\.0,16\.0 16\.0,16\.0 29\.0,16\.0 42\.0,16\.0 55\.0,9\.0 68\.0,16\.0 81\.0,2\.0"/, 'the busiest day is the top, one build half way');
  assert.match(html, /<circle cx="81\.0" cy="2\.0" r="2"/);
  assert.match(html, /<span class="vs-vel-label">\[3 built this week · 2 today\]<\/span><\/div>$/);
});

test('velocity: the self card puts it at the top of "What got built", before the count; a card without follow-through has none', () => {
  const v = { entries: [{ kind: 'daily', at: '2026-10-18T08:00:00Z', thoughts: 'I am thin on maps.' }], asks: [], follow: { total: 73, built: 35, asked, recent: [{ ask: 'Go', what: 'a board', at: '2026-10-16T05:00:00Z', times: 1 }] } };
  const built = selfSections(v, NOW).find((s) => s.id === 'built');
  assert.deepEqual(built.blocks.slice(0, 2).map((b) => b.t), ['spark', 'count']);
  assert.equal(built.blocks[0].velocity.total, 3);
  const html = sectionHtml(built, esc);
  assert.match(html, /<summary class="vs-sum"><h3 class="vs-h">What got built <span class="vs-n">\(35 of 73 asks\)<\/span><\/h3><\/summary><div class="vs-velocity" data-total="3"[^>]*><svg class="vs-spark"[\s\S]*<\/svg><span class="vs-vel-label">3 built this week · 2 today<\/span><\/div><div class="vs-count">/);
  assert.ok(!selfHtml(selfSections({ entries: v.entries, asks: [] }, NOW), esc).includes('vs-velocity'));
  assert.equal(selfHtml(selfSections({ ...v, follow: { ...v.follow, asked: 90 } }, NOW), esc).includes('nothing built this week'), true, 'a follow without the list still draws the week, empty');
});
