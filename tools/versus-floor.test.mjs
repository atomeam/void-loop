import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plainVerdict, rowsFromMeasures, isFloor, rankSites, verdictsChanged, viewModel, modelFrom, visitorHtml, ownerHtml, gapText, TOOLS, NEXT, SITES } from '../void-live-deploy/lib/versus-floor.js';

const full = { speed: 100, reliability: 3, mobile: 0, a11y: 0, offline: 1 };
const slow = { speed: 400, reliability: 3, mobile: 12, a11y: 2, offline: 0 };

test('a verdict is better, equal, or worse, and a missing number is not a verdict', () => {
  assert.equal(plainVerdict(100, 400, false), 'better');
  assert.equal(plainVerdict(400, 100, false), 'worse');
  assert.equal(plainVerdict(3, 3, true), 'equal');
  assert.equal(plainVerdict(1, NaN, true), null);
});

test('rows need a real reading of the other page', () => {
  assert.equal(rowsFromMeasures(full, { ...slow, reliability: 0 }), null);
  const rows = rowsFromMeasures(full, slow);
  assert.equal(rows.speed.verdict, 'better');
  assert.equal(rows.mobile.verdict, 'better');
  assert.equal(rows.offline.verdict, 'better');
});

test('a page that works is a floor, and a worse measurement does not take it away', () => {
  const rows = rowsFromMeasures(full, full);
  assert.equal(isFloor(TOOLS[0]), false);
  assert.equal(isFloor(TOOLS[1]), false);
  assert.equal(isFloor(TOOLS[2]), false);
  assert.equal(isFloor(NEXT[0]), true);
  assert.equal(isFloor({ kind: 'page', page: '/x/', works: true }, rows), true);
  assert.equal(isFloor({ kind: 'page', page: '/x/', works: false }, rows), false);
  assert.equal(isFloor({ kind: 'card', page: '/x/', works: true }, rows), false);
  assert.equal(isFloor({ kind: 'page', page: '/x/', works: true }, rowsFromMeasures(slow, full)), true);
  assert.equal(NEXT.every((s) => isFloor(s)), false);
});

test('the next site is the one whose features match the gap notes, not the biggest', () => {
  const sites = [
    { id: 'big', features: ['catalogue'], rank: 1 },
    { id: 'small', features: ['letter shift'], rank: 999999 },
  ];
  assert.equal(rankSites(sites, 'weakest exam domain letter shift')[0].id, 'small');
  assert.equal(rankSites(sites, '')[0].id, 'big');
});

test('a run with the same verdicts is not a change', () => {
  const a = { tools: { readable: { speed: { verdict: 'better', verse: 1, best: 2 } } } };
  const b = { tools: { readable: { speed: { verdict: 'better', verse: 9, best: 8 } } } };
  assert.equal(verdictsChanged(a, b), false);
  assert.equal(verdictsChanged(a, { tools: { readable: { speed: { verdict: 'worse', verse: 9, best: 8 } } } }), true);
});

test('visitors get the sign and nothing else; the owner gets the floors, the next fight, and the numbers', () => {
  const pub = visitorHtml();
  assert.match(pub, /Out of Order/);
  assert.doesNotMatch(pub, /motherfuckingwebsite|rot13|tsundere|better|worse|equal|podcastindex|livescore/);
  const model = viewModel({ tools: { readable: { at: '2026-11-12T00:00:00.000Z', ...rowsFromMeasures(full, slow) } } }, '');
  assert.equal(model.floor, 7);
  assert.equal(model.fight, 'motherfuckingwebsite.com');
  const own = ownerHtml(model);
  assert.doesNotMatch(own, /Out of Order/);
  assert.match(own, /page is up/);
  assert.match(own, /motherfuckingwebsite\.com/);
  assert.match(own, /better/);
  assert.match(own, /A readable page<\/a><\/p><div class="elv-scroll">/);
  assert.match(own, /href="\/our-motherfucking-version\/"/);
  assert.match(own, /href="\/patterns\/"/);
  assert.match(own, /href="\/podcasts\/"/);
  assert.doesNotMatch(own, /href="[^"]*(motherfuckingwebsite|rot13|tsundere|podcastindex|livescore|convertlive|regex101|crontab|wiktionary|myqrcode|youtube|spotify|maps\.google|programiz|diffchecker)/);
  assert.doesNotMatch(own + pub, /\b(grab|steal|absorb|conquer)\b/i);
});

test('the owner model keeps the measured rows and follows the gap notes', () => {
  const api = viewModel({ tools: { readable: { at: '2026-11-12T00:00:00.000Z', ...rowsFromMeasures(full, slow) } } }, '');
  const again = modelFrom(api, gapText({ exam: { domains: { sports: { score: 1, fails: [{ ask: 'yankees score', failed: ['board'] }] } } } }));
  assert.equal(again.floor, 7);
  assert.equal(again.fight, 'motherfuckingwebsite.com');
  assert.equal(again.sites.find((s) => s.id === 'readable').rows.speed.verdict, 'better');
});

test('the next fight is the open site whose features match the gaps', () => {
  const exam = { domains: { sports: { score: 1, fails: [{ ask: 'yankees score', failed: ['board'] }] }, podcasts: { score: 9, fails: [] } } };
  const gaps = gapText({ exam, nightly: { pick: { id: 'sports', why: 'board' } }, wants: [{ ask: 'a scoreboard' }] });
  const model = viewModel(null, gaps);
  assert.equal(model.floor, 7);
  assert.equal(model.fight, 'motherfuckingwebsite.com');
  assert.equal(model.sites.find((s) => s.id === 'scores').floor, true);
});

test('a large site stays behind every smaller open row', () => {
  const ids = NEXT.map((s) => s.id);
  assert.ok(ids.indexOf('text-diff') < ids.indexOf('songs'));
  assert.ok(ids.indexOf('songs') < ids.indexOf('clips'));
  assert.ok(ids.indexOf('clips') < ids.indexOf('directions'));
  for (const id of ['songs', 'clips', 'directions']) assert.equal(SITES.find((s) => s.id === id).works, false);
  const model = viewModel(null, 'play a song on youtube and get map directions');
  assert.equal(model.fight, 'motherfuckingwebsite.com');
});

test('the live exam names an open page, not one that is already a floor', () => {
  const exam = JSON.parse(readFileSync(new URL('../void-live-deploy/exam/latest.json', import.meta.url), 'utf8'));
  const self = JSON.parse(readFileSync(new URL('../void-live-deploy/self.json', import.meta.url), 'utf8'));
  const nightly = JSON.parse(readFileSync(new URL('../void-live-deploy/progress/nightly.json', import.meta.url), 'utf8'));
  const model = viewModel(null, gapText({ exam, nightly, wants: self.open }));
  assert.equal(model.floor, 7);
  assert.equal(model.fight, 'motherfuckingwebsite.com');
  assert.equal(['podcastindex.org', 'livescore.com', 'convertlive.com', 'regex101.com', 'crontab.guru', 'wiktionary.org', 'myqrcode.com'].includes(model.fight), false);
});
