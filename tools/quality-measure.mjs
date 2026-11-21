// The quality engine's browser part: one surface, opened in a real Chrome at a phone and a desktop size, measured with pixels, the DOM, real
// clicks and real requests (owner, 2026-11-19: beautiful AND correct; outdo the best). It returns the numbers lib/quality.js scores. It reads
// only: every request that is not a GET is answered with an empty 204, and a button whose words say it spends, sends or deletes is not pressed.
import fs from 'node:fs';
import { failing, bare } from './design-loop.mjs';
import { readability, colourEntropy } from '../void-live-deploy/lib/quality.js';

export const SITE = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, '');
export const UA = 'VerseQuality/1.0 (+https://a-to-mind.com/scoreboard/; reads only)';
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const RISKY = /\b(delete|remove|buy|pay|purchase|send|submit|sign ?(?:in|up|out)|log ?(?:in|out)|reset|clear|donate|subscribe|publish|post|tip|stake|withdraw|connect wallet)\b/i;
const BAD_TEXT = /\bundefined\b|\bNaN\b|\[object |lorem ipsum|\{\{|\bnull\b/i;

export function chromeExe() {
  return [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/google/chrome/chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));
}
// full pages sit behind the Uni screen for a stranger (lib/page-pass.js). With the owner's token (a CI secret, never printed) the engine sees the real page;
// without it a gated page is reported as gated and never scored as if the Uni screen were the page.
const OWNER = process.env.VOID_OWNER_TOKEN || '';
export async function launch() {
  let pw; try { pw = await import('playwright-core'); } catch (_) { pw = await (await import('./verse-guards.mjs')).loadPlaywright(); }
  const { chromium } = pw;
  return chromium.launch({ executablePath: chromeExe(), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}

// installed before the page's own scripts: what kind of canvas it makes, and whether it keeps drawing
const INIT = () => {
  const w = window; w.__q = { ctx: new Set(), draws: 0, gpu: 0, raf: 0, cls: 0, longest: 0 };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { try { w.__q.ctx.add(String(t)); } catch (_) {} return gc.call(this, t, ...a); };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { const o = C.prototype[f]; if (o) C.prototype[f] = function (...a) { w.__q.draws++; return o.apply(this, a); }; }
  }
  if (window.GPUQueue) { const s = window.GPUQueue.prototype.submit; window.GPUQueue.prototype.submit = function (...a) { w.__q.gpu++; return s.apply(this, a); }; }
  const raf = w.requestAnimationFrame.bind(w); w.requestAnimationFrame = (cb) => raf((t) => { w.__q.raf++; cb(t); });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) w.__q.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
};

/** the page-side read: text, fonts, motion, pictures, controls, links. Runs in the page. */
const READ = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const text = (document.body.innerText || '').slice(0, 20000);
  const sizes = new Set(); let bodyMin = 99;
  for (const e of [...document.body.querySelectorAll('p,li,span,a,div,td,label,button')].slice(0, 600)) {
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2); if (!own || !vis(e)) continue;
    const px = Math.round(parseFloat(getComputedStyle(e).fontSize)); sizes.add(px); if (px < bodyMin && e.innerText.trim().length > 20) bodyMin = px;
  }
  let transitions = 0, feedback = false, reduced = false;
  for (const sh of [...document.styleSheets]) { let rules; try { rules = [...sh.cssRules]; } catch (_) { continue; } const walk = (rs) => { for (const r of rs) { if (r.cssRules && !r.selectorText) { if (/prefers-reduced-motion/.test(r.conditionText || r.cssText.slice(0, 80))) reduced = true; walk([...r.cssRules]); } else if (r.style) { if (r.style.transition || r.style.animation || r.style.transitionDuration || r.style.animationName) transitions++; if (/:hover|:active|:focus-visible/.test(r.selectorText || '')) feedback = true; } } }; walk(rules); }
  const anims = document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running').length : 0;
  const vids = [...document.querySelectorAll('video')].filter((v) => !v.paused).length;
  const imgs = [...document.images].filter(vis), placeholder = /placeholder|blank\.|spacer|no-?image|default-?art|missing/i;
  const art = { images: imgs.length, broken: 0, placeholders: 0, soft: 0 }; let big = null;
  for (const i of imgs) {
    const r = i.getBoundingClientRect();
    if (i.complete ? i.naturalWidth === 0 : false) art.broken++;
    else if (placeholder.test(i.currentSrc || i.src || '') || placeholder.test(i.alt || '') || (i.naturalWidth > 0 && i.naturalWidth <= 2)) art.placeholders++;
    else if (i.naturalWidth && r.width > 60 && i.naturalWidth < r.width * 0.8) art.soft++;
    if (r.width * r.height > 8000 && (!big || r.width * r.height > big.a)) big = { a: r.width * r.height, x: r.x, y: r.y + scrollY, w: r.width, h: r.height };
  }
  const canvases = [...document.querySelectorAll('canvas')].filter(vis).length;
  const links = [...new Set([...document.querySelectorAll('a[href]')].filter(vis).map((a) => a.getAttribute('href')))].filter((h) => h && !/^(mailto:|tel:|javascript:)/.test(h));
  const controls = [...document.querySelectorAll('button,[role=button],input[type=submit],summary')].filter(vis).map((e, i) => ({ i, t: (e.innerText || e.getAttribute('aria-label') || e.title || e.value || '').trim().slice(0, 40) }));
  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea')].filter(vis).length;
  const clipped = [...document.body.querySelectorAll('h1,h2,h3,p,li,button,a')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 2 && !/ellipsis/.test(getComputedStyle(e).textOverflow) && /hidden|clip/.test(getComputedStyle(e).overflowX)).length;
  const inline = [...document.scripts].filter((s) => !s.src).map((s) => s.textContent || '').join('\n');
  return { text, sizes: sizes.size, bodyMin: bodyMin === 99 ? 16 : bodyMin, transitions, feedback, reduced, alive: anims + vids > 0, art, big, canvases, links, controls, inputs, clipped,
    scrollX: Math.max(0, document.documentElement.scrollWidth - innerWidth), inlineGpu: /navigator\.gpu/.test(inline), scripts: [...document.scripts].map((s) => s.src).filter((s) => s && s.startsWith(location.origin)).slice(0, 12), gated: !!document.querySelector('meta[name="verse-gate"]'), title: document.title, h1: (document.querySelector('h1') || {}).innerText || '' };
};

