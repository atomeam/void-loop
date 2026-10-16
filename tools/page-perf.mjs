// How fast the page is, measured the way a visitor meets it: node tools/page-perf.mjs [--phone] [--slow] [--runs 5] [--json]
// Serves void-live-deploy locally (gzip, as Pages does), opens it headless, blocks outside hosts and /api, and prints the median
// of N loads: first paint, DOMContentLoaded, load, when the modules stopped arriving (all of them, and the skills alone: the first
// skill answer can come once the skills are in), requests, compressed bytes, script
// time, heap. --phone is a 390 px touch screen at 3x; --slow adds a 1.6 Mbit/s link with 150 ms latency and a 4x slower CPU
// (an older phone on a fair connection). --json prints one JSON line. Measure before a change and after it, and put both
// numbers in the PR (docs/playbooks/perf-pass.md). It only reads; nothing is written. Never alongside the browser suite or the
// bench: tools/heavy.mjs queues them (this one is quick, so it waits rather than skewing a run in flight).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { chromium } from 'playwright-core';
import { acquire as acquireHeavy } from './heavy.mjs';
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Math.max(1, +argOf('--runs', 5) || 5), PHONE = process.argv.includes('--phone'), SLOW = process.argv.includes('--slow'), JSON_OUT = process.argv.includes('--json');
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(argOf('--root', path.join(here, '..', 'void-live-deploy')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const gz = new Map();
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  if (!gz.has(f)) gz.set(f, zlib.gzipSync(fs.readFileSync(f), { level: 6 }));
  const body = gz.get(f);
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': body.length });
  res.end(body);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const exe = [process.env.VOID_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
const releaseHeavy = await acquireHeavy('page perf (tools/page-perf.mjs)');
const browser = await chromium.launch({ executablePath: exe, headless: true });
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const rows = [];
for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {});
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Performance.enable');
  if (SLOW) { await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  let reqs = 0, bytes = 0, skillReqs = 0, lastReqAt = 0, lastSkillAt = 0;
  const t0 = Date.now();
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  cdp.on('Network.requestWillBeSent', (e) => { reqs++; lastReqAt = Date.now() - t0; if (/\/skills\/|\/lib\//.test(e.request.url)) skillReqs++; if (/\/skills\//.test(e.request.url)) lastSkillAt = lastReqAt; });
  await page.goto(base, { waitUntil: 'load' });
  // the skill modules have all arrived once no request has started for a second
  let last = -1, quiet = 0; while (quiet < 10) { await new Promise((r) => setTimeout(r, 100)); if (reqs === last) quiet++; else { quiet = 0; last = reqs; } }
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const paint = await page.evaluate(() => { const p = {}; for (const e of performance.getEntriesByType('paint')) p[e.name] = Math.round(e.startTime); const n = performance.getEntriesByType('navigation')[0]; p.dcl = Math.round(n.domContentLoadedEventEnd); p.load = Math.round(n.loadEventEnd); p.html = n.encodedBodySize; return p; });
  rows.push({ firstPaintMs: paint['first-contentful-paint'] || paint['first-paint'] || 0, dclMs: paint.dcl, loadMs: paint.load, modulesDoneMs: lastReqAt, skillsDoneMs: lastSkillAt, requests: reqs, moduleRequests: skillReqs, gzKB: Math.round(bytes / 1024), htmlGzKB: Math.round(paint.html / 1024), scriptMs: Math.round(m.ScriptDuration * 1000), heapMB: Math.round(m.JSHeapUsedSize / 1048576) });
  await ctx.close();
}
const out = {}; for (const k of Object.keys(rows[0])) out[k] = med(rows.map((r) => r[k]));
const label = (PHONE ? 'phone' : 'desktop') + (SLOW ? ', slow link and 4x slower CPU' : '');
if (JSON_OUT) console.log(JSON.stringify({ label, runs: RUNS, median: out }));
else { console.log(label + ', median of ' + RUNS + ' loads:'); for (const [k, v] of Object.entries(out)) console.log('  ' + k.padEnd(16) + String(v)); }
await browser.close(); server.close(); releaseHeavy();
