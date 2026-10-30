// Versus by size (owner, 2026-10-29: smallest is the fewest interactive elements on the home page, then the fewest bytes): measure each rival's
// home page (its controls, the bytes its html, scripts and styles transfer, how many scripts and elements it has, how many routes its sitemap or
// links show) and write void-live-deploy/tower.size.json, which lib/tower.js reads to put the smallest site first. Runs on a runner (tower-size.yml;
// the sandboxes cannot reach rivals). One plain GET of the home page, its robots.txt and sitemap and its own scripts and styles, only for sites whose
// robots.txt allows it; never a site in noRival. Rows younger than 30 days are kept; each run reads at most --max sites (default 120), unmeasured
// first, then the rows with no controls count yet. With a browser (VOID_TEST_BROWSER, as tower-size.yml installs it) the controls are counted on the
// rendered page, after its scripts ran, so a page a script builds is not read as its empty shell (2026-10-29: serverdiscounter.com read 3 controls
// from 210 KB of html); rows counted only from raw html are read again. Without a browser the raw count stands, marked counted: 'html'.
// A run stops taking new sites after --minutes (default 35) and gives each site at most 90 s, so it always writes what it read before the job's
// time limit (2026-10-29: an 850-site run hit the 45-minute limit and wrote nothing).
//   node tools/tower-size.mjs [--max 120] [--minutes 35] [--only host,host]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOORS, frontierOf, hostOf, noRivalUrl } from '../void-live-deploy/lib/tower.js';
import { controlsOf, measure, weightOf } from '../void-live-deploy/lib/tower-weight.js';
import { robotsAllows } from './feature-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'void-live-deploy', 'tower.size.json');
const UA = 'Mozilla/5.0 (compatible; VerseBot/1.0; +https://a-to-mind.com/)', DAY = 864e5, FRESH_DAYS = 30;
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };

/** the sites to read this run: unmeasured first, then a weighed row with no controls count yet (the queue ranks on controls, then bytes), then, when
 *  this run renders pages, a row whose controls were counted only from raw html, then the oldest rows past their 30 days; never a no-rival site; at
 *  most max. Pure. */
export function planSizes({ sites, file = {}, now = Date.now(), max = 120, rendered = false }) {
  const rows = file.sites || {}, due = (s) => { const r = rows[s.host]; return !r ? 0 : !r.refused && !Number.isFinite(+r.controls) ? 1 : rendered && !r.refused && !['rendered', 'unrendered'].includes(r.counted) ? 1.5 : now - Date.parse(r.at || 0) > FRESH_DAYS * DAY ? 2 : null; };
  return sites.filter((s) => s.host && !noRivalUrl('https://' + s.host + '/')).map((s) => ({ s, d: due(s) })).filter((x) => x.d !== null).sort((a, b) => a.d - b.d).slice(0, max).map((x) => x.s);
}
const get = async (url, max = 3e6) => { const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(12000) }); const buf = Buffer.from(await r.arrayBuffer()).subarray(0, max); return { ok: r.ok, status: r.status, buf, type: r.headers.get('content-type') || '', url: r.url }; };
/** a page worth weighing: a working site, not an empty reply, a bot wall, an error, an "offline" or "coming soon" notice or a parked domain. It needs real
 *  visible text (at least 120 characters) and something to use (a form, input, button, select, canvas or script). Pure. */
export const STUB_RE = /\b(is offline|currently offline|temporarily unavailable|service unavailable|coming soon|under construction|under maintenance|be right back|domain (?:is )?for sale|buy this domain|parked|default web page|welcome to nginx|it works!|access denied|just a moment|enable javascript|attention required|403 forbidden|404 not found|page not found)\b/i;
export function usable(html) {
  const t = String(html), text = t.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 300 && text.length >= 120 && !STUB_RE.test(text.slice(0, 600)) && /<(form|input|button|select|textarea|canvas|script)\b/i.test(t);
}
export const CONTENT_RE = /\b(fan ?fic(?:tion)?|forums?|community|webmistress|webmaster|members?|log ?in|sign ?in|sign ?up|register|subscribe|newsletter|latest news|blog|archive of|read more|terms of service|privacy policy|all rights reserved|copyright \d{4}|staff|contest|announcements?)\b/gi;
/** a tool, not a content site: the page does something with an input (not just a search or login box) and its words are not a community's, a blog's or a
 *  news site's. Pure; a heuristic, a content site with a form can still pass. */
