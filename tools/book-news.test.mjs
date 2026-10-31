// What's new in the book (lib/book-news.js): the ledger's newest entries grouped by day then kind, cut into pages, and the chapter
// slotted after the contents with every later page number moved. Run: node --test tools/book-news.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newsEntries, groupNews, newsPages, newSince, withNews, visitorLine, visitorTry, dayOf, dayLabel } from '../void-live-deploy/lib/book-news.js';
import { bookFromRepo } from './guide.mjs';
import { guideOf, pageFor } from '../void-live-deploy/skills/guide.js';

const L = [
  { at: '2026-10-15T09:00:00Z', kind: 'fix', what: 'old fix', try: 'old ask' },
  { at: '2026-10-16T10:00:00Z', kind: 'fix', what: 'fixed a thing', show: 'a thing works again', try: 'a thing' },
  { at: '2026-10-16T11:00:00Z', kind: 'grow', what: 'grew a skill', show: 'it grew', try: 'make a clock' },
  { at: '2026-10-16T12:00:00Z', kind: 'build', what: 'built a board', try: '/kanban/' },
  { at: '2026-10-16T13:00:00Z', kind: 'grow', what: 'grew again', show: 'it grew again', try: 'grow again' },
  { at: '2026-10-16T13:30:00Z', kind: 'build', what: 'the agents\' own record with nothing to try' },
  { at: 'nope', kind: 'grow', what: 'no date', try: 'x' }, { at: '2026-10-16T14:00:00Z', kind: 'grow', try: 'x' }, null,
];
const UTC = { tz: 'UTC' };

test('entries: newest first, only dated entries a visitor can try, show before what, capitalised', () => {
  const e = newsEntries(L, 36, null, UTC);
  assert.deepEqual(e.map((x) => x.line), ['It grew again', 'Built a board', 'It grew', 'A thing works again', 'Old fix']);
  assert.equal(e[2].try, 'make a clock'); assert.equal(e[1].try, '/kanban/');
  assert.equal(newsEntries(L, 2, null, UTC).length, 2);
  assert.deepEqual(newsEntries(null), []);
  assert.ok(newsEntries([{ at: '2026-10-16T10:00:00Z', what: 'word '.repeat(80), try: 'w' }], 36, null, UTC)[0].line === 'Word ' + 'word '.repeat(79).trim(), 'a long line is kept whole, never cut with an ellipsis (owner, 2026-10-21)');
});

