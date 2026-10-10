// The everyday benchmark: common asks replayed on the real page. tools/bench.json says what should answer each one (`want`, a
// note from the page's own log a2m.void.loop.v1, alternatives with |). The score is how many are answered by what should answer
// them (when an ask has "before", those setup asks run first on the same page; and, when an ask has "says", whose visible answer matches that pattern); growth is that score going up. External services are stubbed with plausible data: this measures Void, not their uptime.
//   node tools/bench.mjs            prints each ask and what answered it, then the totals
//   node tools/bench.mjs --score    prints only {"score","total","wrong":[...],"env","cores","pages","latency":{p50,p95,n}} (plus "inconclusive","note" when the machine was under load: tools/bench-load.mjs) (the tests read this; tools/bench.best.json is the floor)
//   node tools/bench.mjs --last 10  replays only the last 10 asks (fast while growing a new round; the score and floor use all)
//   node tools/bench.mjs --probe c.json  tries candidate asks from a file, prints only the misses (bench.json untouched; asks it already has are skipped)
//   node tools/bench.mjs --again         probes only the asks the last --probe missed
//   node tools/bench.mjs --score --fresh  runs even when the cache below says nothing it reads has changed
// A full --score run that reaches the floor (tools/bench.best.json) is remembered under a hash of everything the benchmark
// reads: the files it serves (void-live-deploy, the server functions aside: /api is stubbed), bench.json, this file, the
// browser and today's date (some answers count days). The next --score run with the same hash prints that result at once
// instead of replaying 1900 asks: a change that never touches the page (a server route, a doc, a workflow) costs nothing.
// Only a passing run is remembered, so a failure is never skipped; CI and the weekly watchdog still run the real thing.
// Asks run BENCH_PAR at a time (default 6), each in its own browser context, so the order and the result don't change;
// each waits for the page to log its answer (at most 4 s) and, when an ask has "says", for that value to show (at most 2.5 s more):
// no fixed sleeps, so a fast answer is read at once and a busy machine still doesn't miss one.
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import crypto from 'node:crypto'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { CAPITALS, CURRENCIES } from '../void-live-deploy/skills/country.js';
import { envName, latencyOf, verdict } from './bench-load.mjs';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..', 'void-live-deploy');
// --probe file.json: try candidate asks (same shape) without touching bench.json; prints only the misses, so a big batch
// finds the gaps fast. Add the ones worth keeping with tools/append.mjs once Void answers them.
// --again: probe only the asks the last probe missed (kept outside the repo), so a fix is checked in seconds, not a whole batch
const AGAIN = path.join(os.tmpdir(), 'void-probe-misses-' + crypto.createHash('sha1').update(here).digest('hex').slice(0, 10) + '.json'); // one per checkout
const probeFile = process.argv.includes('--again') ? AGAIN : process.argv.includes('--probe') ? process.argv[process.argv.indexOf('--probe') + 1] : null;
if (probeFile === AGAIN && !fs.existsSync(AGAIN)) { console.log('no misses saved from a last probe: run --probe <file> first'); process.exit(0); }
// BENCH_ASKS and BENCH_BEST point at other files so the tests can replay a few asks against a made-up floor (tools/bench-load.test.mjs)
const BEST = process.env.BENCH_BEST ? path.resolve(process.env.BENCH_BEST) : path.join(here, 'bench.best.json');
let asks = JSON.parse(fs.readFileSync(probeFile ? path.resolve(probeFile) : process.env.BENCH_ASKS ? path.resolve(process.env.BENCH_ASKS) : path.join(here, 'bench.json'), 'utf8'));
// a probe skips asks the benchmark already has (same text, ignoring case): they are answered already and only cost time
if (probeFile) { const have = new Set(JSON.parse(fs.readFileSync(path.join(here, 'bench.json'), 'utf8')).map((x) => x.ask.trim().toLowerCase()));
  const fresh = asks.filter((x) => !have.has(x.ask.trim().toLowerCase())); if (fresh.length < asks.length) console.log((asks.length - fresh.length) + ' already in bench.json, not probed'); asks = fresh; }
// A repeated ask would count twice and inflate the score: refuse it.
{ const seen = new Set(), dup = asks.map((a) => a.ask.toLowerCase()).filter((k) => seen.has(k) || !seen.add(k));
  if (dup.length) { console.error('bench.json repeats: ' + dup.join(' | ')); process.exit(1); } }
