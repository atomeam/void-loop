#!/usr/bin/env node
// Vision judge: what a visitor sees, measured, before a pull request that touches a surface can merge (tools/merge-gate.mjs).
// Headless Chrome opens each changed surface at 1280x800 (desktop) and 390x844 (phone), takes a screenshot, and checks it with
// deterministic pixel and DOM measures only (no model, no invented score):
//   every surface: zero page errors and console errors; no sideways scroll; no clipped text (a text box cut off with no ellipsis);
//   a dark page (the Verse theme: the page background's luminance at most DARK); not a blank render (some pixels differ from the
//   most common colour); media on the page has no load error.
//   the landing ('/') also: nothing visible but the void and the ask bar (no text, link or button outside #row); a near-black frame
//   (mean luminance at most NEAR_BLACK); no harsh hard-edged blobs: of the pixels brighter than the void, the share sitting on a
//   strong edge (Sobel magnitude over EDGE) stays at most HARD_EDGE, with the ask bar masked out.
// A failure names the surface, the viewport, the measure, and the numbers, so the coder can fix exactly that.
//   node tools/vision-judge.mjs [--paths /,/films/] [--files a,b] [--base origin/main] [--shots dir] [--json]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }];
// HARD_DOTS: the share of bright points that are flat discs; the field look measured 0.26 with disc stars and 0.05 with falloff stars (2026-11-18)
// BLOB: a bright region of 400 px or more (about an 11 px radius) is a shape; anything smaller is a point of light
// HARD_EDGE: the landing measured 0.043 (desktop) and 0.064 (phone) on main, 2026-11-18; the bar is about twice that
export const LIMITS = { DARK: 0.2, NEAR_BLACK: 0.16, BLANK: 0.002, EDGE: 0.35, HARD_EDGE: 0.12, BLOB: 400, HARD_DOTS: 0.12, MAX_SURFACES: 6 };
const LANDING = /^(?:void\.html|void-live-deploy\/(?:index|void)\.html|void-live-deploy\/(?:lib|skills)\/[^/]+\.(?:js|css)|void-live-deploy\/[^/]+\.css)$/;

/** the surfaces a change can alter: the landing for the home and its scripts, /x/ for void-live-deploy/x/index.html. Pure. */
export function surfacesOf(files) {
  const out = new Set();
  for (const f of files || []) {
    if (LANDING.test(f)) { out.add('/'); continue; }
    const m = /^void-live-deploy\/((?:[\w.-]+\/)+)index\.html$/.exec(f);
    if (m) out.add('/' + m[1]);
  }
  return [...out].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b))).slice(0, LIMITS.MAX_SURFACES);
}

/** dest for a path in a Cloudflare _redirects file, or "". Pure. */
export function redirectDestOf(text, pathName) {
  const want = String(pathName || '').split('?')[0];
  const alt = want.endsWith('/') ? want.slice(0, -1) : want + '/';
  for (const line of String(text || '').split(/\n/)) {
    const p = line.trim().split(/\s+/);
    if (p.length >= 3 && (p[0] === want || p[0] === alt)) return p[1];
  }
  return '';
}

