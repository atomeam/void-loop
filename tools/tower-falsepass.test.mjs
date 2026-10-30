// Adversarial fixtures for every false pass the tower ever showed (owner's standards, 2026-10-28: "Fix bugs, never weaken tests").
// Amazon and YouTube first: each fixture is the evidence that once read as winning, and the gate must refuse it. A new false pass found
// later gets its fixture here before the fix lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FLOORS, gate, passes, aspectsOf, passingRows, tower } from '../void-live-deploy/lib/tower.js';
import { negativesOf, wallOf, zeroRivalUnread, journeyPasses, incompleteRow, isJourney } from '../void-live-deploy/lib/tower-controls.js';
import { journeysOf } from '../void-live-deploy/lib/tower-journeys.js';
import { onlySite } from './lap-items.mjs';

const shop = FLOORS.find((f) => f.id === 'shopping'), video = FLOORS.find((f) => f.id === 'video');
// the shopping rows as they stood on 2026-10-28, when the card read Amazon 11 of 13
const AMAZON = {
  speed: { verdict: 'equal-and-better', verse: 143, best: 243, evidence: 'Verse (/store/) 143 ms to the load event (median of 3, phone width) vs Amazon 243 ms to the load event (median of 3, phone width)' },
  reliability: { verdict: 'equal-and-better', verse: 3, best: 3, evidence: 'Verse (/store/) 3 of 3 loads answered vs Amazon 3 of 3 loads answered' },
  mobile: { verdict: 'equal-and-better', verse: 0, best: 0, evidence: 'Verse (/store/) 0 px sideways overflow at 390 px vs Amazon 0 px sideways overflow at 390 px' },
  accessibility: { verdict: 'equal-and-better', verse: 0, best: 0, evidence: 'Verse (/store/) 0 unnamed controls or images vs Amazon 0 unnamed controls or images' },
  offline: { verdict: 'better', verse: 1, best: 0, evidence: 'Verse (/store/) 1 vs Amazon 0' },
  sharing: { verdict: 'better', verse: 4, best: 0, evidence: 'Verse (/store/) 4 of 4 vs Amazon 0 of 4' },
  'design polish': { verdict: 'worse', verse: 31, best: 2, evidence: 'Verse (/store/) 31 design defects vs Amazon 2 design defects' },
  accuracy: { verdict: 'equal-and-better', verse: 5, best: 5, evidence: 'Verse (/store/) 5 of 5 right against the worked-out answer; judged against the standard, not Amazon (the site is not asked)' },
  catalogue: { verdict: 'equal-and-better', part: true, verse: 7, evidence: 'Verse (/store/) 7 of 7 shown for the question; judged on Verse alone, the site is not asked' },
  checkout: { verdict: 'equal-and-better', part: true, verse: 7, evidence: 'Verse (/store/) 7 of 7 shown for the question; judged on Verse alone, the site is not asked' },
  'delivery tracking': { verdict: 'equal-and-better', part: true, verse: 6, evidence: 'Verse (/store/) 6 of 6 shown for the question; judged on Verse alone, the site is not asked' },
  completeness: { verdict: 'better', verse: 23, best: 0, of: 23, evidence: 'Verse (/store/) 23 of 23 things a full answer shows vs Amazon 0 of 23 things a full answer shows (Verse lacks: none; site lacks: keyword search)' },
};

test('Amazon: the rows that read 11 of 13 do not beat the floor, and the 23-vs-0 completeness is INCOMPLETE (Amazon was behind a bot wall)', () => {
  const g = gate(shop, AMAZON);
  assert.equal(g.beaten, false);
  assert.ok(g.m > 13, 'the floor now carries its journeys');
  assert.equal(passes('completeness', AMAZON.completeness), false);
  assert.equal(zeroRivalUnread(AMAZON.completeness), true);
  for (const j of journeysOf(shop)) assert.ok(g.left.includes('journey: ' + j), j + ' is still to do');
  assert.ok(shop.farFuture && shop.defer && shop.gaps.length >= 5 && /plan|first|then/i.test(shop.plan), 'Amazon is a far-future floor with an honest gap list and plan');
  assert.ok(journeysOf(shop).length >= 6, 'shopping is judged by search, cart, checkout and the rest, not by keywords');
});

