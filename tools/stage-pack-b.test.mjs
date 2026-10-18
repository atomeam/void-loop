// node tools/stage-pack-b.test.mjs: the pure parts of the five stage skills the owner asked for on 2026-10-18 (family-gravity, deep-work,
// soundscape, stage-print, miss-jobs). Matching is tight (each skill is asked its near misses), the logic is plain functions, and nothing
// here needs a browser, a network or an audio device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import gravity, { gravityOf, familyIndex, cardsOf, stepCards, settle, SETTLED } from '../void-live-deploy/skills/family-gravity.js';
import work, { shieldOf, remaining, clock, opacityFor, DIM } from '../void-live-deploy/skills/deep-work.js';
import sound, { soundOf, reduce, START, gainOf, activeNames } from '../void-live-deploy/skills/soundscape.js';
import sheet, { printOf, textOf, sheetItems, wrap, layoutSheet, PAGE } from '../void-live-deploy/skills/stage-print.js';
import misses, { missOf, readyList, queueOne, readBoard, cardHtml } from '../void-live-deploy/skills/miss-jobs.js';
import { addOf } from '../void-live-deploy/skills/list.js';

const skills = [gravity, work, sound, sheet, misses];
test('every skill answers its examples and none of its near misses', () => {
  for (const s of skills) {
    for (const e of s.examples) assert.ok(s.match(e.toLowerCase(), e), s.name + ' should take: ' + e);
    for (const n of s.nearMisses) assert.ok(!s.match(n.toLowerCase(), n), s.name + ' must not take: ' + n);
  }
});
test('each skill refuses the examples of the others', () => {
  for (const a of skills) for (const b of skills) if (a !== b) for (const e of b.examples) assert.ok(!a.match(e.toLowerCase(), e), a.name + ' took ' + e);
});

test('family-gravity: on, off, only a kind; a word that is no kind is not taken', () => {
  assert.deepEqual(gravityOf('Turn on family gravity!'), { op: 'on' });
  assert.deepEqual(gravityOf('family gravity off'), { op: 'off' });
  assert.deepEqual(gravityOf('gravity only notes'), { op: 'only', word: 'notes' });
  assert.equal(gravityOf('gravity only matters in space'), null);
  assert.equal(gravityOf('family gravity of the moon'), null);
});
test('family-gravity: groups by family, then kind; one thing alone is left out; fewer than two moves nothing', () => {
  const idx = familyIndex({ families: [{ id: 'stage', skills: [{ name: 'sticky', tier: 'proven' }, 'notepad'] }, { id: 'time', skills: ['timer', 'clock'] }] });
  assert.equal(idx.sticky, 'stage');
  const things = { a: { id: 'a', kind: 'sticky', x: 100, y: 100 }, b: { id: 'b', kind: 'notepad', x: 900, y: 100 }, c: { id: 'c', kind: 'clock', x: 500, y: 500 } };
  const cards = cardsOf(things, idx, 1000, 1000);
  assert.deepEqual(cards.map((c) => c.id), ['a', 'b']); // clock is alone in time
  assert.deepEqual(cardsOf({ a: things.a }, idx, 1000, 1000), []);
  assert.deepEqual(cardsOf(things, idx, 1000, 1000, 'sticky'), []); // only sticky: one sticky is alone
  const two = { a: { id: 'a', kind: 'sticky', x: 100, y: 100 }, b: { id: 'b', kind: 'sticky', x: 800, y: 100 } };
  assert.equal(cardsOf(two, idx, 1000, 1000, 'sticky').length, 2);
});
test('family-gravity: the pull draws the group together, then settles and stops', () => {
  const cards = [{ id: 'a', x: 0.1, y: 0.5, family: 'f' }, { id: 'b', x: 0.9, y: 0.5, family: 'f' }, { id: 'c', x: 0.5, y: 0.1, family: 'f' }];
  const d0 = Math.hypot(cards[0].x - cards[1].x, cards[0].y - cards[1].y);
  const steps = settle(cards);
  const d1 = Math.hypot(cards[0].x - cards[1].x, cards[0].y - cards[1].y);
  assert.ok(steps > 0 && steps < 600, 'settles by itself: ' + steps);
  assert.ok(d1 < d0 * 0.7, 'closer after: ' + d0 + ' -> ' + d1);
  assert.ok(stepCards(cards) <= SETTLED, 'nothing moves after it settled');
  assert.ok(cards.every((c) => c.x >= 0.02 && c.x <= 0.94 && c.y >= 0.02 && c.y <= 0.92));
});

