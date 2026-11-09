// skills/tower.js historyOf / historyHtml: the card's site history, read from the same ledger (tower.target.json) /conquered/ reads
import test from 'node:test'; import assert from 'node:assert/strict';
import { historyOf, historyHtml } from '../void-live-deploy/skills/tower.js';

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