// the cache key: every file the benchmark serves or reads, plus the browser and the day
function benchKey() {
  const h = crypto.createHash('sha256');
  const walk = (d) => { for (const n of fs.readdirSync(d).sort()) { const f = path.join(d, n), rel = path.relative(root, f);
    if (rel === 'functions' || n.startsWith('.')) continue;
    if (fs.statSync(f).isDirectory()) walk(f); else { h.update(rel + '\0'); h.update(fs.readFileSync(f)); } } };
  walk(root);
  for (const f of ['bench.json', 'bench.mjs']) h.update(fs.readFileSync(path.join(here, f)));
  h.update(String(exeForKey()) + '\0' + new Date().toISOString().slice(0, 10));
  return h.digest('hex');
}
const exeForKey = () => [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const CACHE = path.join(os.tmpdir(), 'void-bench-pass-' + crypto.createHash('sha1').update(here).digest('hex').slice(0, 10) + '.json'); // one per checkout
const cacheable = process.argv.includes('--score') && !probeFile && !process.argv.includes('--last') && !process.env.BENCH_ASKS;
const key = cacheable ? benchKey() : '';
if (cacheable && !process.argv.includes('--fresh')) { try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  if (c.key === key && c.result) { console.log(JSON.stringify({ ...c.result, cached: c.at })); process.exit(0); } } catch (_) {} }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); }).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const json = (b) => ({ contentType: 'application/json', body: JSON.stringify(b) });
const lastN = process.argv.includes('--last') ? Math.max(1, parseInt(process.argv[process.argv.indexOf('--last') + 1], 10) || 10) : 0;
const todo = lastN ? asks.slice(-lastN) : asks, out = new Array(todo.length);
async function one({ ask: a, want, says, before }) {
  const ctx = await browser.newContext(); const miss = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url();
    if (u.includes('/w/api.php')) return r.fulfill(json({ query: { search: [{ title: 'Topic' }] } }));
    if (u.includes('/page/summary/')) return r.fulfill(json({ title: 'Topic', extract: 'An extract.' }));
    if (u.includes('geocoding-api.open-meteo.com')) return r.fulfill(json({ results: [{ name: 'Paris', country: 'France', country_code: 'FR', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris', population: 2100000 }] }));
    if (u.includes('air-quality-api.open-meteo.com')) return r.fulfill(json({ current: { time: '2026-10-03T12:00', us_aqi: 42, european_aqi: 25, pm2_5: 10.2, pm10: 18.0, ozone: 55, nitrogen_dioxide: 12, sulphur_dioxide: 3, carbon_monoxide: 140, us_aqi_pm2_5: 42, us_aqi_pm10: 16, us_aqi_ozone: 18, us_aqi_nitrogen_dioxide: 11, us_aqi_sulphur_dioxide: 2, us_aqi_carbon_monoxide: 2 } }));
    if (u.includes('api.open-meteo.com')) { const d = new Date().toISOString().slice(0, 10);
      return r.fulfill(json({ timezone: 'Europe/Paris', current: { temperature_2m: 20, apparent_temperature: 19, weather_code: 1, wind_speed_10m: 5, relative_humidity_2m: 50 },
        daily: { time: [d, d], temperature_2m_max: [24, 23], temperature_2m_min: [15, 14], precipitation_probability_max: [10, 20], weather_code: [1, 2], sunrise: [d + 'T07:00', d + 'T07:01'], sunset: [d + 'T19:30', d + 'T19:29'], uv_index_max: [7.2, 7.0] },
        hourly: { time: Array.from({ length: 24 }, (_, i) => d + 'T' + String(i).padStart(2, '0') + ':00'), temperature_2m: Array(24).fill(20), precipitation_probability: Array(24).fill(5), weather_code: Array(24).fill(1), uv_index: Array(24).fill(6.5) } })); }
    if (u.includes('wiktionary.org')) return r.fulfill(json({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'A happy accident.' }] }] }));
    if (u.includes('translate.googleapis.com')) return r.fulfill(json([[['hola', 'hello']]]));
    if (u.includes('api.datamuse.com/sug')) return r.fulfill(json([{ word: 'necessary', score: 1 }]));
    if (u.includes('api.datamuse.com')) return r.fulfill(json([{ word: 'glad' }, { word: 'joyful' }, { word: 'cheerful' }, { word: 'content' }]));
    if (u.includes('restcountries.com')) { // the country asked for, from Void's own built-in lists (Australia in full)
      const n = decodeURIComponent((u.match(/\/name\/([^?]+)/) || [])[1] || '').toLowerCase();
      if (n === 'australia' || !CAPITALS[n]) return r.fulfill(json([{ name: { common: 'Australia', official: 'Commonwealth of Australia' }, capital: ['Canberra'], population: 25687041, currencies: { AUD: { name: 'Australian dollar', symbol: '$' } }, languages: { eng: 'English' }, area: 7692024, flag: '🇦🇺', region: 'Oceania', subregion: 'Australia and New Zealand' }]));
      const t = n.replace(/\b\w/g, (x) => x.toUpperCase());
      return r.fulfill(json([{ name: { common: t, official: t }, capital: [CAPITALS[n]], population: 1000000, currencies: CURRENCIES[n] ? { X: { name: CURRENCIES[n] } } : {}, languages: { x: 'Local' }, area: 100000, flag: '' }])); }
    if (u.includes('icanhazdadjoke.com')) return r.fulfill(json({ id: 'x1', joke: 'I only know 25 letters of the alphabet. I don\'t know y.' }));
    if (u.includes('themealdb.com')) return r.fulfill(json({ meals: [{ idMeal: '1', strMeal: 'Pancakes', strArea: 'American', strCategory: 'Dessert', strInstructions: 'Mix.\nCook.', strIngredient1: 'Flour', strMeasure1: '100g' }] }));
    if (u.includes('api.coingecko.com')) { const ids = (new URL(u).searchParams.get('ids') || 'bitcoin').split(','); // whichever coin was asked
      return r.fulfill(json(Object.fromEntries(ids.map((id) => [id, { usd: 65000, usd_24h_change: 1.2, last_updated_at: 1700000000 }])))); }
    if (u.includes('earthquake.usgs.gov')) return r.fulfill(json({ features: [{ id: 'q1', properties: { mag: 4.6, place: '20 km E of Somewhere', time: Date.now() - 3600e3, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/q1' }, geometry: { coordinates: [139.7, 35.7, 10] } }] }));
    if (u.includes('openlibrary.org/search.json')) return r.fulfill(json({ docs: [{ key: '/works/OL1W', title: 'Kindred', author_name: ['Octavia E. Butler'], first_publish_year: 1979, subject: ['Science fiction', 'Time travel'] }, { key: '/works/OL2W', title: 'Hyperion', author_name: ['Dan Simmons'], first_publish_year: 1989, subject: ['Science fiction'] }] }));
    if (u.includes('hn.algolia.com')) return r.fulfill(json({ hits: [{ objectID: '1', title: 'A thing shipped', url: 'https://example.com/a', points: 120 }] }));
    if (u.includes('/feed/featured/')) return r.fulfill(json({ news: [{ story: '<b>Something</b> happened today.', links: [] }] }));
    return r.fulfill({ status: 204, body: '' }); });
  await ctx.route(/127\.0\.0\.1:\d+\/api\//, (r) => { const u = r.request().url(); if (/\/api\/miss$/.test(u)) miss.push(1);
    if (/\/api\/answer$/.test(u)) return r.fulfill(json({ answer: 'A generic answer.', sources: [] }));
    return r.fulfill({ status: 204, body: '' }); });
  // no fixed sleeps: goto resolves after the page's inline script has bound the input, and handle() itself waits for the skills
  const p = await ctx.newPage(); await p.goto(base);
  const logged = (q, ms) => p.waitForFunction((q) => { const w = document.getElementById('whisper'); if (w && w.textContent) window.__said = w.textContent; // keep the last whisper: it fades
    try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return Array.isArray(l) && l.some((x) => String(x.ask).trim() === q.trim()); } catch (_) { return false; } }, q, { timeout: ms, polling: 50 }).catch(() => {});
  // "before": setup asks run first (a list to check off, a timer to pause), so asks that act on earlier ones are tested too
  for (const b0 of before || []) { await p.fill('#input', b0); await p.keyboard.press('Enter'); await logged(b0, 2400);
    // Esc only closes an open page: pressed after every setup ask it is a double Esc (two within 450 ms), which undoes the last thing made, so a fast run lost the sticky a group or label ask needed
    if (await p.locator('.vpage').count()) await p.keyboard.press('Escape').catch(() => {}); }
  await p.evaluate(() => { window.__said = ''; });
  // wait for the answer itself (the page's own loop log), not a guessed time; a log that does not parse reads as empty (a miss)
  const t0 = Date.now(); await p.fill('#input', a); await p.keyboard.press('Enter'); await logged(a, 4000);
  const said = await p.evaluate(() => { const w = document.getElementById('whisper'); return (w && w.textContent) || window.__said || ''; }).catch(() => '');
  const log = await p.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } });
  const last = log.filter((x) => String(x.ask).trim() === a.trim()).pop();
  const ms = Date.now() - t0; // how long the answer took; an ask the page never logged counts at the wait it gave up after, or a loaded machine would look fast
  const note = last ? String(last.note || '') : (said && !miss.length ? 'said' : '');
  const routed = !miss.length && new RegExp('^(' + want + ')').test(note);
  // "says": a pattern the visible answer must contain (the right ability AND the right value: "7 cubed" -> 343)
  let shown = '';
  // a card can finish drawing after the answer is logged: wait until the value shows (or 2.5 s), then read the page
  if (routed && says) { await p.waitForFunction((re) => new RegExp(re, 'i').test(document.body.innerText), says, { timeout: 2500, polling: 100 }).catch(() => {}); // void-review: ok (says is a regex by design, written in bench.json, as valueOk below)
    shown = said + '\n' + await p.evaluate(() => { const i = document.getElementById('input'); return document.body.innerText.replace(i ? i.value : '', ''); }).catch(() => ''); }
  // a review card shows the pasted code back: take that echo out first, so "says" must be in the review itself, not in the code
  // (other cards may rightly repeat the ask: a note shows its text, a spelling answer shows the word)
  if (/(^|\|)review(\||$)/.test(want)) { const echoes = [a, a.includes(':') ? a.slice(a.indexOf(':') + 1) : ''].map((x) => x.trim()).filter((x) => x.length >= 4);
    for (const e of echoes) shown = shown.split(e).join(' '); }
  const valueOk = !says || new RegExp(says, 'i').test(shown);
  const right = routed && valueOk;
  await ctx.close();
  return { ask: a, want: want + (says ? ' saying /' + says + '/' : ''), by: (note || '(none)') + (routed && !valueOk ? ' (wrong value)' : ''), right, ms };
}
// default: one page fewer than the cores, at most 6. At 6 on a 4-core machine the bench saturated itself (answers took 2.8 s at the median, 3.7 s at p95
// of the 4 s it waits, two of five misses in a clean run were timing, and a full run takes about 20 min either way, it is CPU-bound): no headroom to see load in
const PAR = Math.max(1, parseInt(process.env.BENCH_PAR, 10) || Math.min(6, os.cpus().length - 1));
let next = 0;
await Promise.all(Array.from({ length: Math.min(PAR, todo.length) }, async () => { while (next < todo.length) { const i = next++; out[i] = await one(todo[i]); } }));
await browser.close(); server.close();
// was the machine quiet? (tools/bench-load.mjs): misses plus slow answers mean the run says nothing about Void
let best = {}; try { best = JSON.parse(fs.readFileSync(BEST, 'utf8')); } catch (_) {}
const env = envName(), latency = latencyOf(out.map((x) => x.ms));
const load = verdict({ misses: out.some((x) => !x.right), latency, baseline: best.latency && best.latency[env], pages: PAR });
if (process.argv.includes('--score')) {
  const result = { score: out.filter((x) => x.right).length, total: out.length, wrong: out.filter((x) => !x.right).map((x) => x.ask + ' -> ' + x.by), env, cores: os.cpus().length, pages: PAR, latency };
  if (load.inconclusive) { result.inconclusive = true; result.note = load.line; console.error(load.line); }
  const floor = Number.isFinite(best.score) ? best.score : Infinity;
  if (cacheable && !load.inconclusive && result.score >= floor) try { fs.writeFileSync(CACHE, JSON.stringify({ key, at: new Date().toISOString(), result })); } catch (_) {}
  console.log(JSON.stringify(result)); process.exit(0); }