/** surfaces that still exist, or the live page a deleted one 301s to. */
export function liveSurfacesOf(files, dir) {
  const raw = surfacesOf(files);
  if (!dir) return raw;
  let rules = '';
  try { rules = fs.readFileSync(path.join(dir, '_redirects'), 'utf8'); } catch (_) {}
  const exists = (p) => fs.existsSync(path.join(dir, p === '/' ? 'index.html' : p.replace(/\/?$/, '/') + 'index.html'));
  const out = [];
  for (const p of raw) {
    if (exists(p)) { out.push(p); continue; }
    const dest = redirectDestOf(rules, p).replace(/[?#].*$/, '');
    if (dest && exists(dest)) out.push(dest.endsWith('/') || dest === '/' ? dest : dest + '/');
  }
  return [...new Set(out)];
}

/** relative luminance of an sRGB colour, 0..1. Pure. */
export function luminance(r, g, b) {
  const c = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

/** pixel measures of an RGBA frame: mean luminance, the share of pixels off the most common colour, and the hard-edge share of
 *  the bright pixels outside `mask` ({x,y,w,h}). Pure. */
export function pixelStats(data, w, h, mask = null) {
  const n = w * h, L = new Float32Array(n), counts = new Map();
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    sum += (L[i] = luminance(r, g, b));
    const k = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3); counts.set(k, (counts.get(k) || 0) + 1);
  }
  const mode = Math.max(...counts.values()), mean = sum / n;
  const masked = (x, y) => mask && x >= mask.x && x < mask.x + mask.w && y >= mask.y && y < mask.y + mask.h;
  // the bright pixels, grouped into 8-connected regions; a region smaller than BLOB pixels is a point of light (a star, a glyph's
  // dot) and is not a blob, so only the rims of regions of BLOB pixels or more are counted
  const bar = mean + 0.04, seen = new Uint8Array(n), stack = [];
  let bright = 0, hard = 0, dots = 0, flat = 0;
  for (let y0 = 1; y0 < h - 1; y0++) for (let x0 = 1; x0 < w - 1; x0++) {
    const i0 = y0 * w + x0; if (seen[i0] || L[i0] <= bar || masked(x0, y0)) continue;
    const region = []; seen[i0] = 1; stack.push(i0);
    while (stack.length) {
      const i = stack.pop(); region.push(i); const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, j = yy * w + xx;
        if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1 || seen[j] || L[j] <= bar || masked(xx, yy)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    if (region.length < LIMITS.BLOB) {
      // a point of light: harsh when it is a flat disc (four or more pixels within 80% of its peak) rather than a falloff from one bright centre
      let peak = 0; for (const i of region) if (L[i] > peak) peak = L[i];
      if (peak > 4 * bar) { dots++; let top = 0; for (const i of region) if (L[i] >= 0.8 * peak) top++; if (top >= 4) flat++; }
      continue;
    }
    // a blob's rim: its pixels that touch a dark one. A soft falloff reaches the dark slowly, so its rim is dim and its gradient
    // small; a hard-edged shape stops at full strength, so its rim carries a strong step
    for (const i of region) {
      if (L[i - 1] > bar && L[i + 1] > bar && L[i - w] > bar && L[i + w] > bar) continue;
      bright++;
      const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
      if (Math.hypot(gx, gy) > LIMITS.EDGE) hard++;
    }
  }
  return { mean: +mean.toFixed(4), offMode: +(1 - mode / n).toFixed(4), bright, hardEdge: bright ? +(hard / bright).toFixed(4) : 0, dots, hardDots: dots ? +(flat / dots).toFixed(4) : 0 };
}

/** the earned looks a change can alter, each judged on the landing after its ask: the particle field and the sky map behind it */
export function looksOf(files) {
  return (files || []).some((f) => /(^|\/)lib\/(void-cosmos|sky-catalog|void-shapes)\.js$/.test(f)) ? ['add a particle field'] : [];
}

/** the failures for one surface at one viewport. Pure. */
export function judge(pathname, vp, dom, px) {
  const bad = [], at = pathname + ' @ ' + vp;
  if (dom.errors.length) bad.push(at + ': ' + dom.errors.length + ' console/page error(s): ' + dom.errors.slice(0, 2).join(' | '));
  if (dom.scrollX) bad.push(at + ': sideways scroll (' + dom.scrollX + ' px wider than the window)');
  if (dom.clipped.length) bad.push(at + ': clipped text: ' + dom.clipped.slice(0, 3).join(', '));
  if (dom.bg > LIMITS.DARK) bad.push(at + ': page background luminance ' + dom.bg + ' > ' + LIMITS.DARK + ' (not the dark theme)');
  if (px.offMode < LIMITS.BLANK) bad.push(at + ': blank render (' + px.offMode + ' of pixels differ from the main colour)');
  if (dom.media.length) bad.push(at + ': media failed to load: ' + dom.media.slice(0, 2).join(', '));
  if (pathname === '/') {
    const chrome = dom.chrome; // the landing keeps nothing outside the ask bar (owner, 2026-11-18)
    if (chrome.length) bad.push(at + ': landing shows more than the void and the ask bar: ' + chrome.slice(0, 3).join(', '));
    if (px.mean > LIMITS.NEAR_BLACK) bad.push(at + ': landing frame mean luminance ' + px.mean + ' > ' + LIMITS.NEAR_BLACK + ' (not near-black)');
    if (px.hardDots > LIMITS.HARD_DOTS) bad.push(at + ': harsh star dots: ' + px.hardDots + ' of ' + px.dots + ' bright points are flat discs > ' + LIMITS.HARD_DOTS);
    if (px.hardEdge > LIMITS.HARD_EDGE) bad.push(at + ': harsh hard-edged shapes: ' + px.hardEdge + ' of bright pixels on a strong edge > ' + LIMITS.HARD_EDGE);
  }
  return bad;
}

// ---- the browser part ----
const DOM = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && !e.closest('[aria-hidden="true"]'); };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '');
  const clipped = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || !e.childNodes.length || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const s = getComputedStyle(e);
    if (/(hidden|clip)/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2) clipped.push(name(e));
  }
  const row = document.getElementById('row'), chrome = [];
  for (const e of document.querySelectorAll('body a, body button, body input, body select, body textarea, body h1, body h2, body h3, body p, body li, body img, body svg')) {
    if (row && row.contains(e)) continue;
    if (vis(e) && (e.matches('a,button,input,select,textarea,img,svg') || e.innerText.trim())) chrome.push(name(e));
  }
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  let bg = null;
  for (const e of [document.body, document.documentElement]) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) { bg = c; break; } }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const media = [...document.querySelectorAll('video,audio')].filter((m) => m.error || (m.currentSrc && m.networkState === 3)).map((m) => m.tagName.toLowerCase() + ' ' + (m.currentSrc || '').slice(0, 80));
  const r = row && row.getBoundingClientRect();
  return { scrollX: Math.max(0, document.documentElement.scrollWidth - innerWidth), clipped, chrome, bg: bg ? +lum(bg).toFixed(4) : 0, media,
    mask: r ? { x: Math.floor(r.left - 24), y: Math.floor(r.top - 24), w: Math.ceil(r.width + 48), h: Math.ceil(r.height + 48) } : null };
};

