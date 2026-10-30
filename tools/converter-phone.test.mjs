// /converter/ on a phone and offline (owner's Versus job, 2026-10-30: take onlineconverter.com to 12 of 12). The target page is 11 KB with
// 0 scripts, so it cannot work offline; Verse has to stay in its weight class on the phone and win offline outright. Opens /converter/ in
// installed Chrome as a 390 px phone and fails main when either slips:
//  - phone: 0 px sideways, 0 render-blocking scripts or style sheets, the page's HTML at most CRITICAL_GZIP bytes gzipped (the target's
//    11 KB plus 1 KB), the heavy converters (video, sound, ebook, repair) not fetched before a file is picked, and every control in the
//    tool panel a thumb-sized target (44 px)
//  - offline: once the page is open the service worker keeps it; then the server is shut down, the network cut, the page reloaded,
//    and a PNG becomes a BMP and a WAV becomes a FLAC, both checked by their first bytes. Files never leave the device.
// Weights and counts are measured, not timed, so a slow shared runner can't flake it.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { chromium } from 'playwright-core';
import { routeOutside } from './fixtures/outside.mjs';
import { acquire as acquireHeavy } from './heavy.mjs';
await acquireHeavy('converter on a phone and offline (converter-phone.test.mjs)');

export const TARGET = { host: 'onlineconverter.com', bytes: 11 * 1024, scripts: 0 }; // the Versus card's reading of the target's home page
export const CRITICAL_GZIP = 12 * 1024;
const HEAVY = ['/lib/video-write.js', '/lib/audio-write.js', '/lib/mp3-edit.js', '/lib/denoise.js', '/lib/epub-edit.js', '/lib/mp4-repair.js'];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!exe) { console.log('skip converter on a phone: no Chrome'); process.exit(0); }
const T = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: exe, headless: true });
let bad = 0; const check = (name, ok, got) => { console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(got))); if (!ok) bad++; };