for (const x of out) if (!probeFile || !x.right) console.log((x.right ? '  ok  ' : ' ---- ') + x.ask.padEnd(42) + ' ' + (x.by + (x.right ? '' : '   (wants ' + x.want + ')')));
const n = out.filter((x) => x.right).length;
// with --last N only part of the list ran: the asks that did not run stay in the replay file
// say why the common misses happen, so a fix starts in the right file
if (probeFile && out.some((x) => !x.right && /asked for code/.test(x.by))) console.log('("asked for code": Void did not see code in the ask. Name the language in NAMED and give looksLikeCode a reason to count a short paste, both in void-live-deploy/lib/code-review.js)');
if (probeFile && out.some((x) => !x.right && /^review .* 0 \(wrong value\)/.test(x.by))) console.log('("review … 0 (wrong value)": the review found nothing. Add a rule to RULES in void-live-deploy/lib/code-review.js and a case to tools/review.test.mjs)');
if (probeFile) { const missed = asks.filter((a) => !todo.includes(a)).concat(todo.filter((_, i) => !out[i].right)); fs.writeFileSync(AGAIN, JSON.stringify(missed, null, 1)); if (missed.length) console.log('(node tools/bench.mjs --again probes just these ' + missed.length + ' after a fix)'); }
console.log('\n' + n + ' of ' + out.length + ' answered by what should answer them (answers took p50 ' + latency.p50 + 'ms, p95 ' + latency.p95 + 'ms).');
if (load.inconclusive) console.log(load.line);
if (process.argv.includes('--json')) { if (load.inconclusive) console.log('bench.last.json kept as it was: an inconclusive run never replaces a conclusive one'); else fs.writeFileSync(path.join(here, 'bench.last.json'), JSON.stringify(out, null, 1)); }
