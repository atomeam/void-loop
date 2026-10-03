// The everyday benchmark: common asks replayed on the real page. tools/bench.json says what should answer each one (`want`, a
// note from the page's own log a2m.void.loop.v1, alternatives with |). The score is how many are answered by what should answer
// them; growth is that score going up. External services are stubbed with plausible data: this measures Void, not their uptime.
//   node tools/bench.mjs            prints each ask and what answered it, then the totals
//   node tools/bench.mjs --score    prints only {"score","total","wrong":[...]} (the tests read this; tools/bench.best.json is the floor)
//   node tools/bench.mjs --last 10  replays only the last 10 asks (fast while growing a new round; the score and floor use all)
// Asks run BENCH_PAR at a time (default 6), each in its own browser context, so the order and the result don't change;
// each waits until the page has logged its answer (at least 1.6 s, at most 4 s), so a busy machine doesn't miss one.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..', 'void-live-deploy');
const asks = JSON.parse(fs.readFileSync(path.join(here, 'bench.json'), 'utf8'));
// A repeated ask would count twice and inflate the score: refuse it.
{ const seen = new Set(), dup = asks.map((a) => a.ask.toLowerCase()).filter((k) => seen.has(k) || !seen.add(k));
  if (dup.length) { console.error('bench.json repeats: ' + dup.join(' | ')); process.exit(1); } }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); }).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const json = (b) => ({ contentType: 'application/json', body: JSON.stringify(b) });
