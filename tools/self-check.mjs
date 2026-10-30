// Verse's check of its own pages (owner, 2026-10-30: "go all out fixing stuff ... build anything you need or want to help you right into Verse").
//   node tools/self-check.mjs                    every page of the live sitemap, opened in headless Chrome; prints what is broken
//   node tools/self-check.mjs --only /color/,/wheel/   just those pages
//   ... --json out.json                           also write the report;  --post   hand it to /api/selfcheck (VOID_OWNER_TOKEN), for the status card
// Each page is opened once, the way a person would: what it answered, its script errors, the files and APIs of its own that failed, whether it
// showed any text, its background (the design is deep space, never a white page), the "Use with" row that ties a tool to the others
// (lib/toolkit.js, or a studio's own nav.siblings), and wording Verse retired. Then every link of its own that the pages point at is asked for once. The judging is
// lib/selfcheck.js (pure, tested). It only reads: every request that is not a GET is answered here with an empty 204 and never leaves the
// browser, and the visit counter is never called, so nothing is posted, bought, counted or kept. Its traffic says who it is.
import { writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { pageProblems, reportOf, KINDS } from '../void-live-deploy/lib/selfcheck.js';

export const UA = 'VerseSelfCheck/1 (+https://a-to-mind.com/; reads only, sends nothing)';
export const PAGE_MS = 25000, SETTLE_MS = 1500, AT_ONCE = 6, LINKS_MAX = 800;
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

/** the site's own pages in a sitemap's text, as paths, each once. Pure. */
export function pathsOf(xml, site) {
  const seen = new Set(), out = [];
  for (const m of String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    let u; try { u = new URL(m[1]); } catch (_) { continue; }
    if (u.origin !== new URL(site).origin || seen.has(u.pathname)) continue; seen.add(u.pathname); out.push(u.pathname);
  }
  return out;
}
/** a console line that is the page's own fault (not a third party's, not a request already counted as failed). Pure. */
export const ownError = (text) => !/Failed to load resource|net::ERR_|favicon|third-party cookie|Permissions-Policy|was preloaded using link preload/i.test(String(text || ''));
/** links worth asking for: same site, a page or file path (no api, no mail, no anchor), path only. Pure. */
export function linkPaths(hrefs, site) {
  const o = new URL(site).origin, out = new Set();
  for (const h of hrefs || []) { let u; try { u = new URL(h, o); } catch (_) { continue; } if (u.origin !== o || /^\/(api|@|c\/|cdn-cgi)\b/.test(u.pathname)) continue; out.add(u.pathname); }
  return [...out];
}

async function openPage(browser, site, path) {
  const ctx = await browser.newContext({ userAgent: UA, extraHTTPHeaders: { 'x-void-test': 'self-check' }, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(), origin = new URL(site).origin, seen = { path, errors: [], failed: [], hrefs: [] };
  await ctx.route('**/*', (r) => { const q = r.request(), u = new URL(q.url());
    if (q.method() !== 'GET' || (u.origin === origin && u.pathname === '/api/visit')) return r.fulfill({ status: 204, body: '' });
    return r.continue(); });
  page.on('pageerror', (e) => seen.errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' && ownError(m.text())) seen.errors.push(m.text()); });
  page.on('response', (r) => { try { const u = new URL(r.url()); if (u.origin === origin && r.status() >= 400 && r.request().method() === 'GET') seen.failed.push({ url: u.pathname + u.search, status: r.status() }); } catch (_) {} });
  page.on('requestfailed', (q) => { try { const u = new URL(q.url()); const f = q.failure() && q.failure().errorText || ''; if (u.origin === origin && q.method() === 'GET' && !/ERR_ABORTED/.test(f)) seen.failed.push({ url: u.pathname + u.search, status: f || 'failed' }); } catch (_) {} });
  try {
    const res = await page.goto(origin + path, { waitUntil: 'load', timeout: PAGE_MS });
    seen.status = res ? res.status() : 0;
    await page.waitForTimeout(SETTLE_MS);
    Object.assign(seen, await page.evaluate(() => {
      const b = document.body, bg = (el) => el ? getComputedStyle(el).backgroundColor : '';
      const solid = (c) => c && !/rgba\([^)]*,\s*0\)|transparent/.test(c);
      return { text: b ? b.innerText.slice(0, 4000) : '', controls: document.querySelectorAll('input:not([type=hidden]),textarea,select,button,canvas,video,img,svg').length, bg: solid(bg(b)) ? bg(b) : bg(document.documentElement), toolRow: !!document.querySelector('.tk-row, #related a, nav.siblings a'),
        hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && !/^(#|mailto:|tel:|javascript:)/i.test(h)).slice(0, 400) };
    }));
  } catch (e) { seen.status = seen.status || 0; seen.errors.push('did not finish loading: ' + String(e && e.message || e).split('\n')[0]); }
  await ctx.close();
  seen.failed = seen.failed.filter((f, i, a) => a.findIndex((g) => g.url === f.url) === i);
  return seen;
}

/** ask for each link once (GET, redirects followed); the ones that answer 4xx/5xx. */
async function deadLinks(paths, site, known) {
  const dead = new Map(), todo = paths.filter((p) => !known.has(p)).slice(0, LINKS_MAX);
  for (let i = 0; i < todo.length; i += 8) await Promise.all(todo.slice(i, i + 8).map(async (p) => {
    try { const r = await fetch(new URL(p, site), { headers: { 'user-agent': UA, 'x-void-test': 'self-check' }, redirect: 'follow' }); if (r.status >= 400) dead.set(p, r.status); }
    catch (e) { dead.set(p, 'no answer'); }
  }));
  return dead;
}

export function summaryOf(r) {
  const lines = ['### Verse self-check: ' + (r.broken ? r.broken + ' of ' + r.checked + ' pages need a fix (' + r.serious + ' broken)' : 'all ' + r.checked + ' pages fine'), '',
    r.checked + ' pages ' + r.how + ' at ' + r.at + (r.sha ? ' on ' + r.sha : '') + '.', ''];
  for (const p of r.pages) lines.push('- `' + p.path + '`: ' + p.problems.map((x) => KINDS[x.kind] + ': ' + x.why).join('; '));
  return lines.join('\n') + '\n';
}

async function main() {
  const site = process.env.VOID_SITE || 'https://a-to-mind.com';
  const only = arg('--only');
  let paths = only ? only.split(',').map((s) => s.trim()).filter(Boolean) : pathsOf(await (await fetch(site + '/sitemap.xml', { headers: { 'user-agent': UA } })).text(), site);
  const of = paths.length;
  const { chromium } = await import('playwright-core');
  const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=user-gesture-required'] });
  const seen = []; let next = 0;
  await Promise.all(Array.from({ length: AT_ONCE }, async () => { while (next < paths.length) { const p = paths[next++]; seen.push(await openPage(browser, site, p)); } }));
  await browser.close();
  const known = new Set(paths), dead = await deadLinks(linkPaths(seen.flatMap((s) => s.hrefs || []), site), site, known);
  for (const s of seen) s.deadLinks = linkPaths(s.hrefs || [], site).filter((p) => dead.has(p)).map((p) => ({ url: p, status: dead.get(p) }));
  const report = reportOf(seen.map((s) => ({ path: s.path, problems: pageProblems(s) })), { at: new Date().toISOString(), sha: process.env.GITHUB_SHA || '', of, how: 'opened in headless Chrome after the deploy' });
  const sum = summaryOf(report); process.stdout.write(sum);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, sum);
  const out = arg('--json'); if (out) writeFileSync(out, JSON.stringify(report, null, 1));
  if (process.argv.includes('--post')) {
    const key = process.env.VOID_OWNER_TOKEN; if (!key) { console.log('no VOID_OWNER_TOKEN: the report was not handed to /api/selfcheck'); return; }
    const r = await fetch(site + '/api/selfcheck', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', origin: site, 'user-agent': UA }, body: JSON.stringify({ report }) });
    console.log('/api/selfcheck answered ' + r.status + ' ' + (await r.text()).slice(0, 200));
    if (!r.ok) process.exitCode = 1;
  }
}
if (import.meta.url === 'file://' + process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
