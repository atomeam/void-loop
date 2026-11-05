// Open-data bot families (bots/fx-pairs.js, bots/holidays.js, bots/country-facts.js). Every bot is checked against a
// real call kept by tools/open-data.mjs, and one live call per source confirms the kept copy still matches.
// A bot that fails stays in the family and becomes a fix job. Run: node --test tools/open-data.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FX } from '../void-live-deploy/bots/open-data.js';
import { fxPairs, crossRate } from '../void-live-deploy/bots/fx-pairs.js';
import { holidayBots, holidayOn } from '../void-live-deploy/bots/holidays.js';
import { countryFacts, capitalLine, countryRow } from '../void-live-deploy/bots/country-facts.js';
import { placeName, settleCapitals, samePlace } from '../void-live-deploy/bots/country-names.js';
import { check } from '../void-live-deploy/bots/families.js';
import { familyRows, fixJobs } from './bot-factory.mjs';

const UA = { origin: 'https://a-to-mind.com', 'user-agent': 'Verse bot factory (https://a-to-mind.com/bots/)' };

test('a missing English label takes the Wikipedia sitelink, and a dated hand-over names both capitals', () => {
  assert.deepEqual(placeName('', "St. John's, Antigua and Barbuda"), { name: "St. John's", via: 'enwiki' });
  assert.equal(placeName('Paris', 'Paris, France').name, 'Paris');
  assert.equal(placeName('', 'Washington, D.C.').name, 'Washington, D.C.');
  assert.equal(samePlace("St. John's", "Saint John's"), true);
  assert.equal(samePlace('Stanley', 'Saint Anley'), false);
  const ag = settleCapitals([{ en: '', wiki: "St. John's, Antigua and Barbuda", rank: 'NormalRank' }]);
  assert.deepEqual(ag.capitals, ["St. John's"]);
  assert.deepEqual(ag.fallback, ["St. John's"]);
  const gq = settleCapitals([
    { en: 'Ciudad de la Paz', rank: 'PreferredRank', start: '2026-01-03T00:00:00Z' },
    { en: 'Malabo', rank: 'NormalRank', start: '1968-10-12T00:00:00Z', end: '2026-01-03T00:00:00Z' },
  ]);
  assert.deepEqual(gq.capitals, ['Ciudad de la Paz']);
  assert.deepEqual(gq.ended, [{ name: 'Malabo', until: '2026-01-03' }]);
  assert.equal(capitalLine({ capitals: gq.capitals, ended: gq.ended }), 'Ciudad de la Paz (since 2026-01-03; Malabo until 2026-01-03)');
  const fr = settleCapitals([{ en: 'Paris', rank: 'PreferredRank' }, { en: 'London', rank: 'DeprecatedRank', end: '1436-01-01' }]);
  assert.deepEqual(fr.capitals, ['Paris']);
  assert.deepEqual(fr.ended, []);
});

test('currency, holiday and country families pass, including Antigua and Equatorial Guinea', () => {
  const fx = fxPairs(), hol = holidayBots(), geo = countryFacts();
  assert.equal(fx.length, 30 * 29);
  assert.equal(hol.length, 204);
  assert.equal(geo.length, 201);
  assert.equal(new Set([...fx, ...hol, ...geo].map((b) => b.id)).size, fx.length + hol.length + geo.length);
  assert.deepEqual(fx.filter((b) => !check(b).ok).map((b) => b.id), []);
  assert.deepEqual(hol.filter((b) => !check(b).ok).map((b) => b.id), []);
  assert.deepEqual(geo.filter((b) => !check(b).ok).map((b) => b.id).sort(), []);
  assert.equal(geo.find((b) => b.id === 'country-ag').run('capital'), "St. John's");
  assert.deepEqual(countryRow('AG').fallback, ["St. John's"]);
  assert.equal(geo.find((b) => b.id === 'country-gq').run('capital'), 'Ciudad de la Paz (since 2026-01-03; Malabo until 2026-01-03)');
  assert.equal(fx.find((b) => b.id === 'fx-eur-to-usd').run('1'), (+crossRate('EUR', 'USD').toPrecision(10)) + ' USD');
  assert.ok(crossRate('EUR', 'USD') > 0.5 && crossRate('EUR', 'USD') < 2.5);
  assert.equal(holidayOn('US', '2026-12-25'), 'Christmas Day');
  assert.equal(holidayOn('US', '2026-07-03'), 'Independence Day');
  assert.equal(holidayOn('FR', '2026-07-14'), 'Bastille Day');
  assert.equal(geo.find((b) => b.id === 'country-fr').run('capital'), 'Paris (since 1789-10-05; Versailles until 1789-10-05)');
  assert.equal(samePlace(geo.find((b) => b.id === 'country-fr').run('capital'), 'Paris'), true);
  assert.equal(geo.find((b) => b.id === 'country-us').run('capital'), 'Washington, D.C.');
  assert.match(geo.find((b) => b.id === 'country-fr').run('currency'), /euro/i);
  assert.equal(geo.find((b) => b.id === 'country-jp').run('continent'), 'Asia');
  assert.deepEqual(fixJobs([], familyRows(geo)), []);
  const credits = JSON.parse(readFileSync(new URL('../void-live-deploy/bots/credits.json', import.meta.url), 'utf8'));
  for (const name of ['Frankfurter', 'Nager.Date', 'Wikidata']) assert.ok(credits.some((c) => c.name === name), name);
});

test('a live Frankfurter, Nager.Date and Wikidata call still agrees with the kept copy', async () => {
  const fx = await fetch(FX.url, { headers: UA, signal: AbortSignal.timeout(20000) });
  assert.equal(fx.headers.get('access-control-allow-origin'), '*');
  assert.equal(fx.status, 200);
  const body = await fx.json();
  assert.ok(Math.abs(body.rates.USD / FX.rates.USD - 1) < 0.08, 'the dollar moved more than 8% against the kept ECB rate; run node tools/open-data.mjs');
  const hol = await fetch('https://date.nager.at/api/v3/PublicHolidays/2026/US', { headers: UA, signal: AbortSignal.timeout(20000) });
  assert.equal(hol.status, 200);
  assert.equal(hol.headers.get('access-control-allow-origin'), '*');
  const days = await hol.json();
  assert.ok(days.some((h) => h.date === '2026-12-25' && h.name === 'Christmas Day'));
  assert.ok(days.some((h) => h.name === 'Independence Day' && (h.date === '2026-07-03' || h.date === '2026-07-04' || h.date === '2026-07-05')));
  const wd = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { ...UA, accept: 'application/sparql-results+json', 'content-type': 'application/sparql-query' }, body: 'SELECT ?capital WHERE { wd:Q142 wdt:P36 ?cap. ?cap rdfs:label ?capital. FILTER(LANG(?capital)="en") }', signal: AbortSignal.timeout(20000) });
  assert.equal(wd.status, 200);
  const caps = (await wd.json()).results.bindings.map((b) => b.capital.value);
  assert.ok(caps.includes('Paris'), caps.join(', '));
});