test('the visitor\'s words (owner\'s screenshot, 2026-10-30): no file paths, PR numbers, hashes or code names; phrases grouped by skill', () => {
  // the three lines from the screenshot, as the ledger holds them
  const promo = { at: '2026-10-30T02:25:11Z', kind: 'build', what: 'Promotion record for the checked and tested skills: 44 met the proven standard and were promoted, 22 stayed with their reasons, each with its evidence before and after (docs/promotions/2026-10-29.md, PR #1583, merged 2026-10-29; this line records it). Now 358 proven, 16 checked, 1 tested.' };
  const conv = { at: '2026-10-30T02:24:46Z', kind: 'build', what: "Verse assimilates onlineconverter.com as /converter/: its 106 file and unit tools listed with what Verse does on the device, and onlineconverter.com's lane page in lib/tower.js LANE_PAGES (built 2026-10-29 in b66702e; this line records it)" };
  const self = { at: '2026-10-30T02:47:43Z', kind: 'fix', what: 'The self card shows a site\'s ask as built only when the ledger line names that site: a word link copies the ask back, so it is no evidence; asks-link.mjs skips lines without the site, and the wrong onlineconverter.com link is removed' };
  const hang = { at: '2026-10-30T00:56:41Z', kind: 'grow', what: "Verse hardened itself: 'hangman', 'should I go' for hangman, yesno.  Why these: tab (no benchmark ask, evidence tier: checked). New phrases: \u201changman\u201d now opens hangman; \u201cplay hangman\u201d now opens hangman; \u201cshould I go\u201d now opens yesno. Did not route: heads or tails.", try: 'hangman' };
  const fix = { at: '2026-10-30T00:46:12Z', kind: 'fix', what: 'Verse fixes its converter skill: learn to handle "mp4 to mp3"', try: 'mp4 to mp3' };
  const retire = { at: '2026-10-30T00:50:00Z', kind: 'retire', what: 'Taken back off the site: "Merge pull request #1632" failed', try: 'x' };
  const n = newsEntries([promo, conv, self, hang, fix, retire], 36, null, UTC);
  assert.deepEqual(n.map((e) => [e.line, e.try]), [
    ['Verse assimilates onlineconverter.com as /converter/', '/converter/'],
    ['\u201changman\u201d and \u201cplay hangman\u201d now open hangman; \u201cshould I go\u201d now opens yesno', 'hangman'],
    ['The converter skill now answers \u201cmp4 to mp3\u201d', 'mp4 to mp3'],
  ], 'the promotion record and the self-card fix stay the agents\' (growth card, /void.growth.json); a retire is never news');
  for (const e of n) assert.ok(!/\.m?js\b|\.md\b|#\d|\b[0-9a-f]{7}\b|records it|LANE_PAGES/.test(e.line), e.line);
  assert.equal(visitorLine({ what: 'a fix (built 2026-10-29 in 1a2b3c4d; this line records it)' }), 'a fix');
  assert.equal(visitorLine({ show: 'see docs/x.md', what: 'the words' }), 'the words', 'a show that names a file falls back to the words');
});

test('a try a visitor can use: an ask or a page of the site, never a developer step', () => {
  assert.equal(visitorTry('hangman'), 'hangman');
  assert.equal(visitorTry('node --test tools/verse-coder.test.mjs'), '');
  assert.equal(visitorTry('watch the next verse-job run ship'), '');
  assert.equal(visitorTry('a-to-mind.com/gradient/ then See it as a card on the stage'), '/gradient/');
  assert.equal(visitorTry('Open /calculator/?q=(3%2B4)*5 and read the stage card link'), '/calculator/?q=(3%2B4)*5');
  assert.equal(visitorTry('/weather/?q=Paris, then See it as a card on the stage'), '/weather/?q=Paris');
  assert.equal(visitorTry('Type I hate rainy weather on /translate/, to French, and press the card link'), '');
  assert.deepEqual(newsEntries([{ at: '2026-10-16T10:00:00Z', kind: 'fix', what: 'coder tokens last longer', try: 'node --test tools/x.test.mjs' }], 36, null, UTC), [], 'nothing to try: not news');
});

test('the day is the visitor\'s own (owner, 2026-10-30: Friday on a Thursday evening in New York)', () => {
  assert.equal(dayOf('2026-10-30T03:00:00Z', 'America/New_York'), '2026-10-29');
  assert.equal(dayOf('2026-10-30T03:00:00Z', 'UTC'), '2026-10-30');
  assert.equal(dayOf('2026-10-30T03:00:00Z', 'Asia/Tokyo'), '2026-10-30');
  const e = newsEntries([{ at: '2026-10-30T03:00:00Z', kind: 'grow', what: 'x', try: 'x' }], 36, null, { tz: 'America/New_York' });
  assert.equal(e[0].day, '2026-10-29');
  assert.equal(dayLabel('2026-10-29', '2026-10-29'), 'Today, Thursday 29 October');
  assert.equal(dayLabel('2026-10-28', '2026-10-29'), 'Yesterday, Wednesday 28 October');
  assert.equal(dayLabel('2026-10-20', '2026-10-29'), 'Tuesday 20 October');
});

test('grouping: newest day first, then grow, build, fix inside a day; nothing lost or invented', () => {
  const days = groupNews(newsEntries(L, 36, null, UTC));
  assert.deepEqual(days.map((d) => d.day), ['2026-10-16', '2026-10-15']);
  assert.deepEqual(days[0].groups.map((g) => g.kind), ['grow', 'build', 'fix']);
  assert.deepEqual(days[0].groups[0].items.map((i) => i.line), ['It grew again', 'It grew']);
  assert.equal(days.flatMap((d) => d.groups.flatMap((g) => g.items)).length, 5);
  assert.equal(groupNews([{ at: '2026-10-16T10:00:00Z', day: '2026-10-16', kind: 'idea', line: 'x', try: '' }])[0].groups[0].name, 'Ideas');
});

test('pages: at most the per-page lines, every page regrouped on its own, all entries kept', () => {
  const e = newsEntries(L, 36, null, UTC), pg = newsPages(e, 2);
  assert.equal(pg.length, 3);
  assert.ok(pg.every((p) => p.kind === 'news' && p.days.flatMap((d) => d.groups.flatMap((g) => g.items)).length <= 2));
  assert.equal(pg.flatMap((p) => p.days.flatMap((d) => d.groups.flatMap((g) => g.items))).length, 5);
});

test('a day split over pages: each part carries the whole day, and "play all N" counts the whole day (the stage plays all of it)', async () => {
  const { pageHtml } = await import('../void-live-deploy/lib/tome.js');
  const e = newsEntries(L, 36, null, UTC), pg = newsPages(e, 2);
  for (const p of pg) for (const d of p.days) assert.deepEqual(d.all.map((x) => x.line).sort(), e.filter((x) => x.day === d.day).map((x) => x.line).sort());
  for (const x of e) x.live = true;
  const split = pg.find((p) => p.days.some((d) => d.all.length > d.groups.flatMap((g) => g.items).length)), d = split.days.find((d) => d.all.length > d.groups.flatMap((g) => g.items).length);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => '&#' + c.charCodeAt(0) + ';');
  assert.match(pageHtml(split, { pages: pg }, esc), new RegExp('play all ' + d.all.length + ' on the stage'));
});

