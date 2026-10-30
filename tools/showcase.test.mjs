// The "look what I made" walkthrough picks what it shows (void-live-deploy/skills/showcase.js). Run: node --test tools/showcase.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { showcaseOf, playable, sinceLast, whatsNew, newestAt, lineOf, KNOWN, everythingOf, proved, hardenedLine, trayOf } from '../void-live-deploy/skills/showcase.js';

const e = (at, kind, what, extra = {}) => ({ at, by: 'claude', kind, what, ...extra });

test('the asks it answers, and the look-alikes it leaves', () => {
  for (const a of ['show me what you made', "what's new", 'whats new', 'What is new?', 'what did you make for me', 'look what you did', 'show me what you built while i was away', 'void, what’s new', "what's new pussycat", 'whats new, pussy cat?', 'Verse, what is new pussycat'])
    assert.ok(showcaseOf(a), a);
  for (const a of ["what's new in the news", 'show me what you can do', 'what did you make for dinner', 'what is new york like', 'whats new pussycat recipe', 'a pussycat'])
    assert.ok(!showcaseOf(a), a);
});

test('a step comes from the ledger line\'s try, or a known recent build; never from a quoted ask in the line', () => {
  assert.deepEqual(playable(e('2026-10-12T00:00:00Z', 'grow', 'x', { show: 'tide clocks', try: 'make a tide clock' })), { line: 'tide clocks', ask: 'make a tide clock' });
  assert.deepEqual(playable(e('2026-10-12T00:00:00Z', 'build', 'a long line about it', { try: 'make a tide clock' })).line, 'a long line about it');
  assert.equal(playable(e('2026-10-18T04:11:15Z', 'grow', 'batch 4', { show: 'a calmer ask bar; real suggestions on the empty stage', try: 'what is 15% of 240' })), null); // a line a later change undid is never previewed
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'grow', 'Routines: say "call this my morning" after a few asks')), null, 'a quoted ask that saves something is never run');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'idea', 'x', { try: 'y' })), null, 'ideas and findings are not things to show');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'grow', 'the walkthrough', { try: "what's new" })), null, 'a step is never the walkthrough itself');
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'retire', 'x', { try: 'y' })), null);
  assert.equal(playable(e('2026-10-12T00:00:00Z', 'fix', 'sticky notes look like real paper again: the font moved')).ask, 'sticky note buy milk');
});

test('since the last visit, newest first, all of them, each ask once', () => {
  const list = [e('2026-10-10T00:00:00Z', 'grow', 'old', { try: 'a' }), e('2026-10-12T00:00:00Z', 'grow', 'new', { try: 'b' }),
    e('2026-10-11T00:00:00Z', 'build', 'mid', { try: 'B' }), e('2026-10-13T00:00:00Z', 'idea', 'thought')];
  assert.deepEqual(sinceLast(list, '2026-10-10T12:00:00Z').map((x) => x.what), ['thought', 'new', 'mid']);
  assert.deepEqual(whatsNew(sinceLast(list, '2026-10-10T12:00:00Z')).steps.map((x) => x.ask), ['b'], 'the same ask twice is shown once');
  assert.equal(sinceLast(list).length, 4, 'no visit yet: everything');
  const many = Array.from({ length: 9 }, (_, i) => e('2026-10-12T0' + i + ':00:00Z', 'grow', 'w' + i, { try: 'ask ' + i }));
  assert.equal(whatsNew(sinceLast(many)).steps.length, 9, 'no ceiling: every build is counted and shown (it used to stop at five)');
  const lots = Array.from({ length: 1200 }, (_, i) => e(new Date(Date.UTC(2026, 9, 1) + i * 60000).toISOString().replace(/\.\d+Z$/, 'Z'), 'grow', 'w' + i, { try: 'ask ' + i }));
  assert.equal(whatsNew(sinceLast(lots)).steps.length, 1200, 'a thousand and more, all of them');
  assert.equal(whatsNew(sinceLast(many), { n: 3 }).steps.length, 3, 'a caller can still ask for fewer');
  assert.equal(newestAt(list), '2026-10-13T00:00:00Z');
});

test('a line is cut to what a person reads', () => {
  assert.equal(lineOf('Shop this list: the list card has Walmart buttons'), 'Shop this list');
  assert.equal(lineOf('The coral card (NOAA) reads live'), 'The coral card (NOAA) reads live');
  assert.ok(!lineOf('x '.repeat(80)).includes('\u2026')); // whole sentences, never an ellipsis (owner, 2026-10-21)
});

