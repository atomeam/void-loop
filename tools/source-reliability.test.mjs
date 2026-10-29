import test from 'node:test';
import assert from 'node:assert/strict';
import { siteOf, sitesIn, routesIn, namesSource, scanSkill, reliabilityOf, reliabilityWords, familySources, familySourcesWords, SOURCE_FAMILIES } from './source-reliability.mjs';
import { build, ratingOf } from './families.mjs';

test('a source is a site: hosts group by site, placeholders and Verse itself are not sources', () => {
  assert.equal(siteOf('api.tvmaze.com'), 'tvmaze.com'); assert.equal(siteOf('www.tvmaze.com'), 'tvmaze.com');
  assert.equal(siteOf('news.bbc.co.uk'), 'bbc.co.uk'); assert.equal(siteOf('en.wiktionary.org'), 'wiktionary.org');
  assert.deepEqual(sitesIn("fetch('https://api.tvmaze.com/x?q=' + q); '<a href=\"https://www.tvmaze.com/shows/1\">' https://example.org https://a-to-mind.com/x http://w3.org"), ['tvmaze.com']);
  assert.deepEqual(routesIn("fetch('/api/movies?title=' + t); fetch('/api/answer', {}); fetch(`/api/media?kind=show`)"), ['media', 'movies']);
  assert.equal(namesSource('<div class="src">Source: TVMaze</div>'), true); assert.equal(namesSource("'<div class=\\'src\\'>x'"), true);
  assert.equal(namesSource('<div class="srcset">'), false); assert.equal(namesSource('no line'), false);
});

test('a skill is scanned with the server route it calls; a missing file reads as no source', () => {
  const files = { 'void-live-deploy/skills/movie.js': "fetch('/api/movies?title=' + t); fetch('/api/answer'); '<div class=\"src\">Source: ' + s",
    'void-live-deploy/functions/api/movies.js': "getJson('https://itunes.apple.com/search?term=' + t); getJson('https://archive.org/advancedsearch.php')" };
  const read = (p) => { if (p in files) return files[p]; throw new Error('no ' + p); };
  assert.deepEqual(scanSkill('movie', read), { sites: ['apple.com', 'archive.org'], named: true, routes: ['movies'] });
  assert.deepEqual(scanSkill('gone', read), { sites: [], named: false, routes: [] });
});

test('reliability: one point each for a named source, a second source and a kept live answer; the benchmark never counts', () => {
  const today = '2026-10-17';
  assert.equal(reliabilityOf({ sites: [], named: true }, { tier: 'tested' }, {}, today), null, 'no outside source, no metric');
  const r = reliabilityOf({ sites: ['tvmaze.com'], named: true }, { tier: 'tested', success_rate: 1 }, { bench: 9 }, today);
  assert.equal(r.points, 1); assert.equal(r.answered, false, 'a benchmark of stubbed services is no record of the source'); assert.equal(r.second, false);
  const full = reliabilityOf({ sites: ['a.org', 'b.org'], named: true }, { tier: 'proven' }, { suite: true, live: 2, liveAt: today }, today);
  assert.equal(full.points, 3); assert.equal(full.next, undefined, 'already proven: nothing to lift');
  assert.match(full.words, /^source 3 of 3: a\.org, b\.org; named on the card; a second source; a kept live answer$/);
});

test('the way up is the existing rule: one kept live answer would make a tested or checked skill proven, and ratingOf agrees', () => {
  const today = '2026-10-17';
  for (const ev of [{ suite: true }, { bench: 4 }, { suite: true, browser: 2 }]) {
    const tier = ratingOf(ev, today).tier;
    const r = reliabilityOf({ sites: ['x.org'], named: false }, { tier }, ev, today);
    assert.equal(r.next, 'live', JSON.stringify(ev)); assert.equal(ratingOf({ ...ev, live: 1, liveAt: today }, today).tier, 'proven');
    assert.match(r.words, /One kept live answer from x\.org would make it proven$/);
  }
  assert.equal(reliabilityOf({ sites: ['x.org'] }, { tier: 'experiment' }, {}, today).next, undefined, 'nothing else checks it: one live answer only makes it tested');
  assert.equal(reliabilityWords(null), '');
});

test('the family sums its skills and names the ones a live answer would lift; families.mjs writes it for Words and the world only', () => {
  const rows = [{ name: 'a', source: { sites: ['x.org'], named: true, second: false, answered: false, points: 1, next: 'live' } },
    { name: 'b', source: { sites: ['y.org', 'z.org'], named: true, second: true, answered: true, points: 3 } }, { name: 'c' }];
  const f = familySources(rows);
  assert.deepEqual({ ...f, words: undefined }, { read: 2, named: 2, second: 1, answered: 1, points: 2, one_live_from_proven: ['a'], words: undefined });
  assert.match(f.words, /^Source reliability: 2 skills answer from outside sources; 2 name the source on the card, 1 have a second source, 1 have a kept live answer from it \(2 of 3 on average\)\. One kept live answer each would make 1 more proven: a\.$/);
  assert.equal(familySources([{ name: 'c' }]), null); assert.equal(familySourcesWords(null), '');
  assert.deepEqual(SOURCE_FAMILIES, ['words']);
  const b = build(['define', 'calc'], { define: { suite: true }, calc: { suite: true } }, { today: '2026-10-17', sources: { define: { sites: ['wiktionary.org'], named: true }, calc: { sites: ['x.org'], named: true } } });
  const words = b.families.find((x) => x.id === 'words'), nums = b.families.find((x) => x.id === 'numbers');
  assert.equal(words.sources.read, 1); assert.deepEqual(words.sources.one_live_from_proven, ['define']); assert.equal(words.skills[0].tier, 'tested', 'the rating is unchanged');
  assert.equal('sources' in nums, false); assert.equal(build(['define'], { define: { suite: true } }).families.find((x) => x.id === 'words').sources, undefined, 'no scan, no field');
});