export function isTool(html) {
  const t = String(html), text = t.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const content = (text.match(CONTENT_RE) || []).length;
  const real = /<(textarea|select|canvas)\b/i.test(t) || /<input\b(?![^>]*type=["']?(?:search|hidden|password|email|submit|checkbox)["']?)(?![^>]*name=["']?(?:q|s|search|query|user|username|login|email|pass)["']?)/i.test(t) || /<button\b/i.test(t);
  return real && content < 3;
}
/** the controls of a page after its scripts ran: one page of the run's one browser, images, media and fonts not fetched, the html read once the
 *  network is quiet (at most 6 s after it loaded). Null when the page will not render. */
export async function renderedControls(browser, url) {
  let ctx = null;
  try {
    ctx = await browser.newContext({ userAgent: UA, javaScriptEnabled: true });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
    // a page whose load event never fires (a slow ad or tracker) has still built its page: count what is there, unless it never left about:blank
    const loaded = await page.goto(url, { waitUntil: 'load', timeout: 20000 }).then(() => true, () => false);
    if (loaded) await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    else if (!/^https?:/.test(page.url())) return null;
    const n = controlsOf(await page.content()).total;
    return loaded || n > 0 ? n : null;
  } catch (_) { return null; } finally { if (ctx) await ctx.close().catch(() => {}); }
}
/** the run's one browser, when this machine has one (VOID_TEST_BROWSER or the sandbox path), else null: the raw count stands. */
export async function openBrowser() {
  const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
  if (!exe) return null;
  try { const { chromium } = await import('playwright-core'); return await chromium.launch({ executablePath: exe, headless: true }); } catch (_) { return null; }
}
/** p, or null once ms have passed: one slow site cannot hold a worker past its share of the run. */
export const within = (p, ms) => { let t; return Promise.race([p, new Promise((r) => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t)); };
/** read one site: its home page and what it loads, and with a browser its controls after its scripts ran. Returns a row or null (refused, unreachable). */
export async function readSite(host, { browser = null } = {}) {
  const base = 'https://' + host + '/';
  try {
    const rb = await get(base + 'robots.txt', 2e5).catch(() => null);
    if (rb && rb.ok && /text/.test(rb.type) && !robotsAllows(rb.buf.toString('utf8'), '/')) return null;
    const home = await get(base); if (!home.ok || !/html/.test(home.type)) return null;
    const html = home.buf.toString('utf8'), origin = new URL(home.url).origin, found = [];
    if (!usable(html)) return null; // isTool() stays exported but is not applied: the owner asked for the smallest site by size, not the smallest tool (2026-10-29) // an empty body, a bot wall or a redirect stub says nothing about the site: not weighed, never lightest
    for (const m of html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["']|<link\b[^>]*rel=["']?stylesheet[^>]*\shref=["']([^"']+)["']/gi)) { try { const u = new URL(m[1] || m[2], home.url); if (found.length < 12) found.push(u.href); } catch (_) { /* a bad url */ } }
    const assets = []; for (const u of found) { try { const a = await get(u); if (a.ok) assets.push({ url: u, bytes: a.buf.length }); } catch (_) { /* skipped */ } }
    let sm = null; try { const s = await get(origin + '/sitemap.xml', 2e6); if (s.ok) sm = (s.buf.toString('utf8').match(/<loc>/g) || []).length || null; } catch (_) { /* none */ }
    const m = measure({ html, htmlBytes: home.buf.length, assets, sitemapUrls: sm, host });
    const seen = browser ? await renderedControls(browser, home.url) : null, counted = seen !== null ? { controls: seen, htmlControls: m.controls, counted: 'rendered' } : { counted: browser ? 'unrendered' : 'html' }; // unrendered: the browser tried and the page would not render, so it waits its 30 days
    return { ...m, ...counted, weight: weightOf(m), at: new Date().toISOString().slice(0, 10) };
  } catch (_) { return null; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const fr = readJson(path.join(ROOT, 'void-live-deploy', 'tower.frontier.json'), null), file = readJson(OUT, { sites: {} }), only = opt('--only', '');
  const sites = FLOORS.map((f) => ({ id: f.id, host: hostOf(f.url) })).concat(frontierOf(fr).map((x) => ({ id: x.host, host: x.host })));
  const browser = await openBrowser();
  const list = only ? sites.filter((s) => only.split(',').includes(s.host)) : planSizes({ sites, file, max: Number(opt('--max', 120)), rendered: !!browser });
  const out = { about: 'How big each Versus site really is, measured by tools/tower-size.mjs: the interactive elements on its home page (controls: links, inputs, buttons, selects; counted on the rendered page when counted is rendered, with htmlControls the raw-html count, else on the raw html), transfer bytes of its home page plus its own scripts and styles, script and element counts, routes (sitemap urls, else internal links). The queue ranks the fewest controls first, the fewer bytes on a tie. weight = bytes + 2000 per script + 10 per element + 500 per route (lib/tower-weight.js). Keyed by host.', sites: { ...(file.sites || {}) } };
  let n = 0, late = 0; const queue = [...list], stop = Date.now() + Math.max(1, Number(opt('--minutes', 35)) || 35) * 6e4;
  // a known site that timed out or would not render keeps its row, marked unrendered, and waits its 30 days
  // one browser, at most 3 pages in it at once (AGENTS.md: never 2 heavy browser jobs at once; the workflow's concurrency group keeps this the only one)
  await Promise.all(Array.from({ length: browser ? 3 : 6 }, async () => { for (let s; (s = queue.shift());) { if (Date.now() > stop) { late++; continue; } const r = await within(readSite(s.host, { browser }), 90000); if (r) { out.sites[s.host] = r; n++; } else if (!out.sites[s.host]) out.sites[s.host] = { refused: true, at: new Date().toISOString().slice(0, 10) }; else if (browser && !out.sites[s.host].refused) out.sites[s.host] = { ...out.sites[s.host], counted: 'unrendered' }; } }));
  if (browser) await browser.close().catch(() => {});
  fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, k === 'sites' ? Object.fromEntries(Object.entries(v).sort()) : v])), null, 1) + '\n');
  console.log('measured ' + n + ' of ' + list.length + ' sites' + (late ? ', ' + late + ' left for the next run (time budget)' : '') + (browser ? ', controls counted on the rendered page' : ', controls counted from raw html (no browser)'));
}
