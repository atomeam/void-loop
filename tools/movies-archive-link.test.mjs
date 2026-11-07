// The film card's Internet Archive link, 2026-11-06: The Blair Witch Project (1999) showed "Not free to stream here" next to "Internet Archive:
// free films", a generic search, and Adam read it as "the Archive streams this film and Verse cannot". The Archive is now shown only as a checked
// legal item (legalArchive), which plays on the card; every other film links JustWatch and its record.
//   node --test tools/movies-archive-link.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchLinks } from '../void-live-deploy/lib/movies.js';
import { lookup } from '../void-live-deploy/functions/api/movies.js';
import { movieCard } from '../void-live-deploy/skills/movie.js';

const fake = (map) => async (u) => { for (const [k, v] of Object.entries(map)) if (u.includes(k)) { if (v instanceof Error) throw v; return v; } throw new Error('no route ' + u); };
const wd = (q, y, dir, mins) => ({ results: { bindings: [{ f: { value: 'http://www.wikidata.org/entity/' + q }, date: { value: y + '-07-30T00:00:00Z' }, dir: { value: dir }, mins: { value: String(mins) } }] } });

test('watchLinks has no Internet Archive search', () => {
  const l = watchLinks('The Blair Witch Project', 1999, '');
  assert.deepEqual(l.map((x) => x.label), ['JustWatch: where it streams']);
  assert.ok(!l.some((x) => /archive\.org/.test(x.url)));
});

test('a film not free here: no Archive link on the card, JustWatch stays', async () => {
  const f = await lookup('The Blair Witch Project', 1999, fake({ 'itunes.apple.com': new Error('upstream 403'), 'query.wikidata.org': wd('Q207588', 1999, 'Eduardo Sánchez', 81), 'archive.org/advancedsearch': { response: { docs: [] } } }));
  assert.equal(f.free, false);
  const card = movieCard(f, String);
  assert.match(card, /Not free to stream here/); assert.match(card, /JustWatch: where it streams/); assert.match(card, /Wikidata: the record/);
  assert.doesNotMatch(card, /Internet Archive/); assert.doesNotMatch(card, /archive\.org/);
});

test('an answer cached before the fix still shows no Archive search', () => {
  const old = { verified: true, title: 'The Blair Witch Project', year: 1999, free: false, links: [
    { label: 'JustWatch: where it streams', url: 'https://www.justwatch.com/us/search?q=x' },
    { label: 'Internet Archive: free films', url: 'https://archive.org/search?query=x&and[]=mediatype%3A%22movies%22' }] };
  const card = movieCard(old, String);
  assert.doesNotMatch(card, /free films/); assert.match(card, /JustWatch/);
});

test('a checked public-domain film: the card links its own Archive item and offers to play it here', async () => {
  const doc = { identifier: 'night_of_the_living_dead', title: 'Night of the Living Dead', year: '1968', licenseurl: 'http://creativecommons.org/publicdomain/mark/1.0/', collection: ['feature_films'] };
  const files = { result: [{ name: 'night.mp4', format: 'h.264', size: '400000000' }] };
  const f = await lookup('Night of the Living Dead', 1968, fake({ 'itunes.apple.com': new Error('upstream 403'), 'query.wikidata.org': { results: { bindings: [] } }, 'archive.org/advancedsearch': { response: { docs: [doc] } }, 'archive.org/metadata/': files }));
  assert.equal(f.free, true); assert.equal(f.play.kind, 'video');
  assert.equal(f.play.src, 'https://archive.org/download/night_of_the_living_dead/night.mp4');
  const card = movieCard(f, String);
  assert.match(card, /Play the film here/); assert.match(card, /Free and legal, plays here/);
  assert.match(card, /href="https:\/\/archive\.org\/details\/night_of_the_living_dead"[^>]*>its Internet Archive page/);
  assert.doesNotMatch(card, /archive\.org\/search/);
});

test('an Archive copy with no free licence is not offered', async () => {
  const doc = { identifier: 'blair_witch_upload', title: 'The Blair Witch Project', year: '1999', collection: ['opensource_movies'] };
  const f = await lookup('The Blair Witch Project', 1999, fake({ 'itunes.apple.com': new Error('upstream 403'), 'query.wikidata.org': wd('Q207588', 1999, 'Eduardo Sánchez', 81), 'archive.org/advancedsearch': { response: { docs: [doc] } } }));
  assert.equal(f.free, false); assert.equal(f.play, null);
  assert.doesNotMatch(movieCard(f, String), /archive\.org/);
});