const lastN = process.argv.includes('--last') ? Math.max(1, parseInt(process.argv[process.argv.indexOf('--last') + 1], 10) || 10) : 0;
const todo = lastN ? asks.slice(-lastN) : asks, out = new Array(todo.length);
async function one({ ask: a, want }) {
  const ctx = await browser.newContext(); const miss = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url();
    if (u.includes('/w/api.php')) return r.fulfill(json({ query: { search: [{ title: 'Topic' }] } }));
    if (u.includes('/page/summary/')) return r.fulfill(json({ title: 'Topic', extract: 'An extract.' }));
    if (u.includes('geocoding-api.open-meteo.com')) return r.fulfill(json({ results: [{ name: 'Paris', country: 'France', country_code: 'FR', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris', population: 2100000 }] }));
    if (u.includes('air-quality-api.open-meteo.com')) return r.fulfill(json({ current: { time: '2026-10-03T12:00', us_aqi: 42, european_aqi: 25, pm2_5: 10.2, pm10: 18.0, ozone: 55, nitrogen_dioxide: 12, sulphur_dioxide: 3, carbon_monoxide: 140, us_aqi_pm2_5: 42, us_aqi_pm10: 16, us_aqi_ozone: 18, us_aqi_nitrogen_dioxide: 11, us_aqi_sulphur_dioxide: 2, us_aqi_carbon_monoxide: 2 } }));
    if (u.includes('api.open-meteo.com')) { const d = new Date().toISOString().slice(0, 10);
      return r.fulfill(json({ timezone: 'Europe/Paris', current: { temperature_2m: 20, apparent_temperature: 19, weather_code: 1, wind_speed_10m: 5, relative_humidity_2m: 50 },
        daily: { time: [d, d], temperature_2m_max: [24, 23], temperature_2m_min: [15, 14], precipitation_probability_max: [10, 20], weather_code: [1, 2], sunrise: [d + 'T07:00', d + 'T07:01'], sunset: [d + 'T19:30', d + 'T19:29'] },
        hourly: { time: Array.from({ length: 24 }, (_, i) => d + 'T' + String(i).padStart(2, '0') + ':00'), temperature_2m: Array(24).fill(20), precipitation_probability: Array(24).fill(5), weather_code: Array(24).fill(1) } })); }
    if (u.includes('wiktionary.org')) return r.fulfill(json({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'A happy accident.' }] }] }));
    if (u.includes('translate.googleapis.com')) return r.fulfill(json([[['hola', 'hello']]]));
    if (u.includes('api.datamuse.com/sug')) return r.fulfill(json([{ word: 'necessary', score: 1 }]));
    if (u.includes('api.datamuse.com')) return r.fulfill(json([{ word: 'glad' }, { word: 'joyful' }, { word: 'cheerful' }, { word: 'content' }]));
    if (u.includes('restcountries.com')) return r.fulfill(json([{ name: { common: 'Australia', official: 'Commonwealth of Australia' }, capital: ['Canberra'], population: 25687041, currencies: { AUD: { name: 'Australian dollar', symbol: '$' } }, languages: { eng: 'English' }, area: 7692024, flag: '🇦🇺', region: 'Oceania', subregion: 'Australia and New Zealand' }]));
    if (u.includes('icanhazdadjoke.com')) return r.fulfill(json({ id: 'x1', joke: 'I only know 25 letters of the alphabet. I don\'t know y.' }));
    if (u.includes('themealdb.com')) return r.fulfill(json({ meals: [{ idMeal: '1', strMeal: 'Pancakes', strArea: 'American', strCategory: 'Dessert', strInstructions: 'Mix.\nCook.', strIngredient1: 'Flour', strMeasure1: '100g' }] }));
    if (u.includes('api.coingecko.com')) return r.fulfill(json({ bitcoin: { usd: 65000, usd_24h_change: 1.2, last_updated_at: 1700000000 } }));
    if (u.includes('hn.algolia.com')) return r.fulfill(json({ hits: [{ objectID: '1', title: 'A thing shipped', url: 'https://example.com/a', points: 120 }] }));
    if (u.includes('/feed/featured/')) return r.fulfill(json({ news: [{ story: '<b>Something</b> happened today.', links: [] }] }));
    return r.fulfill({ status: 204, body: '' }); });
  await ctx.route(/127\.0\.0\.1:\d+\/api\//, (r) => { const u = r.request().url(); if (/\/api\/miss$/.test(u)) miss.push(1);
    if (/\/api\/answer$/.test(u)) return r.fulfill(json({ answer: 'A generic answer.', sources: [] }));
    return r.fulfill({ status: 204, body: '' }); });
  const p = await ctx.newPage(); await p.goto(base); await p.waitForTimeout(600);
  await p.fill('#input', a); await p.keyboard.press('Enter'); await p.waitForTimeout(1600);
  const said = await p.$eval('#whisper', (e) => e.textContent).catch(() => ''); // read before it fades
  await p.waitForFunction((q) => JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]').some((x) => x.ask === q), a, { timeout: 2400 }).catch(() => {});
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'));
  const last = log.filter((x) => x.ask === a).pop();
  const note = last ? String(last.note || '') : (said && !miss.length ? 'said' : '');
  const right = !miss.length && new RegExp('^(' + want + ')').test(note);
  await ctx.close();
  return { ask: a, want, by: note || '(none)', right };
}
const PAR = Math.max(1, parseInt(process.env.BENCH_PAR, 10) || 6);
let next = 0;
await Promise.all(Array.from({ length: Math.min(PAR, todo.length) }, async () => { while (next < todo.length) { const i = next++; out[i] = await one(todo[i]); } }));
await browser.close(); server.close();
if (process.argv.includes('--score')) { console.log(JSON.stringify({ score: out.filter((x) => x.right).length, total: out.length, wrong: out.filter((x) => !x.right).map((x) => x.ask + ' -> ' + x.by) })); process.exit(0); }
for (const x of out) console.log((x.right ? '  ok  ' : ' ---- ') + x.ask.padEnd(42) + (x.by + (x.right ? '' : '   (wants ' + x.want + ')')));
const n = out.filter((x) => x.right).length;
console.log('\n' + n + ' of ' + out.length + ' answered by what should answer them.');
if (process.argv.includes('--json')) fs.writeFileSync(path.join(here, 'bench.last.json'), JSON.stringify(out, null, 1));