test('Amazon: keyword parts judged on Verse alone and every common aspect passing still do not beat a floor without its journeys', () => {
  const rows = Object.fromEntries(aspectsOf(shop).filter((a) => !isJourney(a)).map((a) => [a, { verdict: 'better', evidence: 'Verse 7 of 7 shown; judged on Verse alone' }]));
  assert.equal(gate(shop, rows).beaten, false);
});

test('YouTube: the video floor is not beaten, is far-future with honest gaps, and the only-site list no longer calls video replaced', () => {
  assert.equal(gate(video, {}).beaten, false); assert.ok(video.farFuture && video.gaps.length >= 5 && video.plan);
  const rows = onlySite(['video', 'video-play', 'films'], ['video.test.mjs', 'video-play.test.mjs']);
  assert.equal(rows.find((r) => r.category === 'video').status, 'partial', 'two skills and a test are not beating YouTube');
  assert.equal(onlySite(['video', 'video-play'], ['video.test.mjs'], new Set(['video'])).find((r) => r.category === 'video').status, 'replaced', 'only the tower beaten makes it replaced');
  const file = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/lap.items.json', import.meta.url), 'utf8'));
  const t = tower([], JSON.parse(fs.readFileSync(new URL('../void-live-deploy/tower.evidence.json', import.meta.url), 'utf8')).floors);
  const beaten = new Set(t.floors.filter((f) => f.state === 'beaten').map((f) => f.id));
  for (const r of file.onlySite) if (r.status === 'replaced') assert.ok((r.floors || [r.category]).every((id) => beaten.has(id)), r.category + ' is called replaced but its floor is not beaten');
});

test('blocked, skipped or not loaded is INCOMPLETE, never a pass', () => {
  assert.equal(passes('reliability', { verdict: 'incomplete', incomplete: true, evidence: 'never measured' }), false);
  assert.equal(passes('speed', { verdict: 'better', incomplete: true, evidence: 'x' }), false);
  assert.equal(incompleteRow({ verdict: 'incomplete' }), true);
  const walled = { verdict: 'better', verse: 3, best: 0, evidence: 'Verse 3 of 3 vs 0 of 3 from an ordinary phone browser (it turned the gate away)' };
  assert.equal(passes('reliability', walled), false);
  assert.equal(passes('reliability', { ...walled, siteRead: true }), true, 'a rival the gate really read and that really failed is a real loss for it');
  assert.equal(wallOf('Enter the characters you see below. Sorry, we just need to make sure you\'re not a robot.'), true);
  assert.equal(wallOf('Results for running shoes, 1-48 of over 10,000'), false);
});

test('a journey passes only with the steps it took and the negative controls it checked', () => {
  const f = FLOORS.find((x) => x.id === 'stopwatch'), a = 'journey: ' + journeysOf(f)[0];
  assert.equal(passes(a, { verdict: 'pass', evidence: 'ok' }), false, 'a bare pass is not a journey');
  assert.equal(passes(a, { verdict: 'pass', steps: ['open'], negatives: [], evidence: 'ok' }), false, 'no negative controls');
  assert.equal(passes(a, { verdict: 'better', evidence: 'route answered 200' }), false, 'a route loading is not a journey');
  assert.equal(passes(a, { verdict: 'pass', steps: ['open', 'press Start'], negatives: ['after open: no stub'], evidence: 'ok' }), true);
  assert.equal(passes(a, { verdict: 'pass', steps: ['open'], negatives: ['x'], evidence: 'ok', incomplete: true }), false);
  assert.equal(passes(a, { verdict: 'better', called: true, evidence: 'called beaten by verse on 2026-10-28: own skill' }), false, 'Verse never signs its own journeys');
  assert.equal(journeyPasses(null), false);
  assert.equal(gate(f, passingRows(f)).beaten, true, 'the fixture of a real pass still passes');
});

test('the negative controls catch a stub, a placeholder, an error page and an empty page, and leave a working page alone', () => {
  for (const t of ['Video library coming soon', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do', 'Checkout is not yet implemented, try later please ok', 'Showing mock products for now, more to follow in a while', '404 · Page not found. The page you wanted is not here.', 'Something went wrong. Please reload the page and try again.', 'ok'])
    assert.ok(negativesOf(t).length > 0, t);
  assert.deepEqual(negativesOf('Stopwatch 00:01.20 Lap 1 00:01.20 Start Stop Reset. Share a link to these laps.'), []);
});
