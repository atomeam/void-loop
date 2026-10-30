// Every page of the book fits its sheet (owner, 2026-10-21: the book "is still cutting off the bottoms and has incomplete sentences"):
// the tome is opened on the live site (or VOID_SITE) at many window sizes and browser zooms, then every page is turned to and
// measured. A page fails when its sheet scrolls (scrollHeight > clientHeight), when any text sits below the sheet's text area or
// under the folio, when the folio overlaps a line, when the tome leaves the window, or when text is hidden (ellipsis, line-clamp,
// a cut "…"). It also resizes the window with the book open and measures again.
//   CHROME_PATH=/usr/bin/google-chrome node tools/book-fit.mjs       exit 1 on any failure; BOOK_QUICK=1 checks a sample of pages
import { existsSync } from 'node:fs';
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
// [width, height, zoom]: zoom is the browser zoom (deviceScaleFactor with the CSS viewport shrunk or grown to match)
export const SIZES = [[1920, 1080, 1], [1366, 768, 1], [1280, 720, 1], [1280, 600, 1], [1024, 768, 1], [750, 580, 1], [820, 600, 1], [390, 700, 1], [1280, 800, 0.5], [1280, 800, 1.5], [1280, 800, 2], [1920, 1080, 1.75], [640, 400, 1]];
export function measure() {
  const out = [], vh = innerHeight, vw = innerWidth, tome = document.querySelector('.tome'), shut = tome.classList.contains('shut'), tb = (shut ? tome.querySelector('.tome-cover') : tome).getBoundingClientRect(); // shut, only the cover shows
  if (tb.top < -1 || tb.bottom > vh + 1 || tb.left < -1 || tb.right > vw + 1) out.push('tome leaves the window ' + JSON.stringify([tb.left, tb.top, tb.right, tb.bottom].map(Math.round)) + ' in ' + vw + 'x' + vh);
  for (const sec of document.querySelectorAll('.tome-page')) {
    if (!sec.dataset.page || getComputedStyle(sec).visibility === 'hidden') continue;
    const n = sec.dataset.page, sb = sec.getBoundingClientRect(), cs = getComputedStyle(sec);
    if (sec.scrollHeight > sec.clientHeight + 1) out.push('p' + n + ' scrolls ' + sec.scrollHeight + '>' + sec.clientHeight);
    const folio = sec.querySelector('.tome-folio'), fb = folio && folio.getBoundingClientRect();
    const floor = sb.bottom - parseFloat(cs.paddingBottom) + 1;
    const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT); let t;
    while ((t = walker.nextNode())) {
      if (!t.textContent.trim() || (folio && folio.contains(t))) continue;
      const el = t.parentElement, es = getComputedStyle(el);
      if (es.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push('p' + n + ' ellipsis: ' + t.textContent.trim().slice(0, 40));
      if (es.webkitLineClamp && es.webkitLineClamp !== 'none') out.push('p' + n + ' line-clamp: ' + t.textContent.trim().slice(0, 40));
      if (el.closest('.tome-head')) continue;
      const tier = sec.querySelector(':scope > .tome-tier'), inTier = tier && tier.contains(t);
      const r = document.createRange(); r.selectNodeContents(t);
      for (const b of r.getClientRects()) {
        if (b.height < 1) continue;
        if (inTier) { if (b.bottom > sb.bottom + 1) { out.push('p' + n + ' rating below the page'); break; } continue; }
        const tb2 = tier && tier.getBoundingClientRect();
        if (tb2 && b.bottom > tb2.top + 1 && b.top < tb2.bottom && b.right > tb2.left && b.left < tb2.right) { out.push('p' + n + ' rating overlaps "' + t.textContent.trim().slice(0, 40) + '"'); break; }
        if (b.bottom > floor) { out.push('p' + n + ' text below the page: "' + t.textContent.trim().slice(0, 50) + '" ' + Math.round(b.bottom - floor) + 'px'); break; }
        if (fb && b.bottom > fb.top && b.top < fb.bottom && b.right > fb.left && b.left < fb.right) { out.push('p' + n + ' folio overlaps "' + t.textContent.trim().slice(0, 40) + '"'); break; }
      }
    }
    const txt = sec.innerText || '';
    if (/\S…(\s|$)/.test(txt)) out.push('p' + n + ' a cut "…"');
    for (const p of sec.querySelectorAll('p')) { const s = p.textContent.trim(); if (s.length > 30 && !/[.!?…:)"”’']$/.test(s) && !p.classList.contains('tome-sub')) out.push('p' + n + ' sentence ends unfinished: "…' + s.slice(-40) + '"'); }
  }
  return out;
}
const { chromium } = await import('playwright-core');
const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const quick = !!process.env.BOOK_QUICK, shots = process.env.BOOK_SHOTS;
let bad = 0;
const settle = (page) => page.waitForFunction(() => window.__voidBook && !window.__voidBook.turning, null, { timeout: 8000 }).then(() => page.waitForTimeout(120));
async function sweep(page, label) {
  const total = await page.evaluate(() => document.querySelector('.tome').dataset.pages | 0);
  const fails = new Set(); const step = await page.evaluate(() => innerWidth < 700 ? 1 : 2);
  const ns = []; for (let n = 1; n <= total; n += step) if (!quick || n <= 12 || n % 23 < step) ns.push(n);
  for (const n of ns) {
    await page.evaluate((n) => window.__voidBook.go(n), n); await settle(page); if (n === ns[0]) await page.waitForTimeout(1800); else await page.waitForTimeout(350);
    for (const f of await page.evaluate(measure)) fails.add(f);
  }
  console.log((fails.size ? 'FAIL ' : 'ok   ') + label + ' (' + total + ' pages)' + (fails.size ? '\n   ' + [...fails].slice(0, 25).join('\n   ') + (fails.size > 25 ? '\n   … ' + (fails.size - 25) + ' more' : '') : ''));
  if (fails.size) bad++;
}
for (const [w, h, z] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: Math.round(w / z), height: Math.round(h / z) }, deviceScaleFactor: z, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); page.on('pageerror', () => {});
  try {
    await page.goto(SITE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const input = page.locator('input, textarea').first(); await input.click(); await input.fill('open the book'); await input.press('Enter');
    await page.waitForFunction(() => window.__voidBook && window.__voidBook.open, null, { timeout: 30000 }); await page.waitForTimeout(1500);
    const label = w + 'x' + h + ' zoom ' + Math.round(z * 100) + '%';
    await sweep(page, label);
    if (shots) { await page.evaluate(() => window.__voidBook.go(2)); await settle(page); await page.screenshot({ path: shots + '-' + w + 'x' + h + '-z' + Math.round(z * 100) + '.png' }); }
    if (z === 1 && w >= 1024) { // resized with the book open: shorter, then narrower
      await page.setViewportSize({ width: w, height: Math.round(h * 0.6) }); await page.waitForTimeout(400); await sweep(page, label + ' resized to ' + w + 'x' + Math.round(h * 0.6));
      await page.setViewportSize({ width: Math.round(w * 0.55), height: h }); await page.waitForTimeout(400); await sweep(page, label + ' resized to ' + Math.round(w * 0.55) + 'x' + h);
    }
  } catch (e) { bad++; console.log('FAIL ' + w + 'x' + h + ' zoom ' + z + ' did not open: ' + e.message.split('\n')[0]); }
  await ctx.close();
}
await b.close();
process.exit(bad ? 1 : 0);