test('deep-work: shield asks name real kinds, with minutes; lift ends it', () => {
  assert.deepEqual(shieldOf('shield everything except the notepad for 25 minutes'), { op: 'shield', words: ['notepad'], minutes: 25 });
  assert.deepEqual(shieldOf('Shield everything except the notepad and the timer'), { op: 'shield', words: ['notepad', 'timer'], minutes: 25 });
  assert.equal(shieldOf('dim everything except notes for 500 minutes').minutes, 180);
  assert.deepEqual(shieldOf('lift the shield'), { op: 'lift' });
  assert.equal(shieldOf('shield everything except the weekend'), null);
  assert.equal(shieldOf('shield everything except the notepad and the weekend'), null);
});
test('deep-work: the countdown and the dimming', () => {
  assert.equal(remaining(10000, 4500), 6);
  assert.equal(remaining(10000, 20000), 0);
  assert.equal(clock(1449), '24:09');
  assert.equal(opacityFor('notepad', new Set(['notepad'])), 1);
  assert.equal(opacityFor('clock', new Set(['notepad'])), DIM);
  assert.equal(DIM, 0.15);
});

test('soundscape: only sound words are sounds; a list item and a bare quieter are not', () => {
  assert.deepEqual(soundOf('add soft rain'), { op: 'add', layer: 'rain', level: 0.3 });
  assert.deepEqual(soundOf('add a low drone'), { op: 'add', layer: 'drone', level: 0.5 });
  assert.equal(soundOf('add ocean waves').layer, 'waves');
  assert.equal(soundOf('add room tone').layer, 'room');
  assert.deepEqual(soundOf('only the drone'), { op: 'only', layer: 'drone' });
  assert.equal(soundOf('mute soundscape').op, 'mute');
  assert.equal(soundOf('quieter').op, 'quieter');
  for (const no of ['add milk to my list', 'add milk', 'add rain boots', 'only the lonely', 'quieter font', 'add the drone strike article']) assert.equal(soundOf(no), null, no);
  assert.equal(sound.match('quieter', 'quieter'), false, 'a bare quieter is the soundscape only while one plays');
  assert.equal(sound.match('add soft rain', 'add soft rain'), true);
});
test('soundscape: "add soft rain" no longer lands on the list; "add milk" still does', () => {
  assert.equal(addOf('add soft rain'), '');
  assert.equal(addOf('add milk'), 'milk');
  assert.equal(addOf('add milk to my list'), 'milk');
});
test('soundscape: the state follows the commands and the gains follow the state', () => {
  let s = reduce(START, soundOf('add soft rain'));
  s = reduce(s, soundOf('add a low drone'));
  assert.deepEqual(activeNames(s).sort(), ['drone', 'rain']);
  assert.ok(gainOf(s, 'rain') > 0 && gainOf(s, 'wind') === 0);
  const loud = gainOf(s, 'rain'); s = reduce(s, { op: 'quieter' });
  assert.ok(gainOf(s, 'rain') < loud);
  for (let i = 0; i < 20; i++) s = reduce(s, { op: 'quieter' });
  assert.ok(s.master >= 0.08, 'never silent by quieter alone');
  s = reduce(s, { op: 'only', layer: 'drone' }); assert.deepEqual(activeNames(s), ['drone']);
  s = reduce(s, { op: 'mute' }); assert.equal(gainOf(s, 'drone'), 0);
  s = reduce(s, { op: 'unmute' }); assert.ok(gainOf(s, 'drone') > 0);
  assert.deepEqual(activeNames(reduce(s, { op: 'stop' })), []);
  assert.deepEqual(START.layers, {}, 'the start state is never changed');
});

test('stage-print: the ask, the items by position, the text', () => {
  assert.ok(printOf('print this stage as a one-page sheet') && printOf('print the stage') && printOf('export my stage as a sheet'));
  assert.ok(!printOf('print the 3d model') && !printOf('stage fright') && !printOf('print this stage lighting plan'));
  const items = sheetItems({ a: { id: 'a', kind: 'clock', x: 600, y: 20 }, b: { id: 'b', kind: 'sticky', x: 10, y: 30, text: 'buy  bread\nand milk' }, c: { id: 'c', kind: 'list', x: 10, y: 400, title: 'Shopping', items: [{ text: 'eggs', done: true }, { text: 'tea' }] } });
  assert.deepEqual(items.map((i) => i.id), ['b', 'a', 'c']); // top row left to right, then the next
  assert.equal(items[0].text, 'buy bread and milk');
  assert.equal(items[2].title, 'Shopping');
  assert.equal(items[2].text, '[x] eggs; [ ] tea');
  assert.equal(textOf({ text: 'x'.repeat(900) }).length, 400);
  assert.deepEqual(sheetItems({}), []);
});
test('stage-print: wrapped text fits its box, and a long word is cut', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrap('one two three four', 80, measure), ['one two', 'three', 'four']);
  assert.ok(wrap('x'.repeat(50), 100, measure).every((l) => measure(l) <= 100));
  const items = Array.from({ length: 9 }, (_, i) => ({ id: 'i' + i, kind: 'sticky', title: 'Note ' + i, text: 'word '.repeat(200) }));
  const boxes = layoutSheet(items, measure);
  assert.equal(boxes.length, 9);
  assert.ok(boxes.every((b) => b.x >= 0 && b.x + b.w <= PAGE.w && b.y + b.h <= PAGE.h), 'every box is on the page');
  assert.ok(boxes.every((b) => b.lines.length * 30 + 62 <= b.h + 30), 'text is cut to the box');
  assert.deepEqual(layoutSheet([], measure), []);
});

