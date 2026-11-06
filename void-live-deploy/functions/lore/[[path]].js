// a-to-mind.com/lore/<site>: one site Verse has come across, as a source anyone can use (owner, 2026-11-06: every site gets its own page, sorted
// and documented, and each site becomes a usable source). The same address answers three ways, like /ip: plain text for scripts and other
// agents (curl a-to-mind.com/lore/4chan), JSON (?format=json or Accept: application/json) and a page for a person with no script. Every fact
// carries the address it came from (Wikidata, Wikipedia, the Wayback Machine: tools/site-history.mjs); facts no source has given yet are counted,
// never filled in. The list of every site is /lore/ (a static page) and /lore.json (tools/lore.mjs).
import { formatOf } from '../ip/index.js';
import { TOOLS } from '../../lib/toolkit.js';

export const slugOf = (site) => String(site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const httpsOnly = (u) => (/^https:\/\/[^\s"<>]+$/.test(String(u || '')) ? String(u) : '');
const ORIGIN = 'https://a-to-mind.com';

/** one site's record from its lore.json row and its history file: what the text, JSON and page all show. Pure. */
export function recordOf(row, h) {
  const events = (h && h.events) || [];
  const facts = events.filter((e) => !e.u).map((e) => ({ section: e.k, year: e.y || '', text: e.t, source: httpsOnly(e.s) })).filter((f) => f.source);
  return {
    site: row.n, slug: row.s, url: httpsOnly(row.u), category: row.c, sortedBy: { job: 'the job it does', title: 'its home-page title', wikidata: 'Wikidata', fetch: 'a fetch of its home page' }[row.cf] || 'not sorted yet',
    onTheTower: row.st, versePage: row.p || null, settled: row.g || null, machine: row.m || null,
    facts, archived: ((h && h.snaps) || []).map(([y, u]) => ({ year: String(y), url: httpsOnly(u) })).filter((a) => a.url),
    unknown: events.length - events.filter((e) => !e.u).length,
    record: ORIGIN + '/lore/' + row.s, document: h && h.doc ? 'https://github.com/atomeam/void-loop/blob/main/' + h.doc : null,
    note: 'Every fact links its source. Unknown means no source was found yet; nothing is guessed.',
  };
}
/** the plain-text answer: one fact a line, each with its source address. Pure. */
export function textOf(r) {
  const L = [r.site, r.url, 'Category: ' + r.category + ' (sorted by ' + r.sortedBy + ')', 'On the Versus tower: ' + r.onTheTower + (r.versePage ? ' · Verse page: ' + ORIGIN + r.versePage : ''), ''];
  if (!r.facts.length) L.push('No cited history yet. It is on the queue for the next history run.');
  for (const f of r.facts) L.push(f.section + ': ' + f.text + ' <' + f.source + '>');
  if (r.archived.length) L.push('', 'Archived copies: ' + r.archived.map((a) => a.year + ' <' + a.url + '>').join(' '));
  if (r.unknown) L.push('', r.unknown + ' more facts have no source yet.');
  L.push('', 'Record: ' + r.record);
  return L.join('\n') + '\n';
}
// the pages this one belongs with: the list of every site, Versus where the sites are fought, the Lab, the Treasury, and home
export const WITH = Object.freeze([['/lore/', 'Every site in Web Lore'], ['/conquered/', 'Versus: the sites Verse takes on'], ['/lab/', 'Lab'], ['/treasury/', 'Treasury']]);
export function nav(r) {
  const link = (href, label) => '<a href="' + esc(href) + '">' + esc(label) + '</a>';
  const own = r && r.versePage ? [link(r.versePage, 'Verse’s ' + (TOOLS[r.versePage] || 'page') + ' for this'), link('/compare/?floor=' + encodeURIComponent(r.site), 'Side by side')] : [];
  return '<nav aria-label="Use with"><span>Use with</span>' + own.join('') + WITH.map(([h, l]) => link(h, l)).join('') + '</nav><p class="home"><a href="/">Ask Verse anything</a></p>';
}
const CSS = 'html{background:#05060a;color:#e8e6ff;font:16px/1.5 system-ui,sans-serif;color-scheme:dark}body{margin:0}main{max-width:760px;margin:0 auto;padding:18px 16px 40px}'
  + 'h1{font-size:24px;margin:4px 0}h2{font-size:15px;margin:18px 0 6px;color:#c9b8ff}.sub{color:#9a98c0;margin:0 0 4px;font-size:14px}ol{margin:0;padding-left:20px}li{margin:4px 0}'
  + 'a{color:#cfc6ff}.src{font-size:13px}code{color:#c9b8ff;word-break:break-all}nav{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:28px 0 0;font-size:14px}nav span{color:#9a98c0}'
  + 'nav a,.home a{color:#e8e6ff;display:inline-flex;align-items:center;min-height:40px;padding:4px 12px;border:1px solid #2c2938;border-radius:999px;text-decoration:none}nav a:hover,nav a:focus-visible{border-color:#a58bff}.home a{border-color:#a58bff}.note{color:#9a98c0;font-size:13px}';
/** the page a person sees. No script. Pure. */
export function page(r) {
  const groups = new Map(); for (const f of r.facts) { if (!groups.has(f.section)) groups.set(f.section, []); groups.get(f.section).push(f); }
  const body = r.facts.length ? [...groups.entries()].map(([k, fs]) => '<h2>' + esc(k) + '</h2><ol>' + fs.map((f) => '<li>' + esc(f.text) + ' <a class="src" href="' + esc(f.source) + '" rel="noopener noreferrer">(source)</a></li>').join('') + '</ol>').join('')
    : '<p>No cited history yet. It is on the queue for the next history run, and this page fills in by itself.</p>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(r.site) + ' · Web Lore · Verse</title>'
    + '<meta name="description" content="' + esc('The cited history of ' + r.site + ': every fact with its source. Also as plain text and JSON.') + '"><link rel="canonical" href="' + esc(r.record) + '">'
    + '<link rel="alternate" type="application/json" href="' + esc(r.record + '?format=json') + '"><link rel="icon" href="/icon.svg" type="image/svg+xml"><style>' + CSS + '</style></head><body><main>'
    + '<p class="sub"><a href="/lore/">Web Lore</a> · ' + esc(r.category) + '</p><h1>' + esc(r.site) + '</h1>'
    + '<p class="sub">' + (r.url ? '<a href="' + esc(r.url) + '" rel="noopener noreferrer">' + esc(r.url) + '</a> · ' : '') + 'on the Versus tower: ' + esc(r.onTheTower) + (r.machine ? ' · ' + esc(r.machine) : '') + '</p>'
    + body
    + (r.archived.length ? '<h2>Archived copies</h2><p>' + r.archived.map((a) => '<a href="' + esc(a.url) + '" rel="noopener noreferrer">' + esc(a.year) + '</a>').join(' · ') + '</p>' : '')
    + '<p class="note">' + (r.unknown ? esc(r.unknown + ' more facts have no source yet. ') : '') + esc(r.note) + ' Sorted by ' + esc(r.sortedBy) + '.' + (r.document ? ' <a href="' + esc(r.document) + '">The full record with every source</a>.' : '') + '</p>'
    + '<p class="note">For scripts and agents: <code>curl a-to-mind.com/lore/' + esc(r.slug) + '</code> gives plain text, <code>?format=json</code> gives JSON.</p>'
    + nav(r) + '</main></body></html>';
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
/** the row an ask names: its slug, its host (4chan.org), its host without the ending (theguardian), or its name. Pure. */
export function rowOf(sites, q) {
  const k = slugOf(q); if (!k) return null;
  const stem = (h) => h.replace(/\.[a-z]{2,}(?:\.[a-z]{2})?$/, '');
  return sites.find((s) => s.s === k) || sites.find((s) => hostOf(s.u) === k) || sites.find((s) => slugOf(s.n) === k)
    || sites.find((s) => stem(hostOf(s.u)) === k) || sites.find((s) => stem(s.s) === k) || null;
}
let LORE = null, LORE_AT = 0;
async function loreOf(env, url) {
  if (LORE && Date.now() - LORE_AT < 300000) return LORE;
  const r = await env.ASSETS.fetch(new URL('/lore.json', url)); if (!r.ok) return null;
  LORE = await r.json(); LORE_AT = Date.now(); return LORE;
}
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const parts = [].concat((params && params.path) || []).filter(Boolean);
  const fmt = formatOf(request.url, request.headers.get('accept'));
  const headers = { 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*', vary: 'accept' };
  if (!parts.length) {
    if (fmt === 'html') return context.next(); // the list itself is the static /lore/ page
    const lore = await loreOf(env, request.url); if (!lore) return new Response('Web Lore is not built yet\n', { status: 503, headers });
    if (fmt === 'json') return Response.json(lore, { headers });
    return new Response(lore.sites.map((s) => s.c + '\t' + s.n + '\t' + ORIGIN + '/lore/' + s.s).join('\n') + '\n', { headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
  }
  const lore = await loreOf(env, request.url);
  const slug = slugOf(decodeURIComponent(parts.join('/')));
  const row = lore && rowOf(lore.sites, slug);
  if (!row) {
    const msg = 'No site named ' + slug + ' in Web Lore yet. Every site: ' + ORIGIN + '/lore/';
    if (fmt === 'json') return Response.json({ ok: false, error: msg }, { status: 404, headers });
    if (fmt === 'html') return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not in Web Lore yet</title><style>' + CSS + '</style></head><body><main><h1>Not in Web Lore yet</h1><p>' + esc('No site named ' + slug + ' yet.') + '</p>' + nav(null) + '</main></body></html>', { status: 404, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    return new Response(msg + '\n', { status: 404, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
  }
  const hr = await env.ASSETS.fetch(new URL('/history/' + encodeURIComponent(row.s) + '.json', request.url));
  const h = hr.ok ? await hr.json().catch(() => null) : null;
  const r = recordOf(row, h);
  if (fmt === 'json') return Response.json({ ok: true, ...r }, { headers });
  if (fmt === 'html') return new Response(page(r), { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
  return new Response(textOf(r), { headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
}
