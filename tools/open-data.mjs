// Keeps the real calls the open-data bot families check against (bots/fx-pairs.js, bots/holidays.js, bots/country-facts.js).
//   node tools/open-data.mjs        fetch Frankfurter, Nager.Date and Wikidata, write bots/open-data.js
//   node tools/open-data.mjs --geo  refresh only the Wikidata country rows, leaving the kept rates and holidays
// A refused call is kept with its status, so that country's bot fails and the factory files a fix job. Nothing is deleted.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capitalFor, samePlace, settleCapitals } from '../void-live-deploy/bots/country-names.js';
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
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), json: r.status === 200 ? JSON.parse(text) : null, text: r.status === 200 ? '' : text.slice(0, 200), at: new Date().toISOString() };
}
function countryRows(bindings) {
  const entities = new Map();
  for (const b of bindings) {
    const code = b.code.value, name = b.name.value;
    const byName = entities.get(code) || new Map();
    const e = byName.get(name) || { statements: [], seen: new Set(), currencies: new Set(), continents: new Set() };
    if (b.cap) {
      const key = [b.cap.value, b.rank && b.rank.value, b.start && b.start.value, b.end && b.end.value, b.capital && b.capital.value, b.wiki && b.wiki.value].join('|');
      if (!e.seen.has(key)) {
        e.seen.add(key);
        e.statements.push({ en: b.capital && b.capital.value, wiki: b.wiki && b.wiki.value, rank: ((b.rank && b.rank.value) || '').split('#').pop(), start: b.start && b.start.value, end: b.end && b.end.value });
      }
    }
    if (b.currency) e.currencies.add(b.currency.value);
    if (b.continent) e.continents.add(b.continent.value);
    byName.set(name, e); entities.set(code, byName);
  }
  return entities;
}
async function countries() {
  const codesQ = 'SELECT DISTINCT ?code WHERE { ?c wdt:P31 wd:Q6256; wdt:P297 ?code. FILTER(REGEX(?code, "^[A-Z]{2}$")) }';
  const codesRes = await retry(() => sparql(codesQ));
  const codes = [...new Set((codesRes.json.results.bindings || []).map((b) => b.code.value))].sort();
  const batches = [];
  for (let i = 0; i < codes.length; i += 20) batches.push(codes.slice(i, i + 20));
  // p:P36, not wdt:P36: wdt drops a capital whose item has no English label (the whole OPTIONAL fails) and hides a
  // normal-rank capital once a preferred one exists. The English label is optional; the English Wikipedia sitelink
  // names the item when the label is missing. Rank, start and end say which capital is current.
  const detail = 'SELECT ?code ?name ?cap ?capital ?wiki ?rank ?start ?end ?currency ?continent WHERE { VALUES ?code { CODES } ?c wdt:P31 wd:Q6256; wdt:P297 ?code; rdfs:label ?name. FILTER(LANG(?name)="en") OPTIONAL { ?c wdt:P38 ?cur. ?cur rdfs:label ?currency. FILTER(LANG(?currency)="en") } OPTIONAL { ?c wdt:P30 ?cont. ?cont rdfs:label ?continent. FILTER(LANG(?continent)="en") } OPTIONAL { ?c p:P36 ?st. ?st ps:P36 ?cap. ?st wikibase:rank ?rank. OPTIONAL { ?cap rdfs:label ?capital. FILTER(LANG(?capital)="en") } OPTIONAL { ?wikiS schema:about ?cap; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?wiki. } OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } } }';
  const parts = await pool(batches, 2, async (batch) => {
    const q = detail.replace('CODES', batch.map((c) => '"' + c + '"').join(' '));
    const r = await retry(() => sparql(q));
    console.log('geo', batch[0] + '..' + batch[batch.length - 1], r.status, r.status === 200 ? r.json.results.bindings.length : (r.text || '').slice(0, 180));
    return r.status === 200 ? r.json.results.bindings : [];
  });
  const entities = countryRows(parts.flat());
  const rows = {}, missed = [];
  for (const code of codes) {
    const byName = entities.get(code);
    if (!byName) { missed.push(code); continue; }
    let best = null, bestScore = -1e9, bestSettled = null;
    for (const [name, e] of byName) {
      const settled = settleCapitals(e.statements);
      const known = capitalFor(name);
      const hit = known && settled.capitals.some((c) => samePlace(c, known.capital));
      const s = (hit ? 20 : known ? 5 : 0) + (settled.capitals.length ? 2 : 0) + (e.continents.size ? 1 : 0) - name.length / 1000;
      if (s > bestScore) { bestScore = s; best = { name, e }; bestSettled = settled; }
    }
    const row = { name: best.name, capitals: bestSettled.capitals, currencies: [...best.e.currencies].sort(), continents: [...best.e.continents].sort() };
    if (bestSettled.ended.length) row.ended = bestSettled.ended;
    if (bestSettled.fallback.length) row.fallback = bestSettled.fallback;
    rows[code] = row;
  }
  return { at: codesRes.at, url: 'https://query.wikidata.org/sparql', status: codesRes.status, cors: codesRes.cors, rows, missed };
}

function js(name, value) {
  return 'export const ' + name + ' = ' + JSON.stringify(value) + ';\n';
}
function reportCapitals(rows) {
  let capitalMiss = 0, fallbacks = 0, successions = 0;
  for (const [code, row] of Object.entries(rows)) {
    if (row.fallback) fallbacks++;
    if (row.ended) successions++;
    const known = capitalFor(row.name);
    if (known && !row.capitals.some((c) => samePlace(c, known.capital))) { capitalMiss++; console.log('capital mismatch', code, row.name, 'list', known.capital, 'wikidata', row.capitals.join(' | '), 'ended', (row.ended || []).map((e) => e.name + ' until ' + e.until).join(' | ') || 'none', 'fallback', (row.fallback || []).join(' | ') || 'none'); }
  }
  console.log('capital mismatches', capitalMiss, 'enwiki names', fallbacks, 'successions', successions);
  return capitalMiss;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--geo')) {
    const geo = await countries();
    const text = readFileSync(OUT, 'utf8');
    if (!/^export const COUNTRIES = .*$/m.test(text)) throw new Error('COUNTRIES line missing from ' + OUT);
    const line = 'export const COUNTRIES = ' + JSON.stringify({ at: geo.at, url: geo.url, status: geo.status, cors: geo.cors, rows: geo.rows }) + ';';
    writeFileSync(OUT, text.replace(/^export const COUNTRIES = .*$/m, line));
    console.log('wikidata', geo.status, 'cors', geo.cors, 'rows', Object.keys(geo.rows).length, 'missed', (geo.missed || []).join(' ') || 'none');
    reportCapitals(geo.rows);
  } else {
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
  reportCapitals(geo.rows);
  }
}