test('every known build in the real ledger still matches a line, and its ask is one a person would type', () => {
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  for (const k of KNOWN) {
    assert.ok(ledger.some((x) => k.match.test(x.what)), 'no ledger line for ' + k.show);
    assert.ok(k.show.length <= 70 && k.try.length <= 120 && !/^(call this|save|forget|publish|buy|delete|remove|send|clear|unlock)\b/i.test(k.try), k.try);
  }
});

test('the site never quotes the owner, in any quote marks, and drops the brackets that credit him (owner, 2026-10-20)', async () => {
  const { publicWhat } = await import('../void-live-deploy/skills/growth-tree.js');
  const { ordered } = await import('../void-live-deploy/skills/growth.js');
  const { lineOf } = await import('../void-live-deploy/skills/showcase.js');
  const assert = (await import('node:assert/strict')).default;
  assert.equal(publicWhat('a card (the owner: "make it bluer plz"): it is'), 'a card: it is');
  assert.equal(publicWhat("the self card folds repeats (owner, 2026-10-18, 'fix this': report-to-growth): one line"), 'the self card folds repeats: one line');
  assert.equal(publicWhat("Void is now Verse everywhere (owner: 'Void is now Verse rename everywhere', scope 'truly everything'); asks still work"), 'Void is now Verse everywhere; asks still work');
  assert.equal(publicWhat('Verse: the name everywhere (owner, 2026-10-18); the page says Verse'), 'Verse: the name everywhere; the page says Verse');
  assert.equal(publicWhat('the owner said: "dont do that" and it stopped'), 'the owner said and it stopped');
  assert.equal(publicWhat('the stage keeps its look (2026-10-09)'), 'the stage keeps its look (2026-10-09)');
  assert.equal(publicWhat("Verse's own card keeps Verse's words"), "Verse's own card keeps Verse's words");
  assert.ok(!ordered([{ at: '2026-10-13T00:00:00Z', kind: 'grow', what: 'x (owner: "seriosly")' }])[0].what.includes('seriosly'));
  assert.ok(!lineOf('Will made real (the owner: "seriosly"): more').includes('seriosly'));
  // the real ledger: no line the site shows still quotes him
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const left = ledger.map((e) => publicWhat(e.what)).filter((w) => /\b(?:owner|Adam|Atom)\b[^"“‘'\n:]{0,60}?:\s*(?:["“‘][^"”’]{2,}["”’]|(?<![\w])'[^'\n]{2,}'(?![\w]))/i.test(w) || /\((?:[^()]*\b(?:owner|Adam|Atom)\b)[^()]*\)/i.test(w));
  assert.deepEqual(left.slice(0, 3), []);
});

test('a build still waiting for its live check is not shown and not marked shown: it is offered the day it answers', () => {
  const L = [
    { at: '2026-10-14T10:00:00Z', kind: 'grow', what: 'Old thing: before this device first visited', try: 'old thing' },
    { at: '2026-10-15T09:00:00Z', kind: 'grow', what: 'Ready thing: answers live', try: 'ready thing' },
    { at: '2026-10-15T11:00:00Z', kind: 'grow', what: 'Fresh thing: not checked live yet', try: 'fresh thing' },
    { at: '2026-10-15T12:00:00Z', kind: 'idea', what: 'an idea line' },
  ];
  const floor = '2026-10-14T12:00:00Z';
  const first = whatsNew(sinceLast(L, floor), { verified: new Set(['ready thing']) });
  assert.deepEqual(first.steps.map((s) => s.ask), ['ready thing']); assert.deepEqual(first.waiting.map((p) => [p.ask, p.at]), [['fresh thing', '2026-10-15T11:00:00Z']]);
  // the next visit: ready thing was previewed; fresh thing answers now, so it is the one new thing
  const next = whatsNew(sinceLast(L, floor), { shown: new Set(['ready thing']), verified: new Set(['ready thing', 'fresh thing']) });
  assert.deepEqual(next.steps.map((s) => s.ask), ['fresh thing']); assert.equal(next.waiting.length, 0);
  // and after that, nothing: the floor never moves and the shown list holds both
  assert.equal(whatsNew(sinceLast(L, floor), { shown: new Set(['ready thing', 'fresh thing']), verified: new Set(['ready thing', 'fresh thing']) }).steps.length, 0);
  assert.equal(newestAt(L), '2026-10-15T12:00:00Z');
});

