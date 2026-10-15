// The "look what I made" walkthrough picks what it shows (void-live-deploy/skills/showcase.js). Run: node --test tools/showcase.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { showcaseOf, playable, sinceLast, pick, newestAt, lineOf, KNOWN } from '../void-live-deploy/skills/showcase.js';

const e = (at, kind, what, extra = {}) => ({ at, by: 'claude', kind, what, ...extra });

test('the asks it answers, and the look-alikes it leaves', () => {
  for (const a of ['show me what you made', "what's new", 'What is new?', 'what did you make for me', 'look what you did', 'show me what you built while i was away', 'void, what’s new'])
    assert.ok(showcaseOf(a), a);
  for (const a of ["what's new in the news", 'show me what you can do', 'what did you make for dinner', 'what is new york like'])
    assert.ok(!showcaseOf(a), a);
});

test('a step comes from the ledger line\'s try, or a known recent build; never from a quoted ask in the line', () => {
  assert.deepEqual(playable(e('2026-10-12T00:00:00Z', 'grow', 'x', { show: 'tide clocks', try: 'make a tide clock' })), { line: 'tide clocks', ask: 'make a tide clock' });
  assert.deepEqual(playable(e('2026-10-12T00:00:00Z', 'build', 'a long line about it', { try: 'make a tide clock' })).line, 'a long line about it');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'grow', 'Routines: say "call this my morning" after a few asks')), null, 'a quoted ask that saves something is never run');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'idea', 'x', { try: 'y' })), null, 'ideas and findings are not things to show');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'grow', 'the walkthrough', { try: "what's new" })), null, 'a step is never the walkthrough itself');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'retire', 'x', { try: 'y' })), null);
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'fix', 'sticky notes look like real paper again: the font moved')).ask, 'sticky note buy milk');
});

test('since the last visit, newest first; up to five, each ask once', () => {
  const list = [e('2026-10-10T00:00:00Z', 'grow', 'old', { try: 'a' }), e('2026-10-12T00:00:00Z', 'grow', 'new', { try: 'b' }),
    e('2026-10-11T00:00:00Z', 'build', 'mid', { try: 'B' }), e('2026-10-13T00:00:00Z', 'idea', 'thought')];
  assert.deepEqual(sinceLast(list, '2026-10-10T12:00:00Z').map((x) => x.what), ['thought', 'new', 'mid']);
  assert.deepEqual(pick(sinceLast(list, '2026-10-10T12:00:00Z')).map((x) => x.ask), ['b'], 'the same ask twice is shown once');
  assert.equal(sinceLast(list).length, 4, 'no visit yet: everything');
  const many = Array.from({ length: 9 }, (_, i) => e('2026-10-12T0' + i + ':00:00Z', 'grow', 'w' + i, { try: 'ask ' + i }));
  assert.equal(pick(sinceLast(many)).length, 5);
  assert.equal(newestAt(list), '2026-10-13T00:00:00Z');
});

test('a line is cut to what a person reads', () => {
  assert.equal(lineOf('Shop this list: the list card has Walmart buttons'), 'Shop this list');
  assert.equal(lineOf('The coral card (NOAA) reads live'), 'The coral card (NOAA) reads live');
  assert.ok(lineOf('x '.repeat(80)).length <= 90);
});

test('every known build in the real ledger still matches a line, and its ask is one a person would type', () => {
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  for (const k of KNOWN) {
    assert.ok(ledger.some((x) => k.match.test(x.what)), 'no ledger line for ' + k.show);
    assert.ok(k.show.length <= 70 && k.try.length <= 120 && !/^(call this|save|forget|publish|buy|delete|remove|send|clear|unlock)\b/i.test(k.try), k.try);
  }
});

test('the site shows the owner\'s words as he meant them, spelled right; a quote with no corrected form keeps only the credit (owner, 2026-10-13)', async () => {
  const { publicWhat, OWNER_WORDS } = await import('../void-live-deploy/skills/growth-tree.js');
  const { ordered } = await import('../void-live-deploy/skills/growth.js');
  const { lineOf } = await import('../void-live-deploy/skills/showcase.js');
  const assert = (await import('node:assert/strict')).default;
  const typo = Object.keys(OWNER_WORDS).find((k) => /Theatre/.test(k));
  assert.equal(publicWhat('Void\'s will made real (owner: "' + typo + '"): Void hears'), 'Void\'s will made real (owner: "if it is theatre, it needs to be seriously worked on until Void\'s will is more real"): Void hears');
  assert.equal(publicWhat('a card (the owner: "make it bluer plz"): it is'), 'a card (the owner): it is');
  assert.equal(publicWhat('the stage keeps its look (2026-10-09)'), 'the stage keeps its look (2026-10-09)');
  for (const bad of Object.keys(OWNER_WORDS)) {
    assert.ok(!ordered([{ at: '2026-10-13T00:00:00Z', kind: 'grow', what: 'x (owner: "' + bad + '")' }])[0].what.includes(bad));
    assert.ok(!lineOf('Will made real (the owner: "' + bad + '"): more').includes(bad));
  }
});

test('a build still waiting for its live check is held back, not marked seen unshown (2026-10-15: "while you were away" went quiet)', async () => {
  const { seenUpTo } = await import('../void-live-deploy/skills/showcase.js');
  const L = [
    { at: '2026-10-14T10:00:00Z', kind: 'grow', what: 'Old thing: shown already', try: 'old thing' },
    { at: '2026-10-15T09:00:00Z', kind: 'grow', what: 'Ready thing: answers live', try: 'ready thing' },
    { at: '2026-10-15T11:00:00Z', kind: 'grow', what: 'Fresh thing: not checked live yet', try: 'fresh thing' },
    { at: '2026-10-15T12:00:00Z', kind: 'idea', what: 'an idea line' },
  ];
  const seen = '2026-10-14T12:00:00Z';
  // the fresh build is not verified yet: it is pending, and seen stops just before it
  const pending = [], steps = pick(sinceLast(L, seen), 5, new Set(['ready thing']), pending);
  assert.deepEqual(steps.map((s) => s.ask), ['ready thing']);
  assert.deepEqual(pending.map((p) => [p.ask, p.at]), [['fresh thing', '2026-10-15T11:00:00Z']]);
  assert.equal(seenUpTo(L, seen, pending), '2026-10-15T09:00:00Z');
  // nothing ready at all: seen does not move, so the fresh build is offered once it is checked
  const p2 = [], s2 = pick(sinceLast(L, seen), 5, new Set(), p2);
  assert.equal(s2.length, 0);
  assert.equal(seenUpTo(L, seen, p2), seen);
  // the next visit, after the live check passed: the fresh build is offered
  const s3 = pick(sinceLast(L, seenUpTo(L, seen, p2)), 5, new Set(['ready thing', 'fresh thing']));
  assert.deepEqual(s3.map((s) => s.ask), ['fresh thing', 'ready thing']);
  // nothing pending: seen goes to the newest line, as before
  assert.equal(seenUpTo(L, seen, []), newestAt(L));
});
