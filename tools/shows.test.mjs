// node --test tools/shows.test.mjs: real shows (lib/media.js): exact match only, and "source says no" is a first-class answer. Every sample is made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickShow, showAvailability, showLinks, showCardAsk, pickKind } from '../void-live-deploy/lib/media.js';

const J = (o = {}) => ({ name: 'Made Up Show', premiered: '2020-01-01', status: 'Running', genres: ['Drama'], network: { name: 'BBC One', country: { code: 'GB' } }, webChannel: null, officialSite: 'https://example.org/show', url: 'https://www.tvmaze.com/shows/1/x', summary: '<p>A <b>made-up</b> show &amp; more.</p>', _embedded: { seasons: [{ number: 1, episodeOrder: 6 }, { number: 2, episodeOrder: 8 }] }, ...o });

test('no exact match is not verified, never a near one', () => {
  assert.equal(pickShow(J({ name: 'Made Up Show 2' }), 'Made Up Show', 2020), null);
  assert.equal(pickShow(J({ premiered: '1990-01-01' }), 'Made Up Show', 2020), null);
  assert.equal(pickShow(null, 'Made Up Show'), null);
  const s = pickShow(J(), 'Made Up Show', 2020);
  assert.equal(s.seasons, 2); assert.equal(s.episodes, 14); assert.equal(s.overview, 'A made-up show & more.');
});
test('availability: ok, region, unavailable', () => {
  const s = pickShow(J(), 'Made Up Show');
  assert.equal(showAvailability(s, 'GB').state, 'ok');
  assert.equal(showAvailability(s, '').state, 'ok');
  const r = showAvailability(s, 'US'); assert.equal(r.state, 'region'); assert.match(r.why, /GB/);
  assert.equal(showAvailability(pickShow(J({ webChannel: { name: 'Netflix' } }), 'Made Up Show'), 'US').state, 'ok');
  assert.equal(showAvailability(pickShow(J({ network: null, webChannel: null, officialSite: null }), 'Made Up Show'), 'GB').state, 'unavailable');
  assert.equal(showAvailability(pickShow(J({ status: 'In Development' }), 'Made Up Show'), 'GB').state, 'unavailable');
  assert.equal(showAvailability(null, 'GB').state, 'unavailable');
});
test('links: a no is official links only, never a search or a stream; an official site must be https', () => {
  const s = pickShow(J(), 'Made Up Show');
  const l = showLinks(s.title, s.year, s.site, s.page, true);
  assert.deepEqual(l.map((x) => x.label), ['Official site', 'TVMaze page']);
  assert.ok(showLinks(s.title, s.year, s.site, s.page).some((x) => /justwatch/.test(x.url)));
  assert.equal(pickShow(J({ officialSite: 'javascript:alert(1)' }), 'Made Up Show').site, '');
  assert.ok([...l, ...showLinks('x', 1, '', '')].every((x) => /^https:\/\//.test(x.url)));
});
test('asks: show card parse and kind', () => {
  assert.deepEqual(showCardAsk('show card for Severance (2022)'), { kind: 'show', title: 'Severance', year: 2022 });
  assert.equal(pickKind('pick a tv show').kind, 'show');
});
