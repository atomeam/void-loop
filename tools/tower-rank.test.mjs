import test from 'node:test';
import assert from 'node:assert/strict';
import { regDomain, bySize, sizeOf, rankLabel, nextUnsurpassed, words } from '../void-live-deploy/lib/tower-rank.js';
import { FLOORS, tower } from '../void-live-deploy/lib/tower.js';
import { towerHtml, readBySize } from '../void-live-deploy/skills/tower.js';
import { buildRank, domainsOf } from './tower-rank.mjs';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => '&#' + c.charCodeAt(0) + ';');

test('registrable domains: subdomains, www, ports, paths and multi-part suffixes', () => {
  assert.equal(regDomain('https://int.soccerway.com/matches/'), 'soccerway.com');
  assert.equal(regDomain('https://www.bbc.co.uk/news'), 'bbc.co.uk');
  assert.equal(regDomain('news.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(regDomain('https://www.bbc.com/'), 'bbc.com');
  assert.equal(regDomain('https://www.google.com/finance/'), 'google.com');
  assert.equal(regDomain('http://User@Example.COM:8080/x?y#z'), 'example.com');
  assert.equal(regDomain('Google Translate'), ''); assert.equal(regDomain(''), ''); assert.equal(regDomain('localhost'), '');
});
test('every floor with a url has a domain', () => {
  const d = domainsOf(FLOORS); assert.ok(Object.keys(d).length >= FLOORS.length - 3);
});
test('sorting: unranked first, then the biggest rank number to the leaders last, ties keep their order', () => {
  const fl = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  const ranks = { a: 100, b: null, c: 900000, d: 5, e: 900000 };
  assert.deepEqual(bySize(fl, ranks).map((f) => f.id), ['b', 'f', 'c', 'e', 'a', 'd']);
  assert.deepEqual(fl.map((f) => f.id), ['a', 'b', 'c', 'd', 'e', 'f'], 'the input is not changed');
});
test('hand override stands in for the rank, in either direction, and a bad value is ignored', () => {
  const fl = ['a', 'b', 'c'].map((id) => ({ id })), ranks = { a: 1000, b: 500000, c: 20 };
  assert.deepEqual(bySize(fl, ranks).map((f) => f.id), ['b', 'a', 'c']);
  assert.deepEqual(bySize(fl, ranks, { b: 10 }).map((f) => f.id), ['a', 'c', 'b'], 'a tiny but data-heavy site goes later');
  assert.deepEqual(bySize(fl, ranks, { c: null, a: 'x' }).map((f) => f.id), ['b', 'a', 'c']);
  assert.equal(sizeOf('c', ranks, { c: 7 }), 7); assert.equal(sizeOf('z', ranks), null);
});
test('labels: #1,234, German #1.234, unranked, and nothing when no list is loaded', () => {
  assert.equal(rankLabel(1234), '#1,234'); assert.equal(rankLabel(1234567, 'en-GB'), '#1,234,567'); assert.equal(rankLabel(1234, 'de-CH'), '#1.234');
  assert.equal(rankLabel(null), 'unranked'); assert.equal(rankLabel(null, 'de'), 'ohne Rang'); assert.equal(rankLabel(5, 'en', false), '');
  assert.equal(words('de-DE').bySize, 'Nach Grösse'); assert.equal(words('fr').bySize, 'By size');
});
test('buildRank: only our rivals, null outside the list, deterministic, overrides carried', () => {
  const fl = [{ id: 'x', url: 'https://www.bbc.co.uk/news' }, { id: 'y', url: 'https://int.soccerway.com/' }, { id: 'z', url: 'https://nowhere-at-all.example/' }];
  const csv = '1,google.com\n40,bbc.co.uk\n88000,soccerway.com\n90,bbc.com\n';
  const a = buildRank({ floors: fl, csv, list: { date: 'd' }, order: { z: 3, q: 'x' } }), b = buildRank({ floors: fl, csv, list: { date: 'd' }, order: { z: 3, q: 'x' } });
  assert.deepEqual(a.ranks, { x: 40, y: 88000, z: null }); assert.deepEqual(a.order, { z: 3 }); assert.deepEqual(a, b);
  assert.match(a.credit, /tranco-list\.eu/);
});
test('next un-surpassed: skips surpassed floors and follows the size order', () => {
  const fl = [{ id: 'a', beaten: true }, { id: 'b', beaten: false }, { id: 'c', beaten: false }, { id: 'd', beaten: false }];
  assert.deepEqual(nextUnsurpassed(fl, { a: null, b: 10, c: 5000, d: null }, {}, 2).map((f) => f.id), ['d', 'c']);
});
test('the card: no size column without a list; with one, a size per row and a By size view, smallest first', () => {
  const t = tower([], {}, null, null);
  assert.doesNotMatch(towerHtml(t, esc), /tw-sortbtn|tw-size/);
  const ranks = Object.fromEntries(t.floors.map((f, i) => [f.id, i % 5 ? 1000 + i : null]));
  t.rank = { list: { date: 'd' }, ranks, order: {} };
  const h = towerHtml(t, esc, { lang: 'en' });
  assert.match(h, /class="tw-sortbtn" aria-pressed="false"[^>]*>By size</); assert.match(h, /class="tw-size"/);
  const v = towerHtml(t, esc, { bySize: true, lang: 'en' });
  assert.match(v, /aria-pressed="true"/); assert.match(v, /<ol class="tw-sizelist"/);
  assert.equal((v.match(/<li data-id=/g) || []).length, t.floors.length);
  assert.match(v.split('<li data-id=')[1], /unranked/, 'unranked first');
  assert.match(towerHtml(t, esc, { bySize: true, lang: 'de-DE' }), /Nach Grösse/);
  assert.equal(readBySize(), false, 'no storage here: the default, no throw');
});