async function entropyOf(host, png) {
  // the pixels come back to node and are read here (no text is run as code)
  const px = await host.evaluate(async (b64) => {
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = 'data:image/png;base64,' + b64; });
    const c = new OffscreenCanvas(Math.min(img.width, 200), Math.round(img.height * Math.min(1, 200 / img.width))), g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, d: Array.from(g.getImageData(0, 0, c.width, c.height).data) };
  }, png.toString('base64'));
  return colourEntropy(px.d, px.w, px.h, 1);
}

async function open(browser, profile, url, { watch = true } = {}) {
  const ctx = await browser.newContext({ ...profile, userAgent: UA, reducedMotion: 'no-preference' });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const seen = { errors: [], failed: [], bytes: 0 };
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) seen.errors.push(m.text().slice(0, 140)); });
  page.on('pageerror', (e) => seen.errors.push(String(e.message || e).slice(0, 140)));
  page.on('response', (r) => { const u = r.url(); if (u.startsWith(SITE) && r.status() >= 400 && r.request().method() === 'GET') seen.failed.push(r.status() + ' ' + u.slice(SITE.length, SITE.length + 80)); });
  await page.route('**/*', (route) => { const m = route.request().method(); if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') { seen.mutating = (seen.mutating || 0) + 1; return route.fulfill({ status: 204, body: '' }); } if (OWNER && route.request().url().startsWith(SITE)) return route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer ' + OWNER } });
    return route.continue(); });
  const t0 = Date.now();
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => ({ err: String(e.message || e).slice(0, 100) }));
  if (res && res.err) { await ctx.close(); return { fail: res.err }; }
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1800);
  return { ctx, page, seen, status: res && res.status ? res.status() : 0, ms: Date.now() - t0 };
}

