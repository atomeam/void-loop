// The lab's headless test (owner, 2026-10-29: "get all these live and working too"): every imported experiment opened the way a visitor opens
// it, in the pre-installed Chromium, served with the site's real _headers (so a script the CSP blocks fails here, not live). Per page it records
// uncaught errors, console errors, failed or 4xx requests, and whether anything was painted (a screenshot with more than one flat colour).
//   node tools/lab-probe.mjs --lab <dir> [--slugs a,b] [--json out.json] [--shots dir]    the dir holds <slug>/index.html, lab.css, needs.js
// classify() turns a result into the catalog status: works | needs-webgpu | needs-webxr | broken. Headless Chromium has no navigator.gpu and no
// navigator.xr, so a page that uses one and has no 2D or WebGL fallback is "needs-*" however it fares; one that falls back and paints is "works".
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { headersFor } from './csp-smoke.mjs';
import { needsOf } from './lab-import.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), deploy = path.resolve(here, '..', 'void-live-deploy');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

/** whether the source has a 2D or WebGL path to fall back on. Pure. */
export const hasFallback = (src) => /getContext\(\s*['"`](?:2d|webgl2?|experimental-webgl)['"`]/.test(src);
// an error that comes from the missing graphics or headset, as against a bug in the experiment's own code
const GPUISH = /gpu|requestDevice|adapter|\bxr\b|xrsystem|webxr|immersive|session|runtime|swapchain/i;
/** result { errors, painted } + the page's needs and fallback -> { status, error }. A page that needs WebGPU or WebXR and has no 2D or WebGL path is
 *  "needs-*"; so is one whose errors all name the missing graphics or headset. A code error (a syntax error, a name that is not defined) is "broken" whatever it uses. Pure. */
export function classify({ needs = [], fallback = false }, result) {
  const errors = result.errors || [], bad = !result.painted || errors.length > 0, bugs = errors.filter((e) => !GPUISH.test(e));
  const broken = (list) => ({ status: 'broken', error: list.length ? list.slice(0, 3).join(' | ').slice(0, 400) : 'blank page: nothing was painted after 2 seconds' });
  if (needs.length && !bugs.length && (bad || !fallback)) return { status: needs.includes('webgpu') ? 'needs-webgpu' : 'needs-webxr' };
  if (bad) return broken(needs.length ? bugs : errors);
  return { status: 'works' };
}
/** the page's source as the browser gets it: index.html and the app*.js beside it. */
export function sourceOf(labDir, slug) {
  const dir = path.join(labDir, slug); let s = '';
  for (const f of fs.readdirSync(dir)) if (/\.(html|js)$/.test(f)) s += fs.readFileSync(path.join(dir, f), 'utf8') + '\n';
  return s;
}

/** a static server: /lab/<slug>/ from `labDir`, everything else (visit.js, og.png, icon.svg) from the deploy, with the site's headers. */
export function serve(labDir) {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const hdr = Object.fromEntries(Object.entries(headersFor(p)).filter(([k]) => /^[A-Za-z0-9-]+$/.test(k))); // headersFor keeps a `! Name` detach line as a junk key
    for (const k of Object.keys(hdr)) if (/^content-security-policy$/i.test(k)) hdr[k] = [].concat(hdr[k]).map((v) => v.replace(/;?\s*upgrade-insecure-requests/, ''));
    if (Array.isArray(hdr['Permissions-Policy'])) hdr['Permissions-Policy'] = hdr['Permissions-Policy'].at(-1); // a `! Permissions-Policy` line in _headers detaches the earlier value
    if (p.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{}'); }
    let f = p.startsWith('/lab/') ? path.join(labDir, p.slice(5)) : path.join(deploy, p);
    if (!f.startsWith(labDir) && !f.startsWith(deploy)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', ...hdr }); fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ base: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() })));
}

const load = () => { const r = createRequire(path.join(process.cwd(), 'x.js')); try { return r('playwright'); } catch (_) { return r('playwright-core'); } };
// in a blank page: how many flat colours a screenshot has, how much it varies, and a signature to tell two frames apart
const MEASURE = async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, seen = new Set(); let n = 0, sum = 0, sq = 0, sig = 0;
  for (let i = 0; i < d.length; i += 12) { seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)); const l = 0.3 * d[i] + 0.6 * d[i + 1] + 0.1 * d[i + 2]; n++; sum += l; sq += l * l; sig = (sig * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; }
  const mean = sum / n; return { distinct: seen.size, std: Math.sqrt(Math.max(0, sq / n - mean * mean)), sig };
};

/** open each slug and report { slug, errors, painted, animated, distinct, std, ms }. */
export async function probe({ labDir, slugs, concurrency = 4, shots = null, log = () => {} }) {
  const { chromium } = load(), server = await serve(labDir);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const meter = await (await browser.newContext()).newPage(); await meter.goto('about:blank');
  const out = []; let next = 0;
  async function one(slug) {
    const t0 = Date.now(), errors = [], ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    await ctx.grantPermissions(['microphone', 'camera']).catch(() => {});
    const page = await ctx.newPage(), url = server.base + '/lab/' + slug + '/', text = (s) => String(s).replace(/\s+/g, ' ').slice(0, 220);
    page.on('pageerror', (e) => errors.push('pageerror: ' + text(e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push('console: ' + text(m.text())); });
    page.on('requestfailed', (r) => { if (r.url().startsWith(server.base) && !/\/visit\.js/.test(r.url())) errors.push('request failed: ' + r.url().slice(server.base.length)); });
    page.on('response', (r) => { if (r.url().startsWith(server.base) && r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url().slice(server.base.length)); });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    let a = null, b = null;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 }); await page.waitForTimeout(2000);
      await page.evaluate(() => document.querySelectorAll('.vl-bar,.vl-note').forEach((e) => { e.style.display = 'none'; }));
      a = await meter.evaluate(MEASURE, (await page.screenshot()).toString('base64'));
      await page.mouse.click(550, 380); await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(700, 450, { steps: 8 }); await page.mouse.up(); await page.keyboard.press('Space');
      await page.waitForTimeout(700);
      const shot = await page.screenshot(); b = await meter.evaluate(MEASURE, shot.toString('base64'));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, slug + '.png'), shot); }
    } catch (e) { errors.push('load: ' + text(e.message || e)); }
    await ctx.close().catch(() => {});
    const best = [a, b].filter(Boolean).sort((x, y) => y.distinct - x.distinct)[0] || { distinct: 0, std: 0 };
    const row = { slug, errors: [...new Set(errors)].slice(0, 5), painted: best.distinct >= 4 || best.std > 2.5, animated: !!(a && b && a.sig !== b.sig), distinct: best.distinct, std: Math.round(best.std * 10) / 10, ms: Date.now() - t0 };
    out.push(row); log(row);
  }
  await Promise.all(Array.from({ length: concurrency }, async () => { while (next < slugs.length) await one(slugs[next++]); }));
  await browser.close(); server.close();
  return out.sort((x, y) => (x.slug < y.slug ? -1 : 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const labDir = path.resolve(arg('--lab', path.join(deploy, 'lab')));
  const all = fs.readdirSync(labDir).filter((d) => fs.existsSync(path.join(labDir, d, 'index.html')));
  const slugs = arg('--slugs') ? arg('--slugs').split(',') : all;
  const rows = await probe({ labDir, slugs, shots: arg('--shots'), log: (r) => process.stderr.write(r.errors.length || !r.painted ? '!' : '.') });
  const verdicts = rows.map((r) => { const src = sourceOf(labDir, r.slug); return { ...r, ...classify({ needs: needsOf(src), fallback: hasFallback(src) }, r) }; });
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(verdicts, null, 1) + '\n');
  const by = {}; for (const v of verdicts) by[v.status] = (by[v.status] || 0) + 1;
  console.log('\nlab-probe: ' + verdicts.length + ' pages ' + JSON.stringify(by));
  for (const v of verdicts.filter((x) => x.status === 'broken')) console.log('broken ' + v.slug + ': ' + v.error);
}
