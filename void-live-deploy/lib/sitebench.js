// A live benchmark of two pages, measured by Verse's own server when someone asks (functions/api/sitebench.js, the /starboard/ page).
// The owner's rule for it, 2026-11-06: write no number that was not measured. Each number here comes from one real fetch made at `at`:
//   ms         the time from the first byte asked for the page until the page and every resource it names came back (fetched in parallel)
//   html_bytes the page's own HTML, as it arrived
//   requests   1 for the page plus each script, stylesheet, image, icon and frame its HTML names (the fetches a first load starts)
//   bytes      the HTML plus every one of those resources that answered, summed from the bodies themselves
//   hosts      every host those requests go to; third_party is the ones off the page's own domain (where trackers and ad servers sit)
//   script_hosts the hosts named inside the scripts that came back: places the page's code can call once it runs. A name is not a request.
// The server does not run the scripts, so what a script loads after it runs is not in `requests`; script_hosts is the measured hint of it.
// Pure, except measurePage, which takes the fetch to use.

export const TARGETS = Object.freeze({
  'dalyfeds.com': 'https://dalyfeds.com/',
});
export const SELF_PATH = '/starboard/';
export const MAX_ASSETS = 40;
export const TIMEOUT_MS = 8000;
export const CACHE_S = 600;

/** the registrable part of a host, by its last two labels (three for a two-letter country code under a short second level, like co.uk). Pure. */
export function siteOf(host) {
  const parts = String(host || '').toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const tld = parts[parts.length - 1], sld = parts[parts.length - 2];
  return tld.length === 2 && sld.length <= 3 ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
}

const ATTR = (tag, attr) => new RegExp('<' + tag + '\\b[^>]*?\\s' + attr + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'gi');
const RELS = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const LOADS = /(^|\s)(stylesheet|icon|apple-touch-icon|preload|modulepreload|manifest|shortcut)(\s|$)/i;

/** the resources a page's HTML names, as absolute URLs: { scripts, styles, images, frames, other }. Pure. */
export function resourcesOf(html, pageUrl) {
  const src = String(html || ''), out = { scripts: [], styles: [], images: [], frames: [], other: [] };
  const abs = (u) => { try { const x = new URL(String(u).trim().replace(/&amp;/g, '&'), pageUrl); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (_) { return null; } };
  const take = (re, into) => { for (const m of src.matchAll(re)) { const u = abs(m[1] ?? m[2] ?? m[3]); if (u) into.push(u); } };
  take(ATTR('script', 'src'), out.scripts);
  take(ATTR('img', 'src'), out.images);
  take(ATTR('iframe', 'src'), out.frames);
  for (const m of src.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0], rel = RELS.exec(tag), href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    if (!rel || !href) continue;
    const r = rel[1] ?? rel[2] ?? rel[3];
    if (!LOADS.test(r)) continue;
    const u = abs(href[1] ?? href[2] ?? href[3]);
    if (u) (/stylesheet/i.test(r) ? out.styles : out.other).push(u);
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])];
  return out;
}

/** the hosts named as web addresses inside script text (https://host or //host). Pure. */
export function hostsNamedIn(text) {
  const hosts = new Set();
  for (const m of String(text || '').matchAll(/(?:https?:)?\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?=[/:"'`?#\s)]|$)/gi)) {
    const h = m[1].toLowerCase();
    if (/\.[a-z]{2,}$/.test(h) && !/\.(?:js|css|png|svg|jpg|json|html|map|webp|gif)$/.test(h)) hosts.add(h);
  }
  return [...hosts].sort();
}

async function timed(fetchImpl, url, ms) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const r = await fetchImpl(url, { redirect: 'follow', signal: ac ? ac.signal : undefined, headers: { 'user-agent': 'Mozilla/5.0 (compatible; VerseBench/1.0; +https://a-to-mind.com/starboard/)', accept: '*/*' } });
    const buf = new Uint8Array(await r.arrayBuffer());
    return { ok: r.ok, status: r.status, bytes: buf.byteLength, body: buf, type: r.headers.get('content-type') || '', url: r.url || url };
  } catch (e) {
    return { ok: false, status: 0, bytes: 0, body: null, error: String((e && e.name) || e).slice(0, 60) };
  } finally { if (t) clearTimeout(t); }
}

/** one page measured live. -> the row the benchmark shows. `now` gives milliseconds (Date.now in a Worker moves with each fetch). */
export async function measurePage(name, url, { fetchImpl = fetch, now = () => Date.now(), maxAssets = MAX_ASSETS, timeoutMs = TIMEOUT_MS } = {}) {
  const start = now();
  const page = await timed(fetchImpl, url, timeoutMs);
  const row = { name, url, at: new Date().toISOString(), ok: page.ok, status: page.status };
  if (!page.ok || !page.body) return { ...row, error: page.error || ('the page answered ' + page.status) };
  const html = new TextDecoder().decode(page.body);
  const res = resourcesOf(html, page.url || url);
  const all = [...res.scripts, ...res.styles, ...res.images, ...res.frames, ...res.other];
  const list = all.slice(0, maxAssets);
  const got = await Promise.all(list.map((u) => timed(fetchImpl, u, timeoutMs).then((r) => ({ u, r }))));
  const ms = Math.max(0, now() - start);
  const own = siteOf(new URL(page.url || url).hostname);
  const hosts = [...new Set(all.map((u) => new URL(u).hostname.toLowerCase()))].sort();
  const scriptText = got.filter(({ u }) => res.scripts.includes(u)).map(({ r }) => (r.body ? new TextDecoder().decode(r.body) : '')).join('\n');
  const named = hostsNamedIn(scriptText);
  return { ...row, ms, html_bytes: page.bytes,
    requests: 1 + all.length, fetched: got.length, failed: got.filter(({ r }) => !r.ok).length, unfetched: all.length - list.length,
    bytes: page.bytes + got.reduce((n, { r }) => n + (r.ok ? r.bytes : 0), 0),
    scripts: res.scripts.length, styles: res.styles.length, images: res.images.length, frames: res.frames.length,
    hosts, third_party: hosts.filter((h) => siteOf(h) !== own),
    script_hosts: named, script_third_party: named.filter((h) => siteOf(h) !== own) };
}

/** both pages at once. -> { at, rows: [rival, verse] }. */
export async function bench(rival, origin, opts = {}) {
  const url = TARGETS[rival];
  if (!url) throw new Error('no such site to measure');
  const rows = await Promise.all([measurePage(rival, url, opts), measurePage('a-to-mind.com' + SELF_PATH, String(origin).replace(/\/$/, '') + SELF_PATH, opts)]);
  return { at: new Date().toISOString(), how: 'fetched just now by Verse\'s server, the scripts not run', rows };
}
