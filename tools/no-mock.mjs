// No mocks in production paths (owner's standards, 2026-10-28; docs/GATE-STANDARDS.md): a page that claims live data and cannot get it
// must say so on the page. Each live-data page below is opened in a real browser from the files in void-live-deploy (no server: the browser's
// requests are answered from disk), with its live data cut off (/api/ and every outside host fail). The page must then show a visible
// degradation notice (offline, could not reach, saved copy, try again ...) that its own markup did not already carry, and none of the stub
// or placeholder texts (lib/tower-controls.js). A page that quietly shows static or made-up data instead fails the build.
//   node tools/no-mock.mjs [page ...]      (VOID_TEST_BROWSER: the browser, default /usr/bin/google-chrome)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { negativesOf } from '../void-live-deploy/lib/tower-controls.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy');
/** the pages that claim live data: each fetches /api/ for what it shows */
export const LIVE = ['/markets/', '/weather/', '/news/', '/scores/', '/podcasts/', '/recipes/', '/translate/', '/calendar/'];
/** words that tell a person the live data did not come */
export const NOTICE_RE = /\b(?:offline|could(?: not|n[’']t) (?:reach|load|get|fetch|connect)|can(?:not|[’']t) (?:reach|load|get|connect)|unavailable|no connection|not reachable|saved copy|cached|last (?:saved|known|fetched)|try again|failed to load|showing (?:an? )?(?:older|saved|offline))\b/i;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const ORIGIN = 'https://verse.test';

/** the verdict on one page's text after its live data was cut off: { ok, why }. The notice must be a line the page wrote because the data
 *  did not come, not one its markup already carries ("works offline" in an intro is not a notice). Pure. */
export function judge(text, staticText = '') {
  const bad = negativesOf(text).filter((x) => !/almost nothing/.test(x));
  if (bad.length) return { ok: false, why: bad.join('; ') };
  const had = new Set(String(staticText).split('\n').map((l) => l.trim()).filter(Boolean));
  const said = String(text).split('\n').map((l) => l.trim()).filter((l) => l && !had.has(l) && NOTICE_RE.test(l));
  if (!said.length) return { ok: false, why: 'no visible notice that the live data did not come' };
  return { ok: true, why: 'says so: "' + said[0].slice(0, 90) + '"' };
}

/** answer a browser request from the files on disk; with cut, /api/ and every outside host fail as if the network were down */
function serve(r, cut) {
  const u = new URL(r.request().url());
  if (u.origin !== ORIGIN || (cut && u.pathname.startsWith('/api/'))) return r.abort('internetdisconnected');
  let f = path.join(site, decodeURIComponent(u.pathname)); if (!f.startsWith(site)) return r.abort();
  if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
  return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
}

async function run(pages) {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let failed = 0;
  for (const p of pages) {
    let text = '', staticText = '';
    try { const plain = await b.newContext({ javaScriptEnabled: false }), pp = await plain.newPage(); await plain.route('**/*', (r) => serve(r, false));
      await pp.goto(ORIGIN + p, { waitUntil: 'load', timeout: 20000 }); staticText = await pp.evaluate(() => document.body.innerText); await plain.close(); } catch (_) {}
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), page = await ctx.newPage();
    await ctx.route('**/*', (r) => serve(r, true));
    try { await page.goto(ORIGIN + p, { waitUntil: 'load', timeout: 20000 }); await page.waitForTimeout(3500); text = await page.evaluate(() => document.body.innerText); } catch (_) { text = ''; }
    const v = text ? judge(text, staticText) : { ok: false, why: 'the page did not load from disk (INCOMPLETE)' };
    if (!v.ok) failed++;
    console.log((v.ok ? 'ok   ' : 'FAIL ') + p.padEnd(14) + v.why);
    await ctx.close();
  }
  await b.close();
  return failed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), n = await run(args.length ? args : LIVE);
  if (n) { console.log(n + ' live-data page(s) show no notice when their data does not come'); process.exit(1); }
}