test('since: counts entries newer than the kept time; a first visit counts none', () => {
  const e = newsEntries(L, 36, null, UTC);
  assert.equal(newSince(e, "2026-10-16T11:30:00Z"), 2);
  assert.equal(newSince(e, '2026-10-16T13:00:00Z'), 0);
  assert.equal(newSince(e, ''), 0); assert.equal(newSince(e, null), 0);
});

test('withNews: the chapter follows the contents and every later page, chapter, index entry and link moves up', () => {
  const book = bookFromRepo(), before = structuredClone(book);
  const nb = withNews(book, L, { per: 2, tz: 'UTC' });
  assert.deepEqual(book, before, 'the input book is not changed');
  assert.equal(nb.pages.length, book.pages.length + 3);
  nb.pages.forEach((p, i) => assert.equal(p.n, i + 1, 'page numbers run 1..N with no gap'));
  const toc = nb.pages.find((p) => p.kind === 'toc');
  assert.deepEqual(nb.pages.slice(toc.n, toc.n + 3).map((p) => p.kind), ['news', 'news', 'news']);
  assert.equal(nb.chapters[1].id, 'news'); assert.equal(nb.chapters[1].from, toc.n + 1); assert.equal(nb.chapters[1].to, toc.n + 3);
  assert.equal(nb.chapters[2].from, nb.chapters[1].to + 1, 'the next chapter starts right after');
  for (const c of nb.chapters) assert.ok(nb.pages[c.from - 1] && nb.pages[c.to - 1] && nb.pages[c.from - 1].chapter === c.id && nb.pages[c.to - 1].chapter === c.id, c.id + ' range lands on its own pages');
  for (const e of nb.index) { const p = nb.pages[e.page - 1]; assert.ok(p && (p.kind === 'skill' || p.kind === 'game' || p.kind === 'mini'), e.name + ' still lands on a skill page'); }
  for (const p of nb.pages.filter((x) => x.kind === 'index')) for (const e of p.entries) { const t = nb.pages[e.page - 1]; assert.ok(t && (t.kind === 'skill' || t.kind === 'game' || t.kind === 'mini'), e.name + ' on the index page lands on a skill page'); }
  for (const p of nb.pages.filter((x) => x.ownerPage)) assert.equal(nb.pages[p.ownerPage - 1].name, p.owner);
  assert.equal(nb.totals.pages, nb.pages.length); assert.equal(nb.news.count, 5);
  assert.equal(withNews(book, []), book, 'no entries: the book as it is');
  assert.equal(withNews(book, null), book);
});