test('previewed once: an ask already shown is never offered again, and the recap with nothing new is the last day, not everything ever', async () => {
  const list = [e('2026-10-12T00:00:00Z', 'grow', 'a', { try: 'ask a' }), e('2026-10-12T01:00:00Z', 'grow', 'b', { try: 'ask b' }), e('2026-10-12T02:00:00Z', 'grow', 'c', { try: 'ask c' })];
  const all = sinceLast(list);
  assert.deepEqual(whatsNew(all, { shown: new Set(['ask b']) }).steps.map((x) => x.ask), ['ask c', 'ask a'], 'ask b was previewed already');
  assert.equal(whatsNew(all, { shown: new Set(['ask a', 'ask b', 'ask c']) }).steps.length, 0);
  const store = new Map(); globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const { markShown, shownSet } = await import('../void-live-deploy/skills/showcase.js');
  markShown([{ ask: 'Ask B' }, { ask: 'ask c' }]); markShown([{ ask: 'ask b' }]);
  assert.deepEqual([...shownSet()], ['ask b', 'ask c'], 'cleaned, each once');
});

test('"show me everything you made" is the whole walkthrough by name; nothing else is', () => {
  for (const a of ['show me everything you made', 'everything you have made', "walk me through all the things you've built", 'Everything Verse made so far', 'all you made for me'])
    assert.ok(everythingOf(a), a);
  for (const a of ['show me what you made', "what's new", 'everything you can do', 'show me everything', 'all the things'])
    assert.ok(!everythingOf(a), a);
});

test('a preview is proved by a new thing, a new card, or the page log saying a skill answered; the encyclopedia and a miss are not proof', () => {
  assert.ok(proved({ madeIds: ['t_1'] }));
  assert.ok(proved({ pageChanged: true }));
  assert.ok(proved({ log: { ask: 'open the book', score: 'pass', note: 'skill:guide' } }));
  assert.ok(!proved({ log: { ask: 'x', score: 'pass', note: 'article' } }), 'Wikipedia is not the thing it said it made');
  assert.ok(!proved({ pageChanged: true, log: { ask: 'x', score: 'pass', note: 'answer' } }), 'the generic answer opens a card too; the log wins');
  assert.ok(!proved({ madeIds: ['t_1'], log: { ask: 'x', score: 'fail', note: 'miss:x' } }));
  assert.ok(!proved({ log: { ask: 'x', score: 'pass', note: 'short topic' } }));
  assert.ok(!proved({ log: { ask: 'x', score: 'fail', note: 'miss' } }));
  assert.ok(!proved({ log: { ask: 'x', score: 'pass', note: '' } }));
  assert.ok(!proved({}));
  assert.ok(!proved({ madeIds: [], pageChanged: false, log: null }));
});

test('the tray (asked by Verse: grab a newly shipped skill from the walkthrough and drop it on the stage): the coming steps, at most six, each cut to fit a chip', async () => {
  const { trayOf, TRAY } = await import('../void-live-deploy/skills/showcase.js');
  const steps = Array.from({ length: 10 }, (_, k) => ({ line: 'step ' + k }));
  assert.deepEqual(trayOf(steps, 0).map((x) => x.j), [1, 2, 3, 4, 5, 6]); assert.equal(TRAY, 6);
  assert.deepEqual(trayOf(steps, 8), [{ j: 9, line: 'step 9' }]); assert.deepEqual(trayOf(steps, 9), []);
  const long = trayOf([{ line: 'x' }, { line: 'the coral card reads the Florida Keys reef live, every hour of the day' }], 0)[0].line;
  assert.ok(!long.endsWith('…'), long); // whole lines on the chips too (owner, 2026-10-21)
});
test('a drop moves the step\'s things to where it landed, kept inside the stage', async () => {
  const { dropDelta } = await import('../void-live-deploy/skills/showcase.js');
  assert.deepEqual(dropDelta({ x: 10, y: 10 }, 300, 200, 800, 600), { dx: 250, dy: 170 });
  assert.deepEqual(dropDelta({ x: 100, y: 100 }, -50, 9999, 800, 600), { dx: -92, dy: 420 }, 'clamped to the stage');
  assert.equal(dropDelta(null, 1, 1, 800, 600), null); assert.equal(dropDelta({ x: 'a', y: 0 }, 1, 1, 800, 600), null);
});