/** measure one surface at both sizes. Returns the object lib/quality.js scoreSurface takes, plus the screenshots (png buffers). */
export async function measure(browser, surface, { shots = true } = {}) {
  const url = surface.ask ? SITE + '/' : SITE + surface.path;
  const out = { id: surface.id, url, kind: surface.kind, shots: {} };
  const host = await (await browser.newContext()).newPage();
  const sides = {};
  for (const [name, profile] of [['phone', PHONE], ['desktop', DESKTOP]]) {
    const o = await open(browser, profile, url);
    if (o.fail) { sides[name] = { fail: o.fail }; continue; }
    const { page, seen } = o;
    try {
      if (surface.ask) {
        await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {});
        await page.fill('#input', surface.ask); await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);
        await page.waitForFunction(() => { const c = document.querySelector('.vpage.on'); return !c || c.getAttribute('aria-busy') !== 'true'; }, null, { timeout: 14000, polling: 300 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] || {}; const res = performance.getEntriesByType('resource'); return { dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0), bytes: Math.round((n.encodedBodySize || 0) + res.reduce((s, r) => s + (r.encodedBodySize || 0), 0)) }; });
      const d0 = await page.evaluate(() => ({ draws: window.__q.draws, gpu: window.__q.gpu, raf: window.__q.raf }));
      await page.waitForTimeout(1000);
      const q = await page.evaluate(() => ({ draws: window.__q.draws, gpu: window.__q.gpu, raf: window.__q.raf, ctx: [...window.__q.ctx], cls: window.__q.cls }));
      const read = await page.evaluate(READ);
      const lay = await page.evaluate(failing), bar = await page.evaluate(bare);
      const png = await page.screenshot({ fullPage: false });
      const entropy = await entropyOf(host, png);
      let artEntropy = 0;
      if (read.big && read.big.w > 40) { try { const clip = await page.screenshot({ clip: { x: Math.max(0, read.big.x), y: Math.max(0, read.big.y), width: Math.min(read.big.w, profile.viewport.width), height: Math.min(read.big.h, 900) }, fullPage: true }); artEntropy = await entropyOf(host, clip); } catch (_) {} }
      const gpuScripts = [];
      for (const s of read.scripts.slice(0, 8)) { try { const t = await page.evaluate((u) => fetch(u).then((r) => r.text()).catch(() => ''), s); /* void-review: ok (browser fetch, at most 8 scripts) */ if (/navigator\.gpu/.test(t)) gpuScripts.push(s); } catch (_) {} }
      sides[name] = { nav, q, d0, read, lay, bar, entropy, artEntropy, seen, status: o.status, png, gpuPath: read.inlineGpu || gpuScripts.length > 0, dprRaf: q.raf - d0.raf };
      if (name === 'phone') sides.page = page, sides.ctx = o.ctx;
      else await o.ctx.close();
      if (name === 'phone') { sides.links = await probeLinks(page, read); sides.controls = await probeControls(page, read, seen); sides.smoke = await smoke(page, read, seen); await o.ctx.close(); sides.page = null; }
    } catch (e) { sides[name] = { fail: String(e.message || e).slice(0, 120) }; try { await o.ctx.close(); } catch (_) {} }
  }
  await host.context().close();
  const P = sides.phone, D = sides.desktop;
  if (!P || P.fail) return { ...out, fail: (P && P.fail) || 'no phone render' };
  if (P.read && P.read.gated) {
    if (shots) { out.shots.phone = P.png; if (D && !D.fail) out.shots.desktop = D.png; }
    return { ...out, fail: 'gated: the Uni screen shows, not the page (the owner token measures the real page)' };
  }
  const worst = (f) => Math.max(f(P), D && !D.fail ? f(D) : 0);
  const readT = readability(P.read.text);
  const animated = (s) => s && !s.fail && ((s.q.draws - s.d0.draws) > 2 || (s.q.gpu - s.d0.gpu) > 2);
  const types = new Set([...P.q.ctx, ...((D && D.q && D.q.ctx) || [])]);
  out.metrics = {
    gfx: { webgl: [...types].some((t) => /webgl/.test(t)), webgpu: [...types].some((t) => /webgpu/.test(t)) || P.q.gpu > 0, animated: animated(P) || animated(D), entropy: Math.max(P.entropy, D && !D.fail ? D.entropy : 0), gpuPath: P.gpuPath, fps: P.dprRaf },
    speedPhone: { dcl: P.nav.dcl, load: P.nav.load, bytes: P.nav.bytes, cls: +P.q.cls.toFixed(3) },
    layout: { contrast: worst((s) => s.lay.contrast.length), targets: worst((s) => s.lay.targets.length), scrollX: worst((s) => s.read.scrollX), clipped: worst((s) => s.read.clipped), bare: worst((s) => s.bar.unstyled.length + s.bar.empty.length) },
    type: { bodyMin: P.read.bodyMin, sizes: Math.max(P.read.sizes, D && !D.fail ? D.read.sizes : 0), read: readT },
    motion: { transitions: P.read.transitions, feedback: P.read.feedback, reduced: P.read.reduced, alive: P.read.alive || animated(P) },
    art: { ...P.read.art, entropy: P.artEntropy },
    errs: { errors: new Set([...P.seen.errors, ...(D && D.seen ? D.seen.errors : [])]).size, failedRequests: new Set(P.seen.failed).size, brokenImages: P.read.art.broken, placeholderText: BAD_TEXT.test(P.read.text) ? 1 : 0, deadEnd: P.read.links.length === 0 && P.read.controls.length === 0 && P.read.inputs === 0 },
    flows: { links: sides.links.checked, brokenLinks: sides.links.broken, controls: sides.controls.tried, controlsWithEffect: sides.controls.effect, handoffBroken: 0 },
    logic: { smokeOk: sides.smoke.ok },
    details: { fail: { contrast: P.lay.contrast, targets: P.lay.targets, bare: P.bar }, errors: [...P.seen.errors].slice(0, 4), failed: [...new Set(P.seen.failed)].slice(0, 4), brokenLinks: sides.links.list, deadControls: sides.controls.dead, text: P.read.text.slice(0, 1500), grade: readT.grade },
  };
  if (shots) { out.shots.phone = P.png; if (D && !D.fail) out.shots.desktop = D.png; }
  return out;
}

