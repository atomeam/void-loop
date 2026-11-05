// Keeps the real calls the open-data bot families check against (bots/fx-pairs.js, bots/holidays.js, bots/country-facts.js).
//   node tools/open-data.mjs     fetch Frankfurter, Nager.Date and Wikidata, write bots/open-data.js
// A refused call is kept with its status, so that country's bot fails and the factory files a fix job. Nothing is deleted.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capitalFor, samePlace } from '../void-live-deploy/bots/country-names.js';
import { KNOWN_DAYS } from '../void-live-deploy/bots/holidays.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'void-live-deploy/bots/open-data.js');
const UA = { origin: 'https://a-to-mind.com', 'user-agent': 'Verse bot factory (https://a-to-mind.com/bots/)', accept: 'application/json' };
const YEAR = 2026;

async function get(url, headers, ms = 20000) {
  const r = await fetch(url, { headers: { ...UA, ...headers }, redirect: 'manual', signal: AbortSignal.timeout(ms) });
  const text = await r.text();
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), text, at: new Date().toISOString() };
}
async function retry(fn, times = 3) {
  let last;
  for (let i = 0; i < times; i++) {
    try { last = await fn(); if (last && last.status === 200) return last; } catch (e) { last = { status: 0, cors: null, text: String(e.message || e), at: new Date().toISOString() }; }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last;
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function frankfurter() {
  const url = 'https://api.frankfurter.dev/v1/latest?from=EUR';
  const namesUrl = 'https://api.frankfurter.dev/v1/currencies';
  const [rates, names] = await Promise.all([retry(() => get(url)), retry(() => get(namesUrl))]);
  const body = JSON.parse(rates.text), nameBody = JSON.parse(names.text);
  const rateMap = { EUR: 1, ...body.rates };
  const nameMap = { EUR: 'Euro', ...nameBody };
  for (const k of Object.keys(rateMap)) if (!/^[A-Z]{3}$/.test(k)) { delete rateMap[k]; delete nameMap[k]; }
  for (const k of Object.keys(nameMap)) if (!rateMap[k]) delete nameMap[k];
  return { at: rates.at, url, status: rates.status === 200 && names.status === 200 ? 200 : rates.status, cors: rates.cors, date: body.date, names: nameMap, rates: rateMap };
}

async function holidays() {
  const listUrl = 'https://date.nager.at/api/v3/AvailableCountries';
  const list = await retry(() => get(listUrl));
  const countries = JSON.parse(list.text);
  const rows = await pool(countries, 6, async (c) => {
    const url = 'https://date.nager.at/api/v3/PublicHolidays/' + YEAR + '/' + c.countryCode;
    const r = await retry(() => get(url));
    let days = [];
    if (r.status === 200) {
      try {
        const seen = new Set();
        for (const h of JSON.parse(r.text)) {
          if (!h || !h.date || seen.has(h.date)) continue;
          seen.add(h.date);
          days.push([h.date, h.name || h.localName]);
        }
        days.sort((a, b) => a[0].localeCompare(b[0]));
      } catch (_) { days = []; }
    }
    return { code: c.countryCode, name: c.name, status: r.status, at: r.at, cors: r.cors, days };
  });
  const by = {};
  for (const r of rows) by[r.code] = { name: r.name, status: r.status, at: r.at, days: r.days };
  const cors = rows.every((r) => r.status !== 200 || r.cors === '*') && list.cors === '*' ? '*' : null;
  return { at: list.at, year: YEAR, status: list.status, cors, countries: by, failed: rows.filter((r) => r.status !== 200).map((r) => r.code + ':' + r.status) };
}

async function sparql(query) {
  const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { ...UA, accept: 'application/sparql-results+json', 'content-type': 'application/sparql-query' }, body: query, signal: AbortSignal.timeout(40000) });
  const text = await r.text();
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), json: r.status === 200 ? JSON.parse(text) : null, at: new Date().toISOString() };
}
async function countries() {
  const codesQ = 'SELECT DISTINCT ?code WHERE { ?c wdt:P31 wd:Q6256; wdt:P297 ?code. FILTER(REGEX(?code, "^[A-Z]{2}$")) }';
  const codesRes = await retry(() => sparql(codesQ));
  const codes = [...new Set((codesRes.json.results.bindings || []).map((b) => b.code.value))].sort();
  const batches = [];
  for (let i = 0; i < codes.length; i += 25) batches.push(codes.slice(i, i + 25));
  const detail = 'SELECT ?code ?name ?capital ?currency ?continent WHERE { VALUES ?code { CODES } ?c wdt:P31 wd:Q6256; wdt:P297 ?code; rdfs:label ?name. FILTER(LANG(?name)="en") OPTIONAL { ?c wdt:P36 ?cap. ?cap rdfs:label ?capital. FILTER(LANG(?capital)="en") } OPTIONAL { ?c wdt:P38 ?cur. ?cur rdfs:label ?currency. FILTER(LANG(?currency)="en") } OPTIONAL { ?c wdt:P30 ?cont. ?cont rdfs:label ?continent. FILTER(LANG(?continent)="en") } }';
  const parts = await pool(batches, 3, async (batch) => {
    const q = detail.replace('CODES', batch.map((c) => '"' + c + '"').join(' '));
    const r = await retry(() => sparql(q));
    return r.status === 200 ? r.json.results.bindings : [];
  });
  const entities = new Map();
  for (const b of parts.flat()) {
    const code = b.code.value, name = b.name.value;
    const byName = entities.get(code) || new Map();
    const e = byName.get(name) || { capitals: new Set(), currencies: new Set(), continents: new Set() };
    if (b.capital) e.capitals.add(b.capital.value);
    if (b.currency) e.currencies.add(b.currency.value);
    if (b.continent) e.continents.add(b.continent.value);
    byName.set(name, e); entities.set(code, byName);
  }
  const rows = {}, missed = [];
  for (const code of codes) {
    const byName = entities.get(code);
    if (!byName) { missed.push(code); continue; }
    let best = null, bestScore = -1e9;
    for (const [name, e] of byName) {
      const known = capitalFor(name);
      let s = (known && [...e.capitals].some((c) => samePlace(c, known.capital)) ? 20 : known ? 5 : 0) + (e.capitals.size ? 2 : 0) + (e.continents.size ? 1 : 0) - name.length / 1000;
      if (s > bestScore) { bestScore = s; best = { name, e }; }
    }
    rows[code] = { name: best.name, capitals: [...best.e.capitals].sort(), currencies: [...best.e.currencies].sort(), continents: [...best.e.continents].sort() };
  }
  return { at: codesRes.at, url: 'https://query.wikidata.org/sparql', status: codesRes.status, cors: codesRes.cors, rows, missed };
}

