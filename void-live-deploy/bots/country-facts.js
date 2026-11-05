// Country-fact bots, one per sovereign state Wikidata lists (CC0). tools/open-data.mjs keeps one real SPARQL read.
// The capital is checked against the built-in list in skills/country.js, which does not come from that read: when the
// list names a capital, Wikidata's capitals have to include it. Currency is Wikidata's, narrowed to that list when
// Wikidata also has it (France lists the euro and the CFP franc; the bot says euro).
import { COUNTRIES } from './open-data.js';
import { capitalFor, shownCurrencies, samePlace } from './country-names.js';

const HAND_CONTINENT = { US: 'North America', CA: 'North America', MX: 'North America', BR: 'South America', FR: 'Europe', DE: 'Europe', GB: 'Europe', IT: 'Europe', JP: 'Asia', CN: 'Asia', IN: 'Asia', EG: 'Africa', ZA: 'Africa', AU: 'Oceania' };

export function countryRow(code) {
  return COUNTRIES.rows && COUNTRIES.rows[String(code || '').toUpperCase()];
}
/** the capital the independent check expects: the built-in one, else Wikidata's first */
export function capitalRoad(code) {
  const row = countryRow(code);
  if (!row) return '';
  const known = capitalFor(row.name);
  return known ? known.capital : (row.capitals || []).slice().sort((a, b) => a.localeCompare(b))[0] || '';
}
function answer(row, s) {
  const t = String(s || '').toLowerCase();
  const caps = (row.capitals || []).slice().sort((a, b) => a.localeCompare(b));
  const cur = shownCurrencies(row.name, row.currencies || []);
  const cont = (row.continents || []).slice().sort((a, b) => a.localeCompare(b)).join(', ');
  if (/currenc|money/.test(t)) return cur.join(', ') || 'none';
  if (/continent/.test(t)) return cont || 'none';
  if (/capital/.test(t) || !t || t === 'facts') return caps.join(', ') || 'none';
  return row.name + ' · capital ' + (caps.join(', ') || 'none') + ' · currency ' + (cur.join(', ') || 'none') + ' · continent ' + (cont || 'none');
}

export function countryFacts() {
  const out = [];
  for (const [code, row] of Object.entries(COUNTRIES.rows || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const known = capitalFor(row.name), hand = HAND_CONTINENT[code];
    const caps = row.capitals || [];
    const checks = [
      ['kept a real Wikidata call', () => COUNTRIES.status === 200 && COUNTRIES.cors === '*' && /^\d{4}-\d\d-\d\d/.test(COUNTRIES.at) && row.name && Array.isArray(caps)],
      ['has a capital', () => caps.length > 0 && caps.every((c) => typeof c === 'string' && c.length > 1)],
    ];
    if (known) checks.push(['known capital', () => caps.some((c) => samePlace(c, known.capital))]);
    if (hand) checks.push(['known continent', () => (row.continents || []).includes(hand)]);
      out.push({ id: 'country-' + code.toLowerCase(), cat: 'places', family: 'country facts', job: row.name + ': capital, currency and continent (Wikidata)', from: ['skills/country.js'], sample: 'capital',
      run: (s) => answer(row, s), checks });
  }
  return out;
}