test('miss-jobs: the ask is tight', () => {
  assert.ok(missOf("turn today's misses into jobs") && missOf('turn the misses into jobs'));
  assert.ok(!missOf('hit or miss') && !missOf('turn the lights into jobs'));
});
const NOW = Date.parse('2026-10-18T12:00:00Z'), day = '2026-10-18T10:00:00Z';
const rows = [
  { ask: 'draw a mandala', count: 5, first: '2026-10-16T10:00:00Z', last: day, fallback: 'none:x' },
  { ask: 'sing me a song', count: 3, first: '2026-10-16T10:00:00Z', last: day, fallback: '' },
  { ask: 'asdfgh qwerty', count: 9, last: day },
  { ask: 'unlock sk-abcdefghijklmnopqrstuvwx', count: 4, last: day }, // secret-scan: ok (made up, shaped like a key)
];
test('miss-jobs: the ready list is the server plan: noise and keys never become jobs, a full queue waits', () => {
  const l = readyList(rows, { items: [] }, NOW);
  assert.deepEqual(l.cards.map((c) => c.ask), ['draw a mandala', 'sing me a song']);
  assert.ok(l.cards.every((c) => c.ready) && l.cards[0].job.target === 'miss:draw-a-mandala' && /^learn to handle/.test(l.cards[0].job.ask));
  const full = readyList(rows, { items: [1, 2, 3].map((n) => ({ target: 'miss:o' + n, state: 'queued', ask: 'o' + n })) }, NOW);
  assert.equal(full.room, 0); assert.ok(full.cards.every((c) => !c.ready));
  const dup = readyList(rows, { items: [{ target: 'miss:draw-a-mandala', state: 'done', ask: 'x' }] }, NOW);
  assert.deepEqual(dup.cards.map((c) => c.ask), ['sing me a song']);
});
test('miss-jobs: without the owner key it is a dry run that reads and queues nothing', async () => {
  let calls = 0; const f = async () => { calls++; return { ok: true, json: async () => [] }; };
  assert.match((await readBoard(f, '')).why, /only the owner/);
  assert.deepEqual(await queueOne({ job: { ask: 'a', target: 'miss:a' } }, f, ''), { ok: false, why: 'only the owner can queue a job' });
  assert.equal(calls, 0);
  assert.match(cardHtml((s) => String(s), { why: 'only the owner can read the misses or queue jobs' }, null), /Dry run: only the owner/);
});
test('miss-jobs: with the key a tap posts one job with a Bearer key; the card escapes the asks', async () => {
  const seen = []; const f = async (u, o) => { seen.push([u, o]); return { ok: true }; };
  const card = readyList(rows, { items: [] }, NOW).cards[0];
  assert.deepEqual(await queueOne(card, f, 'k'), { ok: true, why: 'queued for the builder' });
  assert.equal(seen.length, 1); assert.equal(seen[0][0], '/api/queue'); assert.equal(seen[0][1].method, 'POST'); assert.equal(seen[0][1].headers.authorization, 'Bearer k');
  assert.deepEqual(JSON.parse(seen[0][1].body), { ask: card.job.ask, target: 'miss:draw-a-mandala' });
  assert.equal((await queueOne(card, async () => ({ ok: false, status: 401 }), 'k')).why, 'the queue answered HTTP 401');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = cardHtml(esc, { rows }, { open: 0, room: 3, cards: [{ ask: '<img src=x>', count: 3, ready: true }] });
  assert.ok(!html.includes('<img') && html.includes('ready to queue') && html.includes('Queue this'));
  const b = await readBoard(async (u) => (u === '/api/misses' ? { ok: true, json: async () => rows } : { ok: false }), 'k');
  assert.equal(b.rows.length, rows.length); assert.deepEqual(b.queue, { items: [] });
});