test('Verse\'s own upgrades say what got better, not "Verse hardened itself" every time (owner, 2026-10-20)', () => {
  assert.equal(hardenedLine('Verse hardened itself: 9 benchmark ask(s) for calendar-file, clock, web4'), 'Better at calendar file, clock and web4: 9 more ways of asking answered right');
  assert.equal(hardenedLine('Verse hardened itself: 9 benchmark ask(s) for habit-ring, minimap, recipe-stack, gauge-feedback'), 'Better at habit ring, minimap, recipe stack and 1 more: 9 more ways of asking answered right');
  assert.equal(hardenedLine('Verse hardened itself: 3 benchmark ask(s) for clock, and the card art floors rise to 0.61 and 0.58'), 'Better at clock: 3 more ways of asking answered right, and sharper card art');
  assert.equal(hardenedLine('Verse hardened itself: the card art floors rise to 0.61 and 0.58'), 'Sharper card art: my art scores went up');
  assert.equal(hardenedLine('sticky notes look like real paper'), null);
  assert.equal(playable({ kind: 'grow', what: 'Verse hardened itself: 9 benchmark ask(s) for calendar-file, clock, web4', try: 'export my calendar' }).line, 'Better at calendar file, clock and web4: 9 more ways of asking answered right');
  assert.equal(playable({ kind: 'grow', what: 'Verse hardened itself: 9 benchmark ask(s) for calendar-file, clock, web4', try: 'export my calendar', show: 'a chosen line' }).line, 'a chosen line', 'a line written for the person still wins');
  // the real ledger: no step and no tray chip reads "Verse hardened itself", and the chips tell the upgrades apart
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const steps = ledger.filter((e) => /^Verse hardened itself/.test(e.what || '')).map(playable).filter(Boolean);
  assert.ok(steps.length >= 5, String(steps.length));
  assert.ok(steps.every((s) => !/hardened itself/i.test(s.line)), JSON.stringify(steps.slice(0, 3)));
  const chips = trayOf([{ line: 'x' }].concat(steps), 0, 6).map((c) => c.line);
  assert.equal(new Set(chips).size, chips.length, JSON.stringify(chips));
});

// recently built stays reachable after it was previewed (owner, 2026-10-21: "still not seeing i made this anymore")
{
  const { recentOf } = await import('../void-live-deploy/skills/showcase.js');
  const now = Date.parse('2026-10-22T03:00:00Z');
  const L = [
    { at: '2026-10-21T02:00:00Z', kind: 'build', what: 'ritual', show: 'routine as events', try: 'morning routine as calendar events' },
    { at: '2026-10-01T02:00:00Z', kind: 'build', what: 'old', show: 'old thing', try: 'old thing' },
    { at: '2026-10-21T03:00:00Z', kind: 'build', what: 'unchecked', show: 'not answering', try: 'not answering yet' },
  ];
  const r = recentOf(L, new Set(['morning routine as calendar events', 'old thing']), now);
  if (!(r.length === 1 && r[0].ask === 'morning routine as calendar events')) { console.log('FAIL recentOf keeps only verified builds of the last week, seen or not', JSON.stringify(r)); process.exitCode = 1; }
  else console.log('ok recentOf: verified builds of the last week, previewed or not');
}

test("one of Verse's own upgrades reads as what got better and two new phrases, never a bare ': new phrases' list", async () => {
  const { playable, phrasesLine } = await import('../void-live-deploy/skills/showcase.js');
  const phrases = [['memory preview', 'memory-preview'], ['hide the sky', 'night-sky'], ['where is jupiter', 'sky-card'], ['is venus up', 'sky-card'], ['ritual template', 'ritual-template']].map(([ask, skill]) => ({ ask, skill }));
  const p = playable({ at: '2026-10-22T02:52:58Z', by: 'verse', kind: 'grow', what: "Verse hardened itself: 'memory preview', 'hide the sky' for memory-preview, night-sky. Why these: x.", try: 'memory preview', phrases });
  assert.equal(p.line, 'Better at memory preview, night sky, sky card and 1 more: 5 more ways of asking answered right, like “memory preview” and “hide the sky”');
  assert.equal(phrasesLine([{ ask: 'flip a coin', skill: 'coin' }]), 'Better at coin: 1 more way of asking answered right, like “flip a coin”');
  assert.equal(phrasesLine([]), '');
});