test('withNews on the real ledger: a new entry shows with no regeneration, and the book still opens by name', () => {
  const ledger = JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const base = bookFromRepo();
  const plus = ledger.concat([{ at: '2999-01-01T00:00:00Z', kind: 'grow', what: 'tomorrow', show: 'a change shipped after the book was built', try: 'make a clock' }]);
  const nb = withNews(base, plus);
  assert.equal(nb.pages.find((p) => p.kind === 'news').days[0].groups[0].items[0].line, 'A change shipped after the book was built');
  assert.equal(pageFor(nb, 'what’s new'), nb.news.from); assert.equal(pageFor(nb, "what's new"), nb.news.from);
  assert.ok(nb.news.count <= 36 && nb.news.count > 0);
  assert.deepEqual(guideOf("what's new in the book"), { at: 'what’s new' });
  assert.equal(guideOf("what's new"), null, 'a bare what\'s new stays the growth skill\'s');
});
test('an entry with no try of its own gets one from tryOf (the showcase), its own try still wins, and a throwing tryOf is ignored (asked by Verse)', async () => {
  const { newsEntries } = await import('../void-live-deploy/lib/book-news.js');
  const L = [{ at: '2026-10-17T10:00:00Z', kind: 'grow', what: 'a clock', try: 'make a clock' }, { at: '2026-10-17T11:00:00Z', kind: 'grow', what: 'a timer' }, { at: '2026-10-17T12:00:00Z', kind: 'fix', what: 'a fix' }];
  const tryOf = (e) => (e.what === 'a timer' ? 'set a 5 minute timer' : '');
  assert.deepEqual(newsEntries(L, 10, tryOf).map((e) => e.try), ['set a 5 minute timer', 'make a clock'], 'an entry with nothing to try is left out');
  assert.deepEqual(newsEntries(L, 10).map((e) => e.try), ['make a clock'], 'no tryOf');
  assert.deepEqual(newsEntries(L, 10, () => { throw new Error('x'); }).map((e) => e.try), ['make a clock']);
});
test('an entry that added nothing is not news, and the same words twice in a day are one line', async () => {
  const { newsEntries } = await import('../void-live-deploy/lib/book-news.js');
  const L = [1, 2, 3].map((i) => ({ at: '2026-10-24T0' + i + ':00:00Z', kind: 'finding', what: 'Verse looked and found nothing to add this cycle. Candidates tried: none.' }))
    .concat([{ at: '2026-10-24T05:00:00Z', kind: 'build', what: 'Colour codes on one page.', try: 'colour codes' }, { at: '2026-10-24T06:00:00Z', kind: 'build', what: 'Colour codes on one page.', try: 'colour codes' }]);
  const n = newsEntries(L, 36, null, { tz: 'UTC' }); assert.equal(n.length, 1); assert.equal(n[0].line, 'Colour codes on one page.');
});

test('a fix the forge made from its own probe ("(from my probes)" on the ledger line) reads like any other fix to a visitor', () => {
  const line = visitorLine({ at: '2026-10-30T19:00:00Z', kind: 'fix', what: 'Verse fixes its sky skill: learn to handle "current sky" (from my probes)', try: 'current sky' });
  assert.equal(line, 'The sky skill now answers “current sky”');
});