// a 4x4 PNG and a 0.1 s WAV, made in the page: files on the device, as a person picks them
const pick = (p, kind) => p.evaluate(async (kind) => {
  let bytes, name;
  if (kind === 'png') { const c = document.createElement('canvas'); c.width = c.height = 4; c.getContext('2d').fillStyle = '#c33'; c.getContext('2d').fillRect(0, 0, 4, 4); bytes = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer()); name = 'dot.png'; }
  else { const n = 4410, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), s = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 10)), true); bytes = new Uint8Array(b); name = 'tone.wav'; }
  const dt = new DataTransfer(); dt.items.add(new File([bytes], name)); const inp = document.getElementById('files'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
}, kind);
const convert = async (p, kind, to) => {
  await p.click('#any'); await pick(p, kind);
  await p.waitForSelector('#to', { timeout: 15000 }); await p.selectOption('#to', to);
  await p.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 15000 }); await p.click('#go');
  const done = await p.waitForSelector('#out a.dl', { timeout: 60000 }).then(() => true, () => false);
  if (!done) return { error: await p.textContent('#status') };
  return p.evaluate(async () => { const a = document.querySelector('#out a.dl'), b = new Uint8Array(await (await fetch(a.href)).arrayBuffer()); return { name: a.download, size: b.length, head: String.fromCharCode(...b.slice(0, 4)) }; });
};

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await routeOutside(ctx);
  const p = await ctx.newPage(), asked = [];
  p.on('request', (q) => { const u = new URL(q.url()); if (u.origin === base) asked.push(u.pathname); });
  await p.goto(base + '/converter/', { waitUntil: 'load' });

  // phone: the critical path stays in the target's weight class
  const html = fs.readFileSync(path.join(root, 'converter', 'index.html')), gz = zlib.gzipSync(html, { level: 9 }).length;
  check('converter phone: the page is at most ' + CRITICAL_GZIP + ' bytes gzipped (' + TARGET.host + ': ' + TARGET.bytes + ')', gz <= CRITICAL_GZIP, gz);
  const blocking = await p.evaluate(() => [...document.head.querySelectorAll('script[src], link[rel~="stylesheet"]')].filter((e) => e.tagName === 'LINK' ? !e.media || e.media === 'all' : !e.defer && !e.async && e.type !== 'module').map((e) => e.src || e.href));
  check('converter phone: nothing blocks the first paint (no blocking script or style sheet)', blocking.length === TARGET.scripts, blocking);
  const early = HEAVY.filter((u) => asked.includes(u));
  check('converter phone: the heavy converters wait for a file (' + HEAVY.length + ' not fetched on open)', early.length === 0, early);
  // sideways is read the way the Versus gate reads it: a plain 390 px window (a mobile one widens itself to fit what spills over)
  const plain = await browser.newContext({ viewport: { width: 390, height: 844 } }), q = await plain.newPage(); await routeOutside(plain);
  const wide = {};
  for (const [state, url] of [['open', '/converter/'], ['a tool open', '/converter/?t=cut-mp3'], ['a search', '/converter/?q=mp4%20to%20mp3']]) { await q.goto(base + url, { waitUntil: 'load' }); await q.waitForTimeout(300); wide[state] = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); }
  await plain.close();
  check('converter phone: 0 px sideways at 390 px (open, a tool open, a search)', Object.values(wide).every((w) => w <= 0), wide);
  const small = await p.evaluate(() => [...document.querySelectorAll('#panel button, #panel select, #panel input, #find button, #find input')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => (e.id || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height)));
  check('converter phone: every control in the tool is 44 px tall or more', small.length === 0, small);
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); if (!l) return null; const m = await (await fetch(l.href)).json(); return { scope: m.scope, start: m.start_url, display: m.display, icons: (m.icons || []).length }; });
  check('converter phone: installable (a manifest with a scope, a start page, standalone, icons)', !!man && man.scope === '/converter/' && /^\/converter\//.test(man.start) && man.display === 'standalone' && man.icons >= 2, man);

  // offline: the worker takes the page, keeps every script it ran, then the network goes
  const ready = await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).then(() => true, () => false);
  check('converter offline: the service worker takes the page', ready, null);
  const keptNow = () => p.evaluate(async (HEAVY) => { const all = performance.getEntriesByType('resource').map((r) => new URL(r.name)).filter((u) => u.origin === location.origin && /\.js$/.test(u.pathname)).map((u) => u.pathname); const need = [...new Set(all.concat(HEAVY, ['/converter/app.js']))].filter((x) => x !== '/visit.js'); const miss = []; for (const u of need) if (!(await caches.match(u))) miss.push(u); return { need: need.length, miss }; }, HEAVY);
  let k = await keptNow(); for (let i = 0; i < 60 && k.miss.length; i++) { await p.waitForTimeout(500); k = await keptNow(); }
  const kept = k.miss.length ? 0 : k.need;
  check('converter offline: every script of the tool is kept on the device', kept > HEAVY.length, k);
  server.closeAllConnections(); server.close(); await ctx.setOffline(true);
  const back = await p.reload({ waitUntil: 'load' }).then(() => true, (e) => String(e).slice(0, 120));
  const shown = back === true && await p.evaluate(() => document.getElementById('tName') && document.getElementById('catalog').children.length > 0);
  check('converter offline: with the network cut, a reload shows the tool and its list', !!shown, back);
  const conv = (kind, to) => (back === true ? convert(p, kind, to).catch((e) => ({ error: String(e).slice(0, 120) })) : { error: 'the page did not come back offline' });
  const bmp = await conv('png', 'bmp');
  check('converter offline: a PNG becomes a BMP with the network cut', bmp.head && bmp.head.startsWith('BM') && bmp.size > 54, bmp);
  const flac = await conv('wav', 'flac');
  check('converter offline: a WAV becomes a FLAC with the network cut (the sound engine came from the device)', flac.head === 'fLaC' && flac.size > 42, flac);
  const out = process.env.CONVERTER_PROOF; // CI keeps this as the finding's artifact
  if (out) fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), page: '/converter/', target: TARGET, gzip: gz, blocking, early, wide, small, manifest: man, keptScripts: kept, offline: { reload: back === true, bmp, flac } }, null, 2) + '\n');
  await ctx.close();
} finally { await browser.close(); server.close(); }
process.exit(bad ? 1 : 0);
