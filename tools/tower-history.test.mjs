// skills/tower.js historyOf / historyHtml: the card's site history, read from the same ledger (tower.target.json) /conquered/ reads
import test from 'node:test'; import assert from 'node:assert/strict';
import { historyOf, historyHtml, storyHtml, storyFor } from '../void-live-deploy/skills/tower.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ledger = {
  id: 'dalyfeds.com', since: '2026-11-06',
  passed: [{ id: 'my ip', at: '2026-11-06', n: 8, m: 13, open: ['a', 'b', 'c'] }, { id: 'emoji combos', at: '2026-11-06', n: 15, m: 15 }],
  skipped: [{ id: 'id5-sync.com', at: '2026-11-06', why: 'settled' }],
  settled: [{ id: 'id5-sync.com', at: '2026-11-06', kind: 'an ad-tracking or sync endpoint', why: 'https://id5-sync.com/ (200) shows 12 characters of text, 0 controls' }],
  archived: [{ at: '2026-11-06', passed: [{ id: 'ndscalc.ru', at: '2026-11-04', n: 10, m: 12 }], skipped: [{ id: 'emoji combos: emojigraph.org', at: '2026-11-05', why: 'held the Tower 1 day, so it gives way' }] }],
  last: { at: '2026-11-06', why: 'settled id5-sync.com as a non-site' },
};
const floors = [
  { id: 'dalyfeds.com', site: 'dalyfeds.com', state: 'current' },
  { id: 'my ip', site: 'icanhazip.com', state: 'passed', page: '/ip' },
  { id: 'emoji combos', site: 'emojicombos.com', state: 'passed', page: '/emoji-combos/' },
];

test('history: newest first, the ledger last step on top of its day, each row says how it ended', () => {
  const rows = historyOf({ target: ledger, floors });
  assert.deepEqual(rows.map((r) => [r.site, r.at, r.how]), [
    ['id5-sync.com', '2026-11-06', 'settled'],
    ['emojicombos.com', '2026-11-06', 'passed'],
    ['icanhazip.com', '2026-11-06', 'passed'],
    ['emoji combos: emojigraph.org', '2026-11-05', 'gave way'],
    ['ndscalc.ru', '2026-11-04', 'passed'],
  ]);
  assert.match(rows[0].why, /an ad-tracking or sync endpoint, not a site a person uses: https:\/\/id5-sync\.com\//);
  assert.equal(rows[2].why, 'Verse ahead on 8 of 13 aspects; 3 still measured in the background');
  assert.equal(rows[2].page, '/ip');
});
test('history html: the current target first, a link to each Verse page that exists, the rest behind Show all', () => {
  const h = historyHtml({ target: ledger, floors }, esc, 2);
  assert.ok(h.indexOf('dalyfeds.com') < h.indexOf('id5-sync.com'));
  assert.match(h, /since Nov 6/);
  assert.match(h, /<a href="\/emoji-combos\/">emojicombos\.com<\/a>/);
  assert.doesNotMatch(h, /<a href="[^"]*">id5-sync\.com/);
  assert.match(h, /Show all 5/);
  assert.match(h, /href="\/assimilated\/"/);
});
test('history html: nothing to show, nothing drawn', () => {
  assert.equal(historyHtml({ target: {}, floors: [] }, esc), '');
});

// the story (skills/tower.js storyFor/storyHtml): the live rival's own research file, history/<slug>.json, drawn above the ledger;
// a line the research could not prove ("unknown ...") is dropped, never slowed into a fact, and an unproven file is no story at all
const story = {
  site: 'protopage.com', doc: 'docs/HISTORY/protopage.md',
  events: [
    { k: 'Founding', t: 'Founded: unknown (no source found yet)', u: 1 },
    { k: 'Founding', y: '2005', t: 'Founded: May 2005', s: 'https://web.archive.org/web/2005/launch' },
    { k: 'Founding', t: 'Founders: Andre Parrie', s: 'https://web.archive.org/web/2005/who' },
    { k: 'Key milestones', y: '2005', t: 'An early web 2.0 start page and RSS reader', s: 'https://web.archive.org/web/2005/press' },
    { k: 'Ownership', t: 'unknown (no source found yet)', u: 1 },
    { k: 'Notable features', t: 'Still running after bigger start pages shut down' },
  ],
  snaps: [['2005', 'https://web.archive.org/web/2005/start']],
};
const sFloors = [{ id: 'protopage.com', site: 'Protopage', state: 'current', url: 'https://protopage.com' }];

test('story html: the founding in the headline, unknown lines dropped, each source linked, the first archive named', () => {
  const h = storyHtml({ floors: sFloors, story }, esc);
  assert.match(h, /<b>Protopage's own story<\/b>/);
  assert.match(h, /founded 2005/);
  assert.doesNotMatch(h, /unknown/);
  assert.match(h, /<a href="https:\/\/web\.archive\.org\/web\/2005\/press" target="_blank" rel="noopener noreferrer">source<\/a>/);
  assert.match(h, /on the web since 2005/);
  assert.match(h, /Still running after bigger start pages shut down/);
  // three events after the founding minus the founding block: the milestone and the features note; the founding rows do not repeat below the headline
  assert.equal((h.match(/<li /g) || []).length, 2);
});

test('story html: a research file with nothing proven is no story at all, and no story is nothing drawn', () => {
  assert.equal(storyHtml({ floors: sFloors, story: { site: 'x.com', events: [
    { k: 'Founding', t: 'Founded: unknown (no source found yet)', u: 1 },
    { k: 'Ownership', t: 'unknown (no source found yet)', u: 1 },
  ] } }, esc), '');
  assert.equal(storyHtml({ floors: sFloors }, esc), '');
});

test('history html: the story sits above the ledger line', () => {
  const h = historyHtml({ target: ledger, floors: [...floors, { id: 'protopage.com', site: 'Protopage', state: 'current' }], story }, esc, 2);
  assert.ok(h.indexOf("own story") < h.indexOf('tw-ledger'));
});

test('storyFor: no current floor or a name that is not a single host, nothing fetched; a clean host answers null before the file arrives (node never 404s here, it has no server)', async () => {
  assert.equal(await storyFor({}), null);
  assert.equal(await storyFor({ floors: [{ id: 'my ip', site: 'icanhazip.com', state: 'current' }] }), null);
  assert.equal(await storyFor({ floors: sFloors }), null);
});
