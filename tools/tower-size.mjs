// Versus by weight (owner, 2026-10-29): measure how heavy each rival's home page really is (the bytes its html, scripts and styles transfer, how many
// scripts and elements it has, how many routes its sitemap or links show) and write void-live-deploy/tower.size.json, which lib/tower.js reads to put the
// lightest site first. Runs on a runner (tower-size.yml; the sandboxes cannot reach rivals). One plain GET of the home page, its robots.txt and sitemap and
// its own scripts and styles, only for sites whose robots.txt allows it; never a site in noRival. Rows younger than 30 days are kept; each run reads at most
// --max sites (default 120), unmeasured first.
//   node tools/tower-size.mjs [--max 120] [--only host,host]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOORS, frontierOf, hostOf, noRivalUrl } from '../void-live-deploy/lib/tower.js';
import { measure, weightOf } from '../void-live-deploy/lib/tower-weight.js';
import { robotsAllows } from './feature-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'void-live-deploy', 'tower.size.json');
const UA = 'Mozilla/5.0 (compatible; VerseBot/1.0; +https://a-to-mind.com/)', DAY = 864e5, FRESH_DAYS = 30;
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };

/** the sites to read this run: unmeasured first, then the oldest rows past their 30 days; never a no-rival site; at most max. Pure. */
export function planSizes({ sites, file = {}, now = Date.now(), max = 120 }) {
  const rows = file.sites || {}, due = (s) => { const r = rows[s.host]; return !r ? 0 : now - Date.parse(r.at || 0) > FRESH_DAYS * DAY ? 1 : null; };
  return sites.filter((s) => s.host && !noRivalUrl('https://' + s.host + '/')).map((s) => ({ s, d: due(s) })).filter((x) => x.d !== null).sort((a, b) => a.d - b.d).slice(0, max).map((x) => x.s);
}
const get = async (url, max = 3e6) => { const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(12000) }); const buf = Buffer.from(await r.arrayBuffer()).subarray(0, max); return { ok: r.ok, status: r.status, buf, type: r.headers.get('content-type') || '', url: r.url }; };
/** a page worth weighing: real html with a body, not an empty reply or a few bytes of wall. Pure. */
export const usable = (html) => String(html).length >= 300 && /<(body|div|p|main|h1)\b/i.test(String(html));
/** read one site: its home page and what it loads. Returns a row or null (refused, unreachable). */
export async function readSite(host) {
  const base = 'https://' + host + '/';
  try {
    const rb = await get(base + 'robots.txt', 2e5).catch(() => null);
    if (rb && rb.ok && /text/.test(rb.type) && !robotsAllows(rb.buf.toString('utf8'), '/')) return null;
    const home = await get(base); if (!home.ok || !/html/.test(home.type)) return null;
    const html = home.buf.toString('utf8'), origin = new URL(home.url).origin, found = [];
    if (!usable(html)) return null; // an empty body, a bot wall or a redirect stub says nothing about the site: not weighed, never lightest
    for (const m of html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["']|<link\b[^>]*rel=["']?stylesheet[^>]*\shref=["']([^"']+)["']/gi)) { try { const u = new URL(m[1] || m[2], home.url); if (found.length < 12) found.push(u.href); } catch (_) { /* a bad url */ } }
    const assets = []; for (const u of found) { try { const a = await get(u); if (a.ok) assets.push({ url: u, bytes: a.buf.length }); } catch (_) { /* skipped */ } }
    let sm = null; try { const s = await get(origin + '/sitemap.xml', 2e6); if (s.ok) sm = (s.buf.toString('utf8').match(/<loc>/g) || []).length || null; } catch (_) { /* none */ }
    const m = measure({ html, htmlBytes: home.buf.length, assets, sitemapUrls: sm, host });
    return { ...m, weight: weightOf(m), at: new Date().toISOString().slice(0, 10) };
  } catch (_) { return null; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const fr = readJson(path.join(ROOT, 'void-live-deploy', 'tower.frontier.json'), null), file = readJson(OUT, { sites: {} }), only = opt('--only', '');
  const sites = FLOORS.map((f) => ({ id: f.id, host: hostOf(f.url) })).concat(frontierOf(fr).map((x) => ({ id: x.host, host: x.host })));
  const list = only ? sites.filter((s) => only.split(',').includes(s.host)) : planSizes({ sites, file, max: Number(opt('--max', 120)) });
  const out = { about: 'How heavy each Versus site really is, measured by tools/tower-size.mjs: transfer bytes of its home page plus its own scripts and styles, script and element counts, routes (sitemap urls, else internal links). weight = bytes + 2000 per script + 10 per element + 500 per route (lib/tower-weight.js). Keyed by host.', sites: { ...(file.sites || {}) } };
  let n = 0; const queue = [...list];
  await Promise.all(Array.from({ length: 6 }, async () => { for (let s; (s = queue.shift());) { const r = await readSite(s.host); if (r) { out.sites[s.host] = r; n++; } else if (!out.sites[s.host]) out.sites[s.host] = { refused: true, at: new Date().toISOString().slice(0, 10) }; } }));
  fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, k === 'sites' ? Object.fromEntries(Object.entries(v).sort()) : v])), null, 1) + '\n');
  console.log('measured ' + n + ' of ' + list.length + ' sites');
}