async function probeLinks(page, read) {
  const own = read.links.filter((h) => !/^https?:\/\//.test(h) || h.startsWith(SITE)).slice(0, 14);
  const list = []; let checked = 0, broken = 0;
  for (const h of own) {
    if (h === '#' || h === '') { checked++; broken++; list.push(h || '(empty)'); continue; }
    if (h.startsWith('#')) { checked++; const ok = await page.evaluate((id) => !!document.getElementById(id) || !!document.querySelector('[name="' + id + '"]'), h.slice(1)); if (!ok) { broken++; list.push(h); } continue; }
    checked++;
    const st = await page.evaluate((u) => fetch(u, { method: 'HEAD', redirect: 'follow' }).then((r) => r.status).catch(() => 0), h); /* void-review: ok (browser HEAD, capped links) */
    if (st === 405) continue;
    if (st === 0 || st >= 400) { broken++; list.push(h.slice(0, 60) + ' ' + st); }
  }
  return { checked, broken, list: list.slice(0, 6) };
}

async function probeControls(page, read, seen) {
  let tried = 0, effect = 0; const dead = [];
  const els = page.locator('button:visible,[role=button]:visible').filter({ hasNot: page.locator('input') });
  const n = Math.min(await els.count().catch(() => 0), 8);
  for (let i = 0; i < n; i++) {
    const el = els.nth(i);
    const label = ((await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label').catch(() => '')) || '').trim();
    if (RISKY.test(label)) continue;
    const before = await page.evaluate(() => ({ h: document.body.innerHTML.length, u: location.href, a: document.activeElement && document.activeElement.outerHTML.slice(0, 80), n: performance.getEntriesByType('resource').length, ls: JSON.stringify(localStorage).length, dlg: document.querySelectorAll('dialog[open],[role=dialog]').length }));
    const mut0 = seen.mutating || 0;
    tried++;
    try { await el.click({ timeout: 2500, trial: false }); } catch (_) { tried--; continue; }
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({ h: document.body.innerHTML.length, u: location.href, a: document.activeElement && document.activeElement.outerHTML.slice(0, 80), n: performance.getEntriesByType('resource').length, ls: JSON.stringify(localStorage).length, dlg: document.querySelectorAll('dialog[open],[role=dialog]').length })).catch(() => before);
    if (after.h !== before.h || after.u !== before.u || after.a !== before.a || after.n !== before.n || after.ls !== before.ls || after.dlg !== before.dlg || (seen.mutating || 0) > mut0) effect++; else dead.push(label || '(no label)');
    if (after.u !== before.u) await page.goBack({ timeout: 8000 }).catch(() => {});
  }
  return { tried, effect, dead: dead.slice(0, 5) };
}

async function smoke(page, read, seen) {
  const e0 = seen.errors.length;
  try {
    const inp = page.locator('input[type=text]:visible,input:not([type]):visible,textarea:visible').first();
    if (await inp.count()) { await inp.fill('hello').catch(() => {}); await page.keyboard.press('Enter').catch(() => {}); await page.waitForTimeout(800); }
    await page.mouse.wheel(0, 600).catch(() => {}); await page.waitForTimeout(300);
  } catch (_) {}
  return { ok: seen.errors.length === e0 };
}
