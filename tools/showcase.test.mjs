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
