// Independent-check bots (owner, 2026-11-04: Verse's own bots, each from ones it has, live only after a real test). Each one checks
// another bot's answer by a second road that does not go through that bot: a unit converter through a third unit (mi-to-km checked by
// mi-to-m then m-to-km), a base converter through the engine's own parseInt, a phrasebook through a pivot language, a date or data
// format through a middle format, a cipher by the opposite shift, and two free APIs against each other (two currency feeds, three map
// sources, two dictionaries). Give it "input => answer" to check a claim, or just the input to check the bot's own answer.
// Checks per checker: it agrees with the real bot on real inputs, it catches a planted wrong answer, and its road skips the bot.
import { book } from './lang-pairs.js';
import { APIS, read, askAt } from './api-bots.js';
import KEPT from './api-fixtures.js';
const num = (s) => parseFloat(String(s).replace(/,/g, '')), close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const bump = (s) => String(s).replace(/-?\d+(\.\d+)?(e[+-]?\d+)?/i, (n) => String(+n * 1.01 + 1));
const alts = (s) => String(s).split(/\s*\/\s*|,\s*/).map((x) => x.trim().toLowerCase());

/** one checker bot for `target`, through the bots in `path` (each output feeds the next) */
function checker(target, path, { same, samples, wrong, family }) {
  const ids = path.map((b) => (b ? b.id : '(missing)'));
  const via = (x) => path.reduce((v, b) => b.run(v), x);
  const judge = (x, claim) => { const v = via(x); return same(claim, v) ? 'agrees (via ' + ids.join(' then ') + ': ' + v + ')' : 'disagrees: ' + target.id + ' answered ' + claim + ', but via ' + ids.join(' then ') + ': ' + v; };
  return { id: 'check-' + target.id, cat: 'checks', family: 'independent checks/' + family, job: 'Checks ' + target.id + ' by another road: ' + ids.join(' then '), from: ['bots/claim-checker', 'skills/witness-claims.js'], path: ids, sample: samples[0],
    run: (s) => { const [x, claim] = String(s).split('=>').map((t) => t.trim()); return judge(x, claim === undefined ? String(target.run(x)) : claim); },
    checks: [
      ['agrees with the bot on real inputs', () => samples.every((x) => same(String(target.run(x)), via(x)))],
      ['catches a planted wrong answer', () => samples.every((x) => !same(wrong(String(target.run(x)), x), via(x)))],
      ['its road skips the bot', () => path.length >= 2 && path.every((b) => b && b.id !== target.id)],
    ] };
}
/** a checker for every unit, temperature, base, cipher, data-format, date-format and phrasebook bot in `all`, plus the API cross-checks */
export function crossChecks(all) {
  const by = new Map(all.map((b) => [b.id, b])), out = [], fam = (f) => all.filter((b) => b.family && (b.family === f || b.family.startsWith(f + '/')));
  const numeric = { same: (c, v) => close(num(c), num(v)), wrong: bump };
  for (const b of fam('units')) {
    const temp = b.family === 'units/temperature', [, a, z] = temp ? b.id.match(/^temp-(\w+)-to-(\w+)$/) : b.id.match(/^(.+)-to-(.+)$/);
    const units = [...new Set(all.filter((x) => x.family === b.family).map((x) => (temp ? x.id.match(/^temp-(\w+)-to/)[1] : x.id.split('-to-')[0])))], mid = units.find((u) => u !== a && u !== z);
    const p = temp ? ['temp-' + a + '-to-' + mid, 'temp-' + mid + '-to-' + z] : [a + '-to-' + mid, mid + '-to-' + z];
    out.push(checker(b, p.map((id) => by.get(id)), { ...numeric, samples: temp ? ['-40', '37', '451'] : ['1', '7.5', '1234'], family: 'units' }));
  }
  for (const b of fam('number bases')) {
    const [, a, z] = b.id.match(/^base(\d+)-to-base(\d+)$/).map(Number), engine = (r) => ({ id: 'parseInt-base' + r, run: (s) => String(parseInt(s, r)) }), toZ = { id: 'toString-base' + z, run: (s) => Number(s).toString(z) };
    out.push(checker(b, [engine(a), toZ], { same: (c, v) => c === v, wrong: (c) => (c === '1' ? '10' : '1' + c), samples: [(255).toString(a), (987654321).toString(a), (2 ** 40 + 7).toString(a)], family: 'number bases' }));
  }
  for (const b of fam('ciphers')) {
    const [, n, dir] = b.id.match(/^caesar-(\d+)-(encode|decode)$/), other = by.get('caesar-' + (26 - n) + '-' + (dir === 'encode' ? 'decode' : 'encode'));
    out.push(checker(b, [other, { id: 'as-is', run: (s) => s }], { same: (c, v) => c === v, wrong: (c) => c.replace(/[a-z]/i, (ch) => (ch.toLowerCase() === 'q' ? 'r' : 'q')), samples: ['Hello, Verse 42!', 'attack at dawn', 'Zebra'], family: 'ciphers' }));
  }
  const middle = (b, f, mids, samples, same, wrong) => { const [, a, z] = b.id.match(/^(?:date-)?(\w+)-to-(\w+)$/), pre = f === 'date formats' ? 'date-' : '', m = mids.find((x) => x !== a && x !== z); out.push(checker(b, [by.get(pre + a + '-to-' + m), by.get(pre + m + '-to-' + z)], { same, wrong, samples, family: f })); };
  const rows = [{ name: 'Ava', city: 'Lakeland' }, { name: 'Bo', city: 'Tampa' }], fmt = { json: JSON.stringify(rows), csv: 'name,city\nAva,Lakeland\nBo,Tampa', tsv: 'name\tcity\nAva\tLakeland\nBo\tTampa', ndjson: rows.map((r) => JSON.stringify(r)).join('\n') };
  for (const b of fam('data formats')) { const a = b.id.split('-to-')[0], src = fmt[a] || by.get('json-to-' + a).run(fmt.json); middle(b, 'data formats', ['json', 'csv', 'tsv'], [src], (c, v) => c === v, (c) => c.replace('Lakeland', 'Lakelnd')); }
  const d0 = { iso: '2026-11-04', us: '11/04/2026', eu: '04.11.2026', unix: '1793750400', compact: '20261104', julian: '2461348.5' }, d1 = { iso: '1999-12-31', us: '12/31/1999', eu: '31.12.1999', unix: '946598400', compact: '19991231', julian: '2451543.5' };
  for (const b of fam('date formats')) { const a = b.id.match(/^date-(\w+)-to/)[1]; middle(b, 'date formats', ['iso', 'unix', 'us'], [d0[a], d1[a]], (c, v) => c === v, (c) => c.replace(/\d(?=\D*$)/, (x) => String((+x + 1) % 10))); }
  for (const b of fam('language pairs')) {
    const [, a, z] = b.id.match(/^phrase-(\w+)-to-(\w+)$/), m = ['en', 'es', 'fr'].find((x) => x !== a && x !== z);
    out.push(checker(b, [by.get('phrase-' + a + '-to-' + m), by.get('phrase-' + m + '-to-' + z)], { same: (c, v) => alts(c).some((x) => alts(v).includes(x)), wrong: () => book(z).words['day:tuesday'], samples: ['day:monday', 'month:7', 'country:JP'].map((k) => book(a).words[k]), family: 'language pairs' }));
  }
  return [...out, ...apiChecks()];
}
// two free APIs against each other: the kept real replies must agree, and a planted wrong value must be caught
const A = (id) => APIS.find((x) => x.id === id), pickKept = (id, f) => f(KEPT[id].body);
const PAIRS = [
  { id: 'fx-two-feeds', job: 'Checks the ECB rate (Frankfurter) against the ExchangeRate-API rate, within 3%', a: 'fx-ecb', b: 'fx-open', fa: (j, q) => Object.values(j.rates)[0], fb: (j, q) => j.rates[String(q).trim().split(/\W+/)[1].toUpperCase()], same: (x, y) => close(x, y, 0.03), sample: 'USD EUR' },
  { id: 'place-two-maps', job: 'Checks Open-Meteo\'s coordinates for a place against OpenStreetMap\'s, within 0.1°', a: 'place-finder', b: 'osm-geocode', fa: (j) => [j.results[0].latitude, j.results[0].longitude], fb: (j) => [+j[0].lat, +j[0].lon], same: (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1]) < 0.1, sample: 'Lakeland', qb: (q) => q + ' FL' },
  { id: 'zip-vs-map', job: 'Checks a postal code\'s coordinates (Zippopotam.us) against Open-Meteo\'s for its town, within 0.2°', a: 'zip-lookup', b: 'place-finder', fa: (j) => [+j.places[0].latitude, +j.places[0].longitude], fb: (j) => [j.results[0].latitude, j.results[0].longitude], same: (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1]) < 0.2, sample: '33801', qb: () => 'Lakeland' },
  { id: 'ip-two-sources', job: 'Checks an IP address\'s country in ipapi.co against country.is', a: 'ip-locate', b: 'ip-country', fa: (j) => j.country, fb: (j) => j.country, same: (x, y) => x === y, sample: '8.8.8.8' },
  { id: 'define-two-dictionaries', job: 'Checks a word\'s part of speech in the Free Dictionary against Wiktionary', a: 'define-word', b: 'wiktionary-define', fa: (j) => j[0].meanings[0].partOfSpeech.toLowerCase(), fb: (j) => j.en[0].partOfSpeech.toLowerCase(), same: (x, y) => x === y, sample: 'serendipity' },
  { id: 'town-two-sources', job: 'Checks the National Weather Service\'s nearest town against Open-Meteo\'s place name', a: 'nws-point', b: 'place-finder', fa: (j) => j.properties.relativeLocation.properties.city, fb: (j) => j.results[0].name, same: (x, y) => x === y, sample: '28.04, -81.95', qb: () => 'Lakeland' },
];
const plant = (v) => (Array.isArray(v) ? v.map((x) => x + 1) : typeof v === 'number' ? v * 1.1 : 'not-' + v);
function apiChecks() {
  return PAIRS.map((p) => ({ id: 'check-' + p.id, cat: 'checks', family: 'independent checks/two sources', job: p.job + ' (live)', from: ['bots/claim-checker', 'skills/witness-claims.js'], path: ['api-' + p.a, 'api-' + p.b], sample: p.sample,
    run: async (q) => { const get = async (id, x) => { const r = await fetch(askAt(A(id), x)); if (!r.ok) throw new Error(A(id).name + ' answered ' + r.status); return r.json(); }; const qb = p.qb ? p.qb(q) : q, x = p.fa(await get(p.a, q), q), y = p.fb(await get(p.b, qb), q); return (p.same(x, y) ? 'agrees: ' : 'disagrees: ') + A(p.a).name + ' ' + JSON.stringify(x) + ', ' + A(p.b).name + ' ' + JSON.stringify(y); },
    checks: [
      ['both kept real calls agree', () => p.same(pickKept(p.a, (j) => p.fa(j, p.sample)), pickKept(p.b, (j) => p.fb(j, p.sample)))],
      ['catches a planted wrong value', () => !p.same(plant(pickKept(p.a, (j) => p.fa(j, p.sample))), pickKept(p.b, (j) => p.fb(j, p.sample)))],
      ['both sources are live bots', () => [p.a, p.b].every((id) => KEPT[id] && KEPT[id].status === 200 && A(id).url(id === p.b && p.qb ? p.qb(p.sample) : p.sample) === KEPT[id].url)],
    ] }));
}
