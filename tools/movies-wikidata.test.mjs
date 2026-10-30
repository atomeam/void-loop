// The movie lookup (functions/api/movies.js, lib/movies.js), 2026-10-30: on a-to-mind.com "what should i watch on netflix" showed one film and
// "Not verified: The Grand Budapest Hotel, Parasite, Mad Max: Fury Road, Moonlight, The Princess Bride", because iTunes refuses shared cloud
// addresses and a refusal was cached for a day. Wikidata is now asked at the same time, and an answer from no reachable source is "unreachable".
//   node --test tools/movies-wikidata.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wikidataQuery, pickWikidata } from '../void-live-deploy/lib/movies.js';
import { lookup, onRequestGet } from '../void-live-deploy/functions/api/movies.js';
import { movieCard } from '../void-live-deploy/skills/movie.js';

// the three "Parasite" films Wikidata returned for this query on 2026-10-30 (query.wikidata.org, trimmed to the fields used)
const row = (q, d, dir, mins) => ({ f: { value: 'http://www.wikidata.org/entity/' + q }, date: { value: d + '-01-01T00:00:00Z' }, ...(dir ? { dir: { value: dir } } : {}), ...(mins ? { mins: { value: String(mins) } } : {}) });
const parasite = { results: { bindings: [row('Q1194793', '1982', 'Charles Band', 85), row('Q11291444', '2004', 'Andrew Prendergast'), row('Q61448040', '2019', 'Bong Joon-ho', 132)] } };
const fake = (map) => async (u) => { for (const [k, v] of Object.entries(map)) if (u.includes(k)) { if (v instanceof Error) throw v; return v; } throw new Error('no route ' + u); };
const empty = { results: { bindings: [] } };

test('the query asks for films with this exact English label, and no quote reaches the literal', () => {
  const q = wikidataQuery('Mad Max: Fury Road');
  assert.match(q, /VALUES \?l \{ "Mad Max: Fury Road"@en \}/); assert.match(q, /wd:Q11424/);
  assert.doesNotMatch(wikidataQuery('x" } ; DROP'), /x" \}/);
});

test('pickWikidata takes the film of the asked year, or the most recent one, and nothing for another year', () => {
  assert.deepEqual(pickWikidata(parasite, 'Parasite', 2019), { title: 'Parasite', year: 2019, director: 'Bong Joon-ho', runtime: 132, page: 'https://www.wikidata.org/wiki/Q61448040' });
  assert.equal(pickWikidata(parasite, 'Parasite', 1982).director, 'Charles Band');
  assert.equal(pickWikidata(parasite, 'Parasite', null).year, 2019);
  assert.equal(pickWikidata(parasite, 'Parasite', 1950), null);
  assert.equal(pickWikidata(empty, 'Parasite', 2019), null);
  assert.equal(pickWikidata({ results: { bindings: [{ f: { value: 'javascript:alert(1)' }, date: { value: '2019' } }] } }, 'x', 2019), null);
});

test('iTunes refused: the film is still verified, from Wikidata, with its record linked and its source named', async () => {
  const f = await lookup('Parasite', 2019, fake({ 'itunes.apple.com': new Error('upstream 403'), 'query.wikidata.org': parasite, 'archive.org/advancedsearch': { response: { docs: [] } } }));
  assert.equal(f.verified, true); assert.equal(f.director, 'Bong Joon-ho'); assert.equal(f.runtime, 132); assert.equal(f.year, 2019);
  assert.deepEqual(f.sources, ['Wikidata']); assert.equal(f.free, false); assert.equal(f.poster, '');
  assert.ok(f.links.some((l) => l.url === 'https://www.wikidata.org/wiki/Q61448040'));
  assert.match(movieCard(f, String), /Bong Joon-ho/); assert.match(movieCard(f, String), /Source: Wikidata/);
});

test('every source refused: "unreachable", never "no source knows it", and the answer is not cached', async () => {
  const down = fake({ 'itunes.apple.com': new Error('403'), 'query.wikidata.org': new Error('429'), 'archive.org': new Error('timeout') });
  const f = await lookup('Parasite', 2019, down);
  assert.deepEqual(f, { verified: false, unreachable: true, title: 'Parasite', year: 2019 });
  assert.match(movieCard(f, String), /Not checked/);
  const known = await lookup('Nothing Like This', 2019, fake({ 'itunes.apple.com': { results: [] }, 'query.wikidata.org': empty, 'archive.org': { response: { docs: [] } } }));
  assert.deepEqual(known, { verified: false, title: 'Nothing Like This', year: 2019 });
  assert.match(movieCard(known, String), /Not verified/);
  const real = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try { const r = await onRequestGet({ request: new Request('https://a-to-mind.com/api/movies?title=Parasite&year=2019') }); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal((await r.json()).unreachable, true); }
  finally { globalThis.fetch = real; }
});

test('iTunes answers: its facts win, and Wikidata only fills what iTunes left out', async () => {
  const it = { results: [{ kind: 'feature-movie', trackName: 'Parasite', releaseDate: '2019-10-11', primaryGenreName: 'Thriller', artistName: 'Bong Joon Ho', artworkUrl100: 'https://is1.mzstatic.com/a/100x100bb.jpg' }] };
  const f = await lookup('Parasite', 2019, fake({ 'itunes.apple.com': it, 'query.wikidata.org': parasite, 'archive.org': { response: { docs: [] } } }));
  assert.equal(f.director, 'Bong Joon Ho'); assert.equal(f.genre, 'Thriller'); assert.equal(f.runtime, 132);
  assert.deepEqual(f.sources, ['iTunes Search API', 'Wikidata']);
});
