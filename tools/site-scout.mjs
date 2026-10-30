// The site scout (owner, 2026-10-24: "lets go site by site with the tower"): what a real site shows and lets a visitor do, read from the live
// page, so Verse is compared with the site itself and never with a memory of it. It loads the page at phone and desktop width and prints: the
// title and language, the visible text, every control with its label, the scripts and styles it loads, how long it takes and how much it
// weighs, the storage it keeps, any live socket; then it presses each plain button once (never a form's submit, never a link) and prints what
// changed on the page. Screenshots go to SCOUT_OUT (default ./scout-out), never into the repo. Passive otherwise: no sign-in, no typing, no posting.
//   node tools/site-scout.mjs https://justflipacoin.com/        (.github/workflows/site-scout.yml runs it where any site is reachable)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const clip = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + ' …' : String(s || ''));
/** the lines of `after` that were not in `before`: what a press added or changed on the page. Pure. */
export function changed(before, after) {
  const had = new Set(String(before || '').split('\n').map((l) => l.trim()).filter(Boolean));
  return String(after || '').split('\n').map((l) => l.trim()).filter((l) => l && !had.has(l));
}

async function look(browser, url, width, out, tag) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
  const p = await ctx.newPage(); const loads = []; let bytes = 0; const sockets = [];
  p.on('response', async (r) => { try { const b = await r.body(); bytes += b.length; } catch (_) {} loads.push(r.request().resourceType() + ' ' + r.url()); });
  p.on('websocket', (w) => sockets.push(w.url()));
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => p.waitForTimeout(3000));
  const ms = Date.now() - t0; await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const vis = (e) => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
    const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.value || e.title || e.getAttribute('placeholder') || e.name || e.id || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const controls = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick]')].filter(vis).map((e) => e.tagName.toLowerCase() + (e.type ? '[' + e.type + ']' : '') + ': ' + (label(e) || '(no label)') + (e.href ? ' -> ' + e.href : ''));
    let store = []; try { store = Object.keys(localStorage); } catch (_) {}
    return { title: document.title, lang: document.documentElement.lang, desc: (document.querySelector('meta[name=description]') || {}).content || '', text: document.body ? document.body.innerText : '', controls,
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), store, manifest: !!document.querySelector('link[rel=manifest]'), sw: !!navigator.serviceWorker && !!navigator.serviceWorker.controller };
  });
  fs.mkdirSync(out, { recursive: true }); await p.screenshot({ path: path.join(out, tag + '.png'), fullPage: true }).catch(() => {});
  return { ctx, p, ms, bytes, loads, sockets, info };
}

async function presses(p, out, tag) {
  const found = [];
  const n = await p.$$eval('button,[role=button]', (bs) => bs.length).catch(() => 0);
  for (let i = 0; i < Math.min(n, 10); i++) {
    const b = (await p.$$('button,[role=button]'))[i]; if (!b) continue;
    const skip = await b.evaluate((e) => !(e.offsetParent || e.getClientRects().length) || (e.type === 'submit' && !!e.closest('form'))).catch(() => true);
    if (skip) continue;
    const name = await b.evaluate((e) => (e.getAttribute('aria-label') || e.innerText || e.title || e.id || 'button').trim().replace(/\s+/g, ' ').slice(0, 60)).catch(() => 'button');
    const before = await p.evaluate(() => document.body.innerText).catch(() => '');
    await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1800);
    const after = await p.evaluate(() => document.body.innerText).catch(() => '');
    await p.screenshot({ path: path.join(out, tag + '-press-' + i + '.png') }).catch(() => {});
    found.push({ name, adds: changed(before, after).slice(0, 12) });
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv[2]; if (!/^https?:\/\/[^\s/]+/.test(url || '')) { console.error('usage: node tools/site-scout.mjs https://site.example/'); process.exit(2); }
  const out = process.env.SCOUT_OUT || 'scout-out', host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [width, tag] of [[390, host + '-phone'], [1280, host + '-desktop']]) {
    const r = await look(browser, url, width, out, tag);
    console.log('\n=== ' + url + ' at ' + width + ' px ===');
    console.log('title: ' + r.info.title + ' | lang: ' + (r.info.lang || '(none)') + ' | description: ' + clip(r.info.desc, 200));
    console.log('load: ' + r.ms + ' ms to network idle, ' + Math.round(r.bytes / 1024) + ' KB in ' + r.loads.length + ' requests | sideways overflow: ' + r.info.overflow + ' px | manifest: ' + r.info.manifest + ' | service worker: ' + r.info.sw);
    console.log('storage keys: ' + (r.info.store.join(', ') || '(none)') + ' | live sockets: ' + (r.sockets.join(', ') || '(none)'));
    console.log('--- visible text ---\n' + clip(r.info.text, 4000));
    console.log('--- controls (' + r.info.controls.length + ') ---\n' + r.info.controls.slice(0, 80).join('\n'));
    if (width === 1280) {
      console.log('--- loaded ---\n' + r.loads.filter((l) => /^(script|stylesheet|xhr|fetch|websocket|media|font)/.test(l)).slice(0, 60).join('\n'));
      console.log('--- each button pressed once ---');
      for (const f of await presses(r.p, out, tag)) console.log('[' + f.name + '] ' + (f.adds.length ? f.adds.join(' / ') : '(no visible text changed)'));
    }
    await r.ctx.close();
  }
  await browser.close();
}
