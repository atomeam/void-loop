// Void's shared regression suite. Every agent runs this before deploying:  node tools/test_void.mjs
// Serves void-live-deploy locally, stubs the network, and checks every ask we support.
// Add a check here whenever you add an ask. Exit code 1 = something broke; deploy.ps1 stops.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';

const exe = [process.env.VOID_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const results = [];
const check = (name, ok, got) => { results.push({ name, ok: !!ok, got }); };
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function fresh() {
  const ctx = await browser.newContext();
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    const u = r.request().url();
    if (u.includes('translate.googleapis.com')) return r.fulfill(json([[['hola', 'hello']]]));
    if (u.includes('/w/api.php')) return r.fulfill(json({ query: { search: [{ title: 'Black hole' }] } }));
    if (u.includes('/page/summary/')) return r.fulfill(json({ title: 'Black hole', extract: 'A region of spacetime.', timestamp: '2026-09-20T10:00:00Z' }));
    if (u.includes('geocoding-api.open-meteo.com')) return r.fulfill(json({ results: [{ name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, population: 500000 }, { name: 'Lisbon', admin1: 'Ohio', country: 'United States', latitude: 40.7, longitude: -80.7, population: 2800 }] }));
    if (u.includes('api.open-meteo.com')) return r.fulfill(json({ current: { temperature_2m: 20, apparent_temperature: 19, weather_code: 1, wind_speed_10m: 5 }, daily: { temperature_2m_max: [24], temperature_2m_min: [15], precipitation_probability_max: [10] }, hourly: { time: Array.from({ length: 8 }, (_, i) => '2026-09-27T1' + i + ':00'), temperature_2m: Array(8).fill(20), precipitation_probability: Array(8).fill(5), weather_code: Array(8).fill(1) } }));
    if (u.includes('frankfurter')) return r.fulfill(json({ amount: 100, base: 'USD', date: '2026-09-26', rates: { EUR: 92 } }));
    return r.fulfill({ status: 204, body: '' });
  });
  await ctx.route(/127\.0\.0\.1.*\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base); await p.waitForTimeout(700);
  const ask = async (t, w = 450) => { await p.fill('#input', t); await p.keyboard.press('Enter'); await p.waitForTimeout(w); };
  const state = () => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('a2m.void.state.v1') || '{}')));
  const page = () => p.$eval('.vpage.on', (e) => e.innerText).catch(() => '');
  const whisper = () => p.$eval('#whisper', (e) => e.textContent);
  return { ctx, p, ask, state, page, whisper, errors };
}

try {
  let t = await fresh();
  check('surface is empty on arrival', (await t.p.$$eval('#stage > *', (d) => d.length)) === 0 && !(await t.page()));
  check('noscript text stays hidden', !(await t.p.evaluate(() => document.body.innerText)).includes('It needs JavaScript'));
  await t.ask('make a clock'); check('make a clock', (await t.state()).some((x) => x.kind === 'clock'));
  await t.ask('make a 5 minute timer'); await t.ask('make a 2 minute timer');
  check('second timer adds (007)', (await t.state()).filter((x) => x.kind === 'timer').length === 2);
  await t.ask('add a sticky that says a'); await t.ask('another note that says b');
  check('second sticky adds (007)', (await t.state()).filter((x) => x.kind === 'sticky').length === 2);
  await t.ask('make all the timers red'); check('make all the timers red', (await t.state()).filter((x) => x.kind === 'timer').every((x) => x.color === '#ff5c5c'));
  await t.ask('clear all the notes'); check('clear all the notes', !(await t.state()).some((x) => x.kind === 'sticky') && (await t.state()).some((x) => x.kind === 'timer'));
  await t.ask('undo'); check('undo brings the group back', (await t.state()).filter((x) => x.kind === 'sticky').length === 2);
  await t.ask('make everything blue'); check('make everything blue', (await t.state()).every((x) => !x.color || /6aa8ff|9ec8ff/.test(x.color)));
  await t.ask('menu'); const menu = await t.page(); check('menu lists skills', /Menu/.test(menu) && /map/.test(menu) && /translate/.test(menu) && /weather/.test(menu), menu.slice(0, 80));
  await t.ask('close');
  await t.ask('what is a black hole', 900); const art = await t.page(); check('page about anything, dated', /Black hole/.test(art) && /last edited/.test(art) && /as of/.test(art), art.slice(0, 120));
  await t.ask('translate hello to Spanish', 1200); const tr = await t.page(); check('translate', /hola/.test(tr) && /Google Translate/.test(tr), tr.slice(0, 80));
  await t.ask('keep this'); check('keep this', (await t.state()).some((x) => x.kind === 'kept'));
  await t.ask('call this spanish hello'); check('call this', (await t.state()).some((x) => x.kind === 'kept' && x.name === 'spanish hello'));
  await t.p.reload(); await t.p.waitForTimeout(700); check('kept card survives reload', (await t.p.$$eval('.kept-card', (d) => d.length)) === 1);
  await t.ask('map of Lisbon', 1200); const mp = await t.page(); check('map of Lisbon picks Portugal', /Lisbon/.test(mp) && /Portugal/.test(mp) && (await t.p.$$eval('.vpage iframe', (d) => d.length)) === 1, mp.slice(0, 80));
  await t.ask('weather in Lisbon', 1200); check('weather', /20°|68°/.test(await t.page()));
  await t.ask('5 miles in km', 700); check('calculation', /8\.05/.test(await t.page()));
  await t.ask('make my void deep blue'); check('your look', /01040f/.test(await t.p.evaluate(() => localStorage.getItem('a2m.void.look.v1') || '')));
  await t.ask('update yourself'); check('build asks are owner-only', /owner/.test(await t.whisper()));
  await t.p.fill('#input', 'tim'); await t.p.waitForTimeout(150); check('hints while typing', (await t.p.$$eval('#hints div', (d) => d.map((x) => x.textContent))).some((h) => /timer/.test(h)));
  check('no script errors', t.errors.length === 0, t.errors.join(' | '));
  await t.ctx.close();

  t = await fresh();
  await t.p.goto(base + '?q=' + encodeURIComponent('make a clock')); await t.p.waitForTimeout(1200);
  check('?q= link runs the ask', (await t.state()).some((x) => x.kind === 'clock'));
  await t.ctx.close();
} catch (e) {
  check('suite ran to the end', false, String(e && e.message));
}
await browser.close(); server.close();
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'pass ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + (r.got || '')));
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
