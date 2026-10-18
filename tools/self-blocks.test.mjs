// lib/self-blocks.js: the growth velocity on the self card (asked by Void: "a 'growth-velocity' sparkline on the self card that tracks the rate of
// 'Next' items moving to 'Shipped' over the last 7 days"). The card's sections and folding are tested in tools/card-share.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { velocity, velocityLabel, velocityHtml, selfSections, selfHtml, sectionHtml, VELOCITY_DAYS, VELOCITY_EVERY, friction, frictionColors, OVERDUE_SMALL_DAYS, OVERDUE_DAYS, FRICTION_RED } from '../void-live-deploy/lib/self-blocks.js';

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

// friction (asked by Void: "a 'friction' overlay to the growth-velocity sparkline that colors segments red when an open ask exceeds its expected
// resolution time"): an open ask is overdue after OVERDUE_SMALL_DAYS (one Verse called small) or OVERDUE_DAYS; the day it crossed is red on the line
const open = [
  { ask: 'small, 3 days old', at: '2026-10-15T12:00:00Z', small: true }, // crossed its 2-day limit on the 17th
  { ask: 'small, 1 day old', at: '2026-10-17T12:00:00Z', small: true }, // due the 19th: not yet
  { ask: 'big, 8 days old', at: '2026-10-10T06:00:00Z' }, // crossed its 7-day limit on the 17th
  { ask: 'big, 30 days old', at: '2026-09-18T00:00:00Z' }, // crossed on the 25th of September: overdue, but its crossing is out of the week
  { ask: 'big, 6 days old', at: '2026-10-12T12:00:00Z' }, // due the 19th: not yet
  { ask: 'undated' }, null, 'junk',
];

test('friction: the limits are 2 days (small) and 7 days, an ask is overdue once past its limit, the day it crossed counts in the week, an old crossing is overdue but out of the week', () => {
  assert.equal(OVERDUE_SMALL_DAYS, 2); assert.equal(OVERDUE_DAYS, 7); assert.equal(FRICTION_RED, 'rgb(255,120,110)');
  const fr = friction(open, NOW);
  assert.deepEqual(fr.days.map((d) => d.day), velocity([], NOW).days.map((d) => d.day), 'the velocity\'s own seven days');
  assert.deepEqual(fr.days.map((d) => d.n), [0, 0, 0, 0, 0, 2, 0]);
  assert.deepEqual(fr.overdue.map((a) => a.ask), ['big, 30 days old', 'big, 8 days old', 'small, 3 days old'], 'oldest crossing first');
  assert.deepEqual(fr.overdue.map((a) => a.due), ['2026-09-25T00:00:00.000Z', '2026-10-17T06:00:00.000Z', '2026-10-17T12:00:00.000Z']);
  assert.equal(fr.total, 3);
  assert.deepEqual(frictionColors(fr), [null, null, null, null, FRICTION_RED, null], 'segment i joins day i to day i + 1: the 16th to the 17th is red');
  assert.equal(friction(open, '2026-10-18T12:00:00Z').total, 3, 'now may be an ISO string');
  assert.equal(friction(open, Date.parse('2026-10-16T12:00:00Z')).total, 1, 'two days earlier only the month-old ask was overdue');
  for (const a of [undefined, null, 4, [], [null, 'x', { ask: 'no date' }]]) { const f = friction(a, NOW); assert.equal(f.total, 0); assert.deepEqual(f.days.map((d) => d.n), [0, 0, 0, 0, 0, 0, 0]); assert.deepEqual(frictionColors(f), [null, null, null, null, null, null]); }
});

test('friction: on the velocity block a crossing day\'s segment is red (sp-seg, drawn over the line, the default line untouched), the label ends " · N overdue" in amber, the title says the limits and the count', () => {
  const v = velocity(asked, NOW), plain = velocityHtml(v, esc), html = velocityHtml(v, (x) => '[' + esc(x) + ']', friction(open, NOW));
  assert.ok(!plain.includes('sp-seg') && !plain.includes('overdue') && !plain.includes('data-overdue'), 'no friction given: the block is what it was');
  assert.match(html, /^<div class="vs-velocity" data-total="\[3\]" data-today="\[2\]" data-overdue="\[3\]" title="\[Asks of mine built each day, the last 7 days: [^\]]*· red: a day an open ask of mine passed its expected resolution time \(2 days for one I called small, 7 days otherwise\) · overdue now: 3\]">/);
  assert.equal((html.match(/<line class="sp-seg"/g) || []).length, 1, 'one red segment');
  assert.match(html, /<polyline points="3\.0,16\.0 16\.0,16\.0 29\.0,16\.0 42\.0,16\.0 55\.0,9\.0 68\.0,16\.0 81\.0,2\.0"[^>]*\/><line class="sp-seg" x1="55\.0" y1="9\.0" x2="68\.0" y2="16\.0" stroke="rgb\(255,120,110\)" stroke-width="1\.5" stroke-linecap="round"\/><circle/, 'the 16th to the 17th, over the line, under the dot');
  assert.match(html, /<span class="vs-vel-label">\[3 built this week · 2 today\]<span class="vs-overdue"> · \[3\] overdue<\/span><\/span><\/div>$/);
  const calm = velocityHtml(v, esc, friction([{ ask: 'fresh', at: '2026-10-18T10:00:00Z', small: true }], NOW));
  assert.ok(!calm.includes('sp-seg') && !calm.includes('vs-overdue') && / data-overdue="0" /.test(calm) && /none overdue now/.test(calm), 'nothing overdue: no red, no amber, the title says so');
});

test('friction: the self card gives the spark block the open asks\' friction, so the red reaches the card', () => {
  const v = { entries: [{ kind: 'daily', at: '2026-10-18T08:00:00Z', thoughts: 'I am thin on maps.', asks: [] }], asks: open.slice(0, 5), follow: { total: 73, built: 35, asked, recent: [] } };
  const built = selfSections(v, NOW).find((s) => s.id === 'built');
  assert.equal(built.blocks[0].friction.total, 3);
  const html = sectionHtml(built, esc);
  assert.equal((html.match(/<line class="sp-seg"/g) || []).length, 1);
  assert.match(html, /<span class="vs-overdue"> · 3 overdue<\/span>/);
  assert.ok(!selfHtml(selfSections({ ...v, asks: [] }, NOW), esc).includes('vs-overdue'), 'no open asks: no friction');
});