// every video and audio this server holds must play: muted, at most 4 s each, and it has to get frames and move forward
const PLAY = async () => {
  const out = [];
  for (const m of [...document.querySelectorAll('video,audio')].filter((m) => (m.currentSrc || m.src || '').startsWith(location.origin)).slice(0, 4)) {
    m.muted = true;
    const t0 = m.currentTime;
    await Promise.race([m.play().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    await new Promise((r) => setTimeout(r, 600));
    if (m.error || m.readyState < 2 || (m.paused && m.currentTime <= t0)) out.push(m.tagName.toLowerCase() + ' did not play: ' + (m.currentSrc || m.src).slice(location.origin.length, location.origin.length + 80));
    m.pause();
  }
  return out;
};

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webp': 'image/webp' };
  return new Promise((ok) => { const s = http.createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
    let f = path.join(dir, p === '/' ? 'index.html' : p);
    if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0, '127.0.0.1', () => ok(s)); });
}

async function browser() {
  const { chromium } = await import('playwright-core');
  const exe = [process.env.VOID_TEST_BROWSER, '/usr/bin/google-chrome', (() => { try { return chromium.executablePath(); } catch (_) { return ''; } })()].find((p) => p && fs.existsSync(p));
  if (!exe) throw new Error('no Chrome found (set VOID_TEST_BROWSER)');
  return chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

/** the pixel measures of a PNG, decoded and counted in a blank page (pixelStats runs there as written here, so the numbers match the tests) */
async function measure(b, png, mask) {
  const pg = await b.newPage();
  try {
    return await pg.evaluate(async ({ src, fn, lum, limits, mask }) => {
      const LIMITS = limits, luminance = (0, eval)('(' + lum + ')'), pixelStats = eval('(' + fn + ')'); // void-review: ok (the judge's own two functions, in a blank page it opened)
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      return pixelStats(x.getImageData(0, 0, i.width, i.height).data, i.width, i.height, mask);
    }, { src: 'data:image/png;base64,' + png.toString('base64'), fn: pixelStats.toString(), lum: luminance.toString(), limits: LIMITS, mask });
  } finally { await pg.close(); }
}

/** open every surface at both viewports and judge it; offline: any request off the local server is answered empty. */
export async function run({ paths, dir = path.join(root, 'void-live-deploy'), shots = '', ask = '' } = {}) {
  const server = await serve(dir), base = 'http://127.0.0.1:' + server.address().port, b = await browser(), results = [];
  try {
    for (const p of paths) for (const vp of VIEWPORTS) {
      const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
      await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 204, body: '' }));
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
      await page.goto(base + p, { waitUntil: 'load', timeout: 30000 }).catch((e) => errors.push('load: ' + e.message.slice(0, 120)));
      await page.waitForTimeout(1500);
      if (ask) { await page.fill('#input', ask).catch((e) => errors.push('ask: ' + e.message.slice(0, 120))); await page.press('#input', 'Enter').catch(() => {}); await page.waitForTimeout(2500); await page.mouse.move(vp.width / 2, 40); }
      const unplayable = await page.evaluate(PLAY).catch(() => []);
      const dom = { ...(await page.evaluate(DOM).catch((e) => ({ scrollX: 0, clipped: [], chrome: [], bg: 0, media: [], mask: null, fail: e.message }))), errors };
      dom.media = [...dom.media, ...unplayable];
      const png = await page.screenshot();
      if (shots) { fs.mkdirSync(shots, { recursive: true }); fs.writeFileSync(path.join(shots, (p.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'landing') + (ask ? '-' + ask.replace(/\W+/g, '-') : '') + '-' + vp.name + '.png'), png); }
      const px = await measure(b, png, dom.mask);
      results.push({ path: p, viewport: vp.name, px, dom: { ...dom, mask: undefined }, failures: judge(p, vp.name, dom, px) });
      await ctx.close();
    }
  } finally { await b.close(); server.close(); }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? String(process.argv[i + 1] || '') : ''; };
  let paths = arg('--paths') ? arg('--paths').split(',').filter(Boolean) : null, looks = arg('--ask') ? [arg('--ask')] : [];
  if (!paths) {
    const files = arg('--files') ? arg('--files').split(',') : execFileSync('git', ['diff', '--name-only', (arg('--base') || 'origin/main') + '...HEAD'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
    paths = liveSurfacesOf(files, path.join(root, 'void-live-deploy'));
    if (!looks.length) looks = looksOf(files);
  }
  if (!paths.length) { console.log('vision-judge: no surface changed'); process.exit(0); }
  const results = await run({ paths, shots: arg('--shots') });
  for (const ask of looks) results.push(...(await run({ paths: ['/'], shots: arg('--shots'), ask })).map((r) => ({ ...r, path: '/ (' + ask + ')', failures: r.failures.map((f) => f.replace(/^\/ @/, '/ (' + ask + ') @')) })));
  const bad = results.flatMap((r) => r.failures);
  if (process.argv.includes('--json')) console.log(JSON.stringify(results.map((r) => ({ path: r.path, viewport: r.viewport, px: r.px, failures: r.failures })), null, 1));
  for (const r of results) console.log((r.failures.length ? 'FAIL ' : 'ok   ') + r.path + ' @ ' + r.viewport + '  mean ' + r.px.mean + ', off-colour ' + r.px.offMode + ', hard-edge ' + r.px.hardEdge);
  for (const f of bad) console.error('vision-judge: ' + f);
  process.exit(bad.length ? 1 : 0);
}