function js(name, value) {
  return 'export const ' + name + ' = ' + JSON.stringify(value) + ';\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [fx, hol, geo] = await Promise.all([frankfurter(), holidays(), countries()]);
  const failed = hol.failed || [];
  writeFileSync(OUT, '// Real calls kept by tools/open-data.mjs (Frankfurter MIT, Nager.Date MIT, Wikidata CC0). Regenerate, do not edit.\n' + js('FX', { at: fx.at, url: fx.url, status: fx.status, cors: fx.cors, date: fx.date, names: fx.names, rates: fx.rates }) + js('HOLIDAYS', { at: hol.at, year: hol.year, status: hol.status, cors: hol.cors, countries: hol.countries }) + js('COUNTRIES', { at: geo.at, url: geo.url, status: geo.status, cors: geo.cors, rows: geo.rows }));
  console.log('fx', fx.status, 'cors', fx.cors, 'date', fx.date, 'codes', Object.keys(fx.rates).length);
  console.log('holidays', hol.status, 'countries', Object.keys(hol.countries).length, 'failed', failed.join(' ') || 'none');
  console.log('wikidata', geo.status, 'cors', geo.cors, 'rows', Object.keys(geo.rows).length, 'missed', (geo.missed || []).join(' ') || 'none');
  for (const [code, days] of Object.entries(KNOWN_DAYS)) {
    const row = hol.countries[code];
    for (const [d, name] of days) {
      const got = row && (row.days.find((x) => x[0] === d) || [])[1];
      if (got !== name) console.log('KNOWN mismatch', code, d, 'hand', JSON.stringify(name), 'api', JSON.stringify(got));
    }
  }
  let capitalMiss = 0;
  for (const [code, row] of Object.entries(geo.rows)) {
    const known = capitalFor(row.name);
    if (known && !row.capitals.some((c) => samePlace(c, known.capital))) { capitalMiss++; console.log('capital mismatch', code, row.name, 'list', known.capital, 'wikidata', row.capitals.join(' | ')); }
  }
  console.log('capital mismatches', capitalMiss);
}
