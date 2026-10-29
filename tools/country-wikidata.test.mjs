// The country skill's live source is Wikidata (keyless, CORS open): REST Countries retired its keyless v3.1 API in 2026-10 (it now
// answers with a redirect and a deprecation note, the browser reads that as a CORS error), so "population of Japan" showed only the
// built-in capital and a console error (site-test issue #1063). The query and the reading of its answer are pure and checked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wikidataQuery, fromWikidata, namesOf, rowsOf, WIKIDATA } from '../void-live-deploy/skills/country.js';
import { readFileSync } from 'node:fs';

const L = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { type: 'literal', value: String(v) }]));

test('the query looks a country up by its English name or alias, as typed, in title case and as the short form', () => {
  assert.deepEqual(namesOf('bosnia and herzegovina').slice(0, 2), ['bosnia and herzegovina', 'Bosnia and Herzegovina']);
  assert.ok(namesOf('uk').includes('the UK') && namesOf('uk').includes('UK'));
  const q = wikidataQuery('Japan');
  assert.match(q, /VALUES \?lab \{ "Japan"@en/); assert.match(q, /wd:Q6256 wd:Q3624078/); assert.match(q, /wdt:P47 \?bord\. \?bord wdt:P31 \?bt\. VALUES \?bt \{ wd:Q6256 wd:Q3624078 \}/); assert.match(q, /wdt:P1082/); assert.match(q, /wikibase:label/);
  assert.doesNotMatch(wikidataQuery('x" } DROP'), /"x" \}/, 'a quote in the name cannot close the literal');
  assert.equal(WIKIDATA, 'https://query.wikidata.org/sparql');
});

test('an answer row reads as the record the card rows were written for', () => {
  const [c] = fromWikidata({ results: { bindings: [L({ c: 'http://www.wikidata.org/entity/Q183', name: 'Germany', capitals: 'Berlin', population: '83467117', currencies: 'Euro',
    languages: 'German', area: '357588', continents: 'Europe', timezones: 'UTC+01:00|Europe/Berlin|UTC+02:00', borders: 'Poland|France|Austria', cca2: 'DE', calling: '+49', drives: 'right' })] } });
  assert.equal(c.name.common, 'Germany'); assert.equal(c.flag, '🇩🇪'); assert.deepEqual(c.timezones, ['UTC+01:00', 'UTC+02:00']);
  assert.deepEqual(c.borderNames, ['Austria', 'France', 'Poland']); assert.equal(c.wikidata, 'https://www.wikidata.org/entity/Q183');
  const r = rowsOf(c, c.borderNames, 0, '');
  assert.equal(r.capital[1], 'Berlin'); assert.equal(r.population[1], (83467117).toLocaleString()); assert.equal(r.currencies[1], 'Euro'); assert.equal(r.languages[1], 'German');
  assert.equal(r.calling[1], '+49'); assert.equal(r.drives[1], 'on the right'); assert.equal(r.continent[1], 'Europe'); assert.equal(r.borders[1], 'Austria, France, Poland');
  assert.deepEqual(fromWikidata({}), []); assert.deepEqual(fromWikidata({ results: { bindings: [{}] } }), []);
  assert.equal(fromWikidata({ results: { bindings: [L({ name: 'Japan', calling: '81', drives: 'left' })] } })[0].idd.root, '+81');
});

test('the card no longer calls the retired REST Countries API', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/country.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /fetch\('https:\/\/restcountries\.com/);
  assert.match(src, /Source: <a href="' \+ esc\(/); assert.match(src, /Wikidata<\/a>/);
});
