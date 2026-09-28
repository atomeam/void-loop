// Void's shared regression suite. Every agent runs this before deploying:  node tools/test_void.mjs
// Serves void-live-deploy locally, stubs the network, and checks every ask we support.
// Add a check here whenever you add an ask. Exit code 1 = something broke; deploy.ps1 stops.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
// Poll instead of guessing a delay: the shared box is often busy, fixed sleeps flake.
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 150)); } };
// Voice stubs: a fake SpeechRecognition that "hears" window.__said, and speechSynthesis that records what it would say.
const VOICE_STUB = () => {
  class FakeRec {
    start(track) { window.__recTrack = !!track; setTimeout(() => { const r = Object.assign([{ transcript: window.__said || 'make a counter' }], { isFinal: true }); if (this.onresult) this.onresult({ results: [r] }); if (this.onend) this.onend(); }, 50); }
    stop() { if (this.onend) this.onend(); }
    abort() {}
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  window.__spoken = [];
  if (window.speechSynthesis) { speechSynthesis.speak = (u) => window.__spoken.push(u.text); speechSynthesis.cancel = () => {}; }
};
const NO_MIC_ELEMENT = () => { delete window.HTMLMicrophoneElement; };
const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function fresh(...inits) {
  const ctx = await browser.newContext();
  for (const init of inits) await ctx.addInitScript(init);
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
  await ctx.route(/127\.0\.0\.1.*\/api\//, (r) => {
    const u = r.request().url();
    if (u.includes('/api/will')) return r.fulfill(json({ at: '2026-09-27T23:00:00Z', wants: [{ kind: 'people asked', title: 'learn x', i_want: 'I want to answer every question about tides.', because: 'asked 9 times' }] }));
    if (u.includes('/api/answer')) {
      const ask = JSON.parse(r.request().postData() || '{}').ask || '';
      if (false) {}
      if (/busy/.test(ask)) return r.fulfill(json({ answer: null, sources: [], note: 'model busy' }));
      return r.fulfill(json({ answer: 'Sunlight scatters off air molecules, and blue light scatters most [1].', sources: [{ title: 'Rayleigh scattering', url: 'https://en.wikipedia.org/wiki/Rayleigh_scattering' }] }));
    }
    return r.fulfill({ status: 204, body: '' });
  });
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
  await t.ask('why is the sky blue', 900); const an = await t.page(); check('answer engine answers with sources', /blue light scatters/.test(an) && /Rayleigh scattering/.test(an) && /as of/.test(an), an.slice(0, 120));
  await t.ask('why is the model busy', 600); check('answer engine busy -> article excerpt', await until(async () => /Black hole/.test(await t.page()), 5000));
  await t.ask('what do you want to be?', 300); check('will: Void says what it wants', await until(async () => /I want to answer every question about tides/.test(await t.page()), 4000));
  await t.ask('update yourself', 0); check('build asks are owner-only', await until(async () => /owner/.test(await t.whisper()), 3000));
  await t.p.fill('#input', 'tim'); await t.p.waitForTimeout(150); check('hints while typing', (await t.p.$$eval('#hints div', (d) => d.map((x) => x.textContent))).some((h) => /timer/.test(h)));
  check('no script errors', t.errors.length === 0, t.errors.join(' | '));
  await t.ctx.close();

  t = await fresh();
  await t.p.goto(base + '?q=' + encodeURIComponent('make a clock')); await t.p.waitForTimeout(1200);
  check('?q= link runs the ask', (await t.state()).some((x) => x.kind === 'clock'));
  await t.ctx.close();

  // Plan item 4: Void everywhere you already are (app install, address bar, share sheet, voice, read aloud).
  t = await fresh(VOICE_STUB);
  const man = await t.p.evaluate(async () => {
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const icons = await Promise.all(m.icons.map((i) => fetch(i.src).then((r) => r.ok)));
    return { m, icons };
  }).catch((e) => ({ err: String(e) }));
  check('installable app: manifest, icons, opens to the input', man.m && man.m.display === 'standalone' && man.m.icons.some((i) => i.sizes === '512x512' && /maskable/.test(i.purpose)) && man.icons.every(Boolean) && (await t.p.evaluate(() => document.activeElement && document.activeElement.id)) === 'input', JSON.stringify(man).slice(0, 160));
  const os = await t.p.evaluate(async () => { const l = document.querySelector('link[rel=search][type="application/opensearchdescription+xml"]'); return l ? (await fetch(l.href)).text() : ''; });
  check('address bar search (OpenSearch) runs a Void ask', /template="https:\/\/a-to-mind\.com\/\?q=\{searchTerms\}"/.test(os), os.slice(0, 120));
  check('service worker registers (opens offline)', await until(() => t.p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!(r && (r.active || r.waiting || r.installing)))), 6000));
  check('voice: mic is the <microphone> element on Chrome 153+', await t.p.evaluate(() => { const m = document.getElementById('mic'); return !!m && ('HTMLMicrophoneElement' in window ? m.tagName === 'MICROPHONE' : m.tagName === 'BUTTON'); }));
  await t.p.evaluate(() => document.getElementById('mic').dispatchEvent(new Event('stream')));
  check('voice: a spoken ask runs', await until(async () => (await t.state()).some((x) => x.kind === 'counter'), 5000));
  await t.ask('what is a black hole', 300); await until(async () => /region of spacetime/.test(await t.page()), 5000);
  await t.ask('read it aloud', 200);
  const spoken = await t.p.evaluate(() => window.__spoken.join(' '));
  check('read it aloud reads the open page', /region of spacetime/.test(spoken) && !/as of|last edited/i.test(spoken.replace(/Black hole/, '')), spoken.slice(0, 120));
  await t.p.goto(base + '?share_text=' + encodeURIComponent('make a clock'));
  const sharedAsk = await until(async () => (await t.state()).some((x) => x.kind === 'clock'), 6000);
  await t.p.goto(base + '?share_title=Example&share_url=' + encodeURIComponent('https://example.com/a'));
  const sharedLink = await until(async () => (await t.state()).some((x) => x.kind === 'link' && /example\.com/.test(x.url)), 6000);
  check('share to Void: words run, a link becomes a card', sharedAsk && sharedLink && !/share_/.test(t.p.url()), t.p.url());
  const errs1 = t.errors.slice();
  await t.ctx.close();

  t = await fresh(VOICE_STUB, NO_MIC_ELEMENT);
  const fb = await t.p.evaluate(() => { const m = document.getElementById('mic'); return m && m.tagName; });
  if (fb === 'BUTTON') await t.p.click('#mic');
  check('voice fallback: plain mic button still works', fb === 'BUTTON' && await until(async () => (await t.state()).some((x) => x.kind === 'counter'), 5000), fb);
  check('no script errors (everywhere)', !errs1.length && !t.errors.length, errs1.concat(t.errors).join(' | '));
  await t.ctx.close();
} catch (e) {
  check('suite ran to the end', false, String(e && e.message));
}
await browser.close(); server.close();
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'pass ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + (r.got || '')));
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
