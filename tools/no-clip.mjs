// Nothing is clipped, at three window sizes (owner, 2026-10-21: "the bottom gets cut off", "i need to see the whole sentences"): on the live
// site (or VOID_SITE), the book's What's new and the self card are opened at 1280x800, 820x600 and 390x700; each fails when the book's box
// leaves the window, when the card's text shows a cut "…", or when a text element hides its words (text-overflow: ellipsis that is overflowing).
//   CHROME_PATH=/usr/bin/google-chrome node tools/no-clip.mjs     exit 1 on any clip; prints one line per size and card
import { existsSync } from 'node:fs';
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const SIZES = [[1280, 800], [820, 600], [390, 700]];
export const ASKS = [["what's new in the book", '.tome'], ['what do you think of yourself', '.vc-self'], ['show me what you made', '#showcase-bar']]; // the last: the "I built this" walkthrough and its reaction row
const { chromium } = await import('playwright-core');
const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let bad = 0;
for (const [w, h] of SIZES) for (const [ask, sel] of ASKS) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  try {
    await page.goto(SITE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const input = page.locator('input, textarea').first(); await input.click(); await input.fill(ask); await input.press('Enter');
    await page.waitForSelector(sel, { timeout: 30000 }); await page.waitForTimeout(sel === '.vc-self' ? 9000 : 4000);
    const r = await page.evaluate((sel) => {
      const el = document.querySelector(sel), box = el.getBoundingClientRect();
      const hidden = [...el.querySelectorAll('*')].filter((n) => { const s = getComputedStyle(n); return s.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1 && (n.textContent || '').trim().length > 0; }).length;
      // anything inside that pokes out past the box or the window's sides (the walkthrough's last reaction emoji was cut at 1280px)
      const spill = sel !== '#showcase-bar' ? 0 : [...el.querySelectorAll('*')].filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && (r.right > Math.min(box.right, innerWidth) + 1 || r.left < Math.max(box.left, 0) - 1); }).length;
      return { spill, top: Math.round(box.top), bottom: Math.round(box.bottom), vh: innerHeight, cut: ((el.innerText || '').match(/\S…(\s|$)/g) || []).length, hidden };
    }, sel);
    const off = sel === '.tome' && (r.top < 0 || r.bottom > r.vh);
    const fail = off || r.cut || r.hidden || r.spill; if (fail) bad++;
    console.log((fail ? 'FAIL ' : 'ok   ') + w + 'x' + h + ' ' + sel + ' ' + JSON.stringify(r));
  } catch (e) { bad++; console.log('FAIL ' + w + 'x' + h + ' ' + sel + ' did not open: ' + e.message.split('\n')[0]); }
  await page.close();
}
await b.close();
// the book page by page, at many sizes and zooms, with resizes (tools/book-fit.mjs): its box fitting the window was not enough, the
// sheets scrolled inside and cut their last lines (owner, 2026-10-21)
{ const { spawnSync } = await import('node:child_process'); const r = spawnSync(process.execPath, [new URL('./book-fit.mjs', import.meta.url).pathname], { stdio: 'inherit', env: { BOOK_QUICK: '1', ...process.env } }); if (r.status !== 0) bad++; }
// animated glitch titles stay one whole, evenly spaced word at every sampled frame, on the live films card too (tools/glitch-titles.mjs;
// owner, 2026-10-22: "VERSE F   I   LMS")
{ const { spawnSync } = await import('node:child_process'); const r = spawnSync(process.execPath, [new URL('./glitch-titles.mjs', import.meta.url).pathname, '--live'], { stdio: 'inherit', env: { VOID_SITE: SITE, ...process.env } }); if (r.status !== 0) bad++; }
process.exit(bad ? 1 : 0);
