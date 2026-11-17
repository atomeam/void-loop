// taste-audit: a headless design-and-experience critic. It checks what the browser actually lays out —
// orphan button wraps, readable canvas scale, live frame pacing and active controls — at a phone and a desktop
// viewport, and checks that the card painter draws topic-matched art instead of a generic plate.
//   node tools/taste-audit.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { artInner } from '../void-live-deploy/lib/card-art.js';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '..'), site = path.resolve(repo, 'void-live-deploy');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const ROUTES = ['/games/roguelike/', '/games/snake/', '/games/pong/', '/games/merge-void/', '/games/dim-void/', '/games/jrpg/', '/starboard/', '/arcade/'];
const VIEWS = [{ width: 375, height: 812 }, { width: 1280, height: 800 }];

function serve() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.resolve(site, '.' + p);
      if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream');
      res.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => ok({ server: s, base: 'http://127.0.0.1:' + s.address().port }));
  });
}

/** a toolbar row with exactly one button while a sibling row has several: the lonely wrap we keep shipping. */
export function orphanWraps() {
  const out = [];
  for (const box of document.querySelectorAll('button')) {
    const p = box.parentElement; if (!p) continue;
    if (getComputedStyle(p).display === 'grid') continue; // a control pad is a grid, not a wrapping toolbar
    const sibs = [...p.querySelectorAll('button')]; if (sibs.length < 3) continue;
    const rows = new Map();
    for (const b of sibs) { const r = b.getBoundingClientRect(); if (!r.width) continue; const k = Math.round(r.top); rows.set(k, (rows.get(k) || 0) + 1); }
    if (rows.size > 1 && [...rows.values()].includes(1)) out.push((p.id || p.className || 'toolbar') + ': a single button wrapped onto its own row');
  }
  return [...new Set(out)];
}

async function fps(page) {
  return page.evaluate(() => new Promise((ok) => {
    let n = 0, last = performance.now(), sum = 0;
    const tick = (t) => { const d = t - last; last = t; if (n++) sum += d; if (n < 32) requestAnimationFrame(tick); else ok(Math.round(1000 / (sum / (n - 1)))); };
    requestAnimationFrame(tick);
  }));
}

/** the card painter must draw condition art for a known topic, not the default plate. */
export function cardArt() {
  const rain = artInner({ kind: 'Skill', text: 'rain in Paris', key: 'weather', hue: 220 }, { w: 664, h: 440 });
  const missing = [];
  if (!rain.includes('#a8d8ff')) missing.push('a rain card has no rain strokes');
  if (!rain || rain.length < 100) missing.push('the card painter drew nothing');
  return missing;
}

async function main() {
  const bad = [...cardArt()];
  const candidates = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, chromium.executablePath()];
  const cache = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(cache)) for (const d of fs.readdirSync(cache)) candidates.push(path.join(cache, d, 'chrome-win64', 'chrome.exe'), path.join(cache, d, 'chrome-linux64', 'chrome'));
  const exe = candidates.find((x) => x && fs.existsSync(x));
  if (!exe) { console.log('FAIL taste-audit: no Chromium executable (set VOID_TEST_BROWSER)'); return 1; }
  const { server, base } = await serve();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
    for (const view of VIEWS) {
      const ctx = await browser.newContext({ viewport: view, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const route of ROUTES) {
        await page.goto(base + route, { waitUntil: 'load' });
        const wraps = await page.evaluate(orphanWraps);
        for (const w of wraps) bad.push(view.width + 'px ' + route + ': ' + w);
        const canvas = await page.locator('canvas').first().count();
        if (canvas) {
          const box = await page.locator('canvas').first().boundingBox();
          if (box && (box.width < 250 || box.height < 140)) bad.push(view.width + 'px ' + route + ': canvas too small (' + Math.round(box.width) + 'x' + Math.round(box.height) + ')');
          const f = await fps(page);
          if (f < 55) bad.push(view.width + 'px ' + route + ': frame pacing ' + f + ' fps (need >= 55)');
        }
        const dead = await page.locator('body').innerText();
        if (/instant death|game over on move one/i.test(dead)) bad.push(view.width + 'px ' + route + ': an instant-death message on load');
      }
      await ctx.close();
    }
  } catch (e) { bad.push('browser: ' + String(e.message || e).slice(0, 160)); }
  finally { if (browser) await browser.close(); server.close(); }
  if (bad.length) { console.log('FAIL taste-audit: ' + bad.join('; ')); return 1; }
  console.log('ok taste-audit: ' + ROUTES.length + ' routes at 2 viewports, no orphan wraps, readable canvases, steady frame pacing, topic-matched card art');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code)).catch((e) => { console.error('taste-audit: ' + (e.message || e)); process.exit(1); });
