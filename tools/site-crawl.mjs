// The whole rival site, not its front page (owner, 2026-11-03: "the fact we missed the site does that shows a flaw that we arent actually even
// looking at the whole sites"; emojigraph.org drew every emoji on fourteen platforms on its emoji pages, which the home-page feature scan never
// opened). For a Versus site this crawls the site as a polite visitor: robots.txt first (a disallowed path is never fetched), then its sitemaps
// (sitemap index and .gz included) and the links on its pages, at most `cap` pages (200), two at a time, a pause between requests, a timeout on
// each. Pages are grouped into templates (the home page, an item page such as one emoji's page, a list or category page, a search page, a tool
// page), a few pages of each template are read, and every distinct thing a visitor can see or do on a template becomes a feature (its sections,
// buttons, boxes, grids, downloads, languages...). Verse's own pages for the floor (its page and the pages that page links to under it, as a
// browser shows them) are read the same way, and each rival feature is marked has, partial or missing against them (tower-probes.mjs showsFeature).
// The map goes into domains/features/<floor slug>.json under "crawl" (the hand-researched and "auto" sections are never touched), and
// `--publish` writes void-live-deploy/tower.features.json, which the Versus card, /assimilated/ and the gate read: a site with a missing feature
// is "Passed (missing N)", never conquered (lib/tower.js tower()).
//   node tools/site-crawl.mjs "<floor id or host>"   one site (the floor's own address)
//   node tools/site-crawl.mjs --target               the current target
//   node tools/site-crawl.mjs --passed [--max N]     every site already passed or conquered (conquered first), N at most
//   node tools/site-crawl.mjs --publish              only rewrite tower.features.json from the files
//   options: --cap N (200) --verse-cap N (30) --samples N (3, pages read per template) --dry (write nothing) --no-verse
// Needs CHROME_PATH (or /usr/bin/google-chrome) for Verse's pages, which draw themselves with script; rival pages are read as fetched HTML.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { robotsAllows } from './feature-scan.mjs';
import { showsFeature, featureSlug, keywordsOf } from './tower-probes.mjs';
import { UA } from './tower-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(root, 'domains', 'features');
const OUT = path.join(root, 'void-live-deploy', 'tower.features.json');
const VERSE = (process.env.VERSE_URL || 'https://a-to-mind.com/').replace(/\/?$/, '/');
const today = () => new Date().toISOString().slice(0, 10);
const clip = (s, n = 80) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- reading HTML without a browser ----
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
/** HTML text as words: tags out, entities decoded, spaces folded. Pure. */
export function textOf(html) {
  return String(html || '').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => (e[0] === '#' ? (() => { try { return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)); } catch (_) { return ' '; } })() : ENT[e.toLowerCase()] ?? ' '))
    .replace(/\s+/g, ' ').trim();
}
const attr = (tag, name) => { const m = String(tag).match(new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? textOf(m[1] ?? m[2] ?? m[3] ?? '') : ''; };
/** what a page shows a visitor, read from its HTML: title, h1, headings in order, buttons, boxes, links and counts of the rest. The page's
 *  own header, navigation, footer and cookie notice are left out (they are the same on every page). Pure. */
export function readHtml(html, url) {
  const raw = String(html || '');
  const lang = (raw.match(/<html[^>]*\slang\s*=\s*["']?([a-z-]+)/i) || [])[1] || '';
  const alternates = new Set([...raw.matchAll(/<link[^>]+hreflang\s*=\s*["']?([a-z-]+)/gi)].map((m) => m[1].toLowerCase()).filter((x) => x !== 'x-default'));
  const links = [];
  for (const m of raw.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) { const h = attr(m[0].slice(0, m[0].indexOf('>') + 1), 'href'); if (!h || /^(?:#|javascript:|mailto:|tel:)/i.test(h)) continue; try { links.push({ href: new URL(h, url).href.replace(/#.*$/, ''), text: clip(textOf(m[2]) || attr(m[1], 'aria-label') || attr(m[1], 'title'), 80), download: /\sdownload\b/i.test(m[1]) }); } catch (_) {} }
  let body = (raw.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, raw])[1];
  body = body.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<(nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(div|section|aside)\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:cookie|consent|gdpr)[^"']*["'][\s\S]*?<\/\1>/gi, ' ');
  const headings = [...body.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ l: +m[1], t: clip(textOf(m[2]), 120) })).filter((h) => h.t);
  const buttons = [...body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map((m) => clip(textOf(m[2]) || attr(m[1], 'aria-label') || attr(m[1], 'title'), 50))
    .concat([...body.matchAll(/<input\b[^>]*type\s*=\s*["']?(?:submit|button)[^>]*>/gi)].map((m) => clip(attr(m[0], 'value') || attr(m[0], 'aria-label'), 50)))
    .concat([...body.matchAll(/<[a-z]+\b[^>]*role\s*=\s*["']button["'][^>]*>([\s\S]*?)<\/[a-z]+>/gi)].map((m) => clip(textOf(m[1]) || attr(m[0], 'aria-label'), 50))).filter(Boolean);
  const inputs = [...body.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].map((m) => ({ tag: m[1].toLowerCase(), type: (attr(m[0], 'type') || '').toLowerCase(), label: clip(attr(m[0], 'placeholder') || attr(m[0], 'aria-label') || attr(m[0], 'name'), 60) }))
    .filter((i) => !['hidden', 'submit', 'button', 'image'].includes(i.type));
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => ({ alt: clip(attr(m[0], 'alt'), 80), src: attr(m[0], 'src') || attr(m[0], 'data-src') }));
  const count = (re) => (body.match(re) || []).length;
  return { url, lang, alternates: [...alternates], title: clip(textOf((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''), 120), h1: (headings.find((h) => h.l === 1) || {}).t || '',
    headings, buttons, inputs, imgs, links, forms: count(/<form\b/gi), tables: count(/<table\b/gi), audio: count(/<audio\b/gi), video: count(/<video\b|youtube\.com\/embed|player\.vimeo/gi),
    canvas: count(/<canvas\b/gi), iframes: count(/<iframe\b/gi), copy: /clipboard|data-clipboard|\bcopy\b/i.test(raw.replace(/<(style)\b[\s\S]*?<\/\1>/gi, '')), share: /navigator\.share|share(?:-|_)?button|addtoany|sharethis|twitter\.com\/intent|facebook\.com\/sharer/i.test(raw),
    next: /rel\s*=\s*["']next["']|class\s*=\s*["'][^"']*pagination/i.test(raw), breadcrumb: /breadcrumb/i.test(raw), rss: /application\/rss\+xml/i.test(raw), text: textOf(body).slice(0, 20000) };
}

// ---- grouping pages into templates ----
const LANGS = new Set('af ar az be bg bn bs ca cs cy da de el en eo es et eu fa fi fil fr ga gl gu he hi hr hu hy id is it ja ka kk km kn ko lt lv mk ml mn mr ms my nb ne nl no pa pl pt ro ru si sk sl sq sr sv sw ta te th tl tr uk ur uz vi zh zh-cn zh-tw zh-hans zh-hant pt-br en-us en-gb es-mx fr-ca'.split(' '));
/** the language a path starts with ('de' for /de/...), or ''. Pure. */
export const langOf = (p) => { const s = String(p || '').split('/').filter(Boolean)[0] || ''; return LANGS.has(s.toLowerCase()) ? s.toLowerCase() : ''; };
const LEGAL = /\/(?:privacy|terms|tos|cookies?|legal|support|help|faqs?|imprint|impressum|disclaimer|dmca|gdpr|contact|about(?:-us)?|advertis|login|log-in|signin|sign-in|signup|sign-up|register|account|cart|checkout|wp-admin|wp-login|cdn-cgi|feed)(?:[/._-]|$)/i;
/** whether a URL is worth reading as a feature page: same site, an HTML page, not a legal, account or file address. Pure. */
export function pageWorth(u, host) {
  let x; try { x = new URL(u); } catch (_) { return false; }
  if (!/^https?:$/.test(x.protocol) || x.hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) return false;
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|xml|json|txt|css|js|mp[34]|webm|woff2?|ttf|csv|xlsx?|docx?)$/i.test(x.pathname)) return false;
  return !LEGAL.test(x.pathname);
}
const seg = (s) => (/^\d+$/.test(s) ? ':n' : /^[0-9a-f]{8,}$/i.test(s) || /\d/.test(s) && s.length > 12 ? ':id' : s);
/** the template a page belongs to: "home", "search", "sitemap:<file>:<shape>" for a page a sitemap lists (pages listed by the same sitemap,
 *  languages folded, with the same path depth are one template), "path:/<first>/*" for a page under a folder no sitemap lists, or the page's
 *  own path for a page at the top. Pure. */
export function templateOf(u, sitemapOf = new Map()) {
  const x = new URL(u); let p = x.pathname.replace(/\/+$/, '') || '/'; const lang = langOf(p); if (lang) p = '/' + p.split('/').filter(Boolean).slice(1).join('/');
  if (p === '/' || p === '') return 'home';
  if (/search|[?&](?:q|query|s|search)=/i.test(x.pathname + x.search)) return 'search';
  const parts = p.split('/').filter(Boolean), sm = sitemapOf.get(u) || sitemapOf.get(u.replace(/\/$/, '')) || sitemapOf.get(u + '/');
  if (sm) return 'sitemap:' + sm + ':' + (parts.length === 1 ? '/*' : '/' + parts.slice(0, parts.length - 1).map(seg).join('/') + '/*');
  if (parts.length === 1) return 'page:/' + parts[0];
  return 'path:/' + parts.slice(0, parts.length - 1).map(seg).join('/') + '/*';
}
/** the kind of page a template is, for people reading the map. Pure. */
export function kindOf(key, size = 0) {
  if (key === 'home') return 'home'; if (key === 'search') return 'search';
  if (/blog|news|article|post/i.test(key)) return 'articles';
  if (/categor|tag|group|list|collection|topic|index/i.test(key)) return 'list';
  if (key.startsWith('page:')) return 'tool';
  return size >= 20 ? 'item' : 'list';
}
/** a sitemap file's name with its language and number taken off: emoji_de.xml.gz -> emoji, sitemap-posts-2.xml -> sitemap-posts. Pure. */
export function sitemapGroup(u) {
  let n = String(u).split('/').pop().replace(/\?.*$/, '').replace(/\.gz$/i, '').replace(/\.xml$/i, '');
  n = n.replace(/[-_.](?:[a-z]{2}(?:[-_][a-z]{2,4})?)$/i, (m) => (LANGS.has(m.slice(1).toLowerCase().replace('_', '-')) ? '' : m)).replace(/[-_.]?\d+$/, '');
  return n || 'sitemap';
}
/** a sitemap's addresses: { maps: [child sitemaps], urls: [pages] }. Pure. */
export function sitemapUrls(xml) {
  const locs = (re) => [...String(xml || '').matchAll(re)].map((m) => textOf(m[1]).trim()).filter(Boolean);
  if (/<sitemapindex/i.test(xml)) return { maps: locs(/<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>/gi), urls: [] };
  return { maps: [], urls: locs(/<url>[\s\S]*?<loc>([\s\S]*?)<\/loc>/gi) };
}

// ---- what a page offers ----
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/\p{Extended_Pictographic}|\p{Emoji_Component}(?=\p{Extended_Pictographic})/gu, ' ').match(/[\p{L}\p{N}]+/gu) || [];
// headings that title prose, not something a visitor can do or see
const PROSE = /^(?:introduction|intro|overview|summary|conclusion|description|details|information|info|notes?|remarks?|about|about us|main features|features|key features|faqs?|frequently asked questions|how to use|how it works|how to|instructions|contact|contact us|declarations?|disclaimer|support|help|resources|related|related tools|related posts|more|see also|latest|popular|recent|follow us|newsletter|share|tags|categories|comments?|leave a reply|advertisement|sponsored|table of contents|contents|why us|why choose us|testimonials|reviews)$/i;
const NAV = /^(?:home|menu|close|open|next|previous|prev|back|more|less|show more|show less|load more|search|go|ok|submit|accept|accept all|reject|reject all|decline|got it|agree|i agree|settings|manage|subscribe|log ?in|sign ?in|sign ?up|register|x|×|✕|☰|toggle navigation|skip to content|\d+)$/i;
/** a heading or button with the page's own subject taken out (its h1 words and title words that are not the site's), so "😀 Grinning Face
 *  Meaning" and "🔥 Fire Meaning" are one section: "meaning". Pure. */
/** a heading as any page of its template would word it: the page's subject and emoji taken out ("Copy and paste this 😀 emoji:" -> "Copy and
 *  paste this emoji"). Pure. */
export function wording(text, subject) {
  let t = String(text || '');
  for (const w of words(subject).filter((x) => x.length > 1 && !/^\d+$/.test(x))) t = t.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}\\p{N}])', 'giu'), '$1');
  return t.replace(/\p{Extended_Pictographic}|\u200d|\ufe0f|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/\s+([:,.!?])/g, '$1').replace(/[:\s]+$/, '').replace(/^[\s:,-]+/, '').replace(/\s+/g, ' ').trim();
}
export function generic(text, subject) {
  const sub = new Set(words(subject)), w = words(text).filter((x) => !sub.has(x));
  return w.join(' ').replace(/\b\d+\b/g, 'N').trim();
}
/** the features one page shows: [{ key, name, kind }] with key the generic form, name as the page words it. Pure. */
export function featuresOf(page, { home = false, articles = false } = {}) {
  const out = new Map(), subject = home ? '' : page.h1, add = (key, name, kind) => { key = clip(key, 80); if (key && key.length >= 3 && !out.has(key)) out.set(key, { key, name: clip(name, 90), kind }); };
  // sections: h2-h4, with a run of four or more short same-level headings (one per platform, one per size...) folded into one grid under the heading before them
  const hs = page.headings.filter((h) => h.l > 1);
  for (let i = 0; i < hs.length; i++) {
    let j = i; while (j < hs.length && hs[j].l === hs[i].l && hs[j].t.split(/\s+/).length <= 4) j++;
    if (j - i >= 4 && hs.slice(i, j).filter((h) => PROSE.test(wording(h.t, subject))).length * 2 < j - i) { const head = i > 0 ? hs[i - 1] : null, names = hs.slice(i, j).map((h) => h.t); const k = head ? generic(head.t, subject) : 'grid'; add('grid ' + k, (head ? wording(head.t, subject) : 'A grid') + ' (' + names.length + ': ' + names.slice(0, 8).join(', ') + (names.length > 8 ? '…' : '') + ')', 'grid'); i = j - 1; continue; }
    const k = generic(hs[i].t, subject); if (k && !articles && !PROSE.test(wording(hs[i].t, subject))) add('section ' + k, wording(hs[i].t, subject), 'section');
  }
  if (articles) add('content articles', 'Articles (a blog)', 'content');
  for (const b of page.buttons) { if (NAV.test(b.trim())) continue; const k = generic(b, subject); if (k && k.split(' ').length <= 6) add('button ' + k, wording(b, subject), 'button'); }
  for (const i of page.inputs) {
    if (i.type === 'search' || /search|find|look ?up/i.test(i.label)) add('control search', 'A search box' + (i.label ? ' ("' + i.label + '")' : ''), 'control');
    else if (i.type === 'file') add('control upload', 'Upload a file', 'control');
    else if (i.type === 'checkbox' || i.type === 'radio') add('control options', 'Options to tick or choose', 'control');
    else if (i.tag === 'textarea') add('control text box', 'A text box' + (i.label ? ' ("' + i.label + '")' : ''), 'control');
    else if (i.tag === 'select') add('control menu', 'A choice menu', 'control');
    else if (['range', 'color', 'date', 'time', 'number'].includes(i.type)) add('control ' + i.type, 'A ' + i.type + ' picker' + (i.label ? ': ' + i.label : ''), 'control');
  }
  // image grids: many pictures whose alt text names this page's subject and differs only in a word or two (one per vendor, size, style)
  if (subject) { const sw = words(subject), same = page.imgs.filter((im) => { const w = words(im.alt); return w.length && sw.some((x) => w.includes(x)); }); if (same.length >= 6) add('grid images', 'A picture grid of the same thing drawn many ways (' + clip(wording(same[0].alt, ''), 60) + '…)', 'grid'); }
  if (page.copy) add('action copy', 'Copy to clipboard', 'action');
  if (page.share) add('action share', 'Share buttons', 'action');
  if (page.links.some((l) => l.download)) add('action download', 'Downloads', 'action');
  if (page.tables) add('content table', 'A table', 'content');
  if (page.audio) add('content audio', 'Sound or audio', 'content');
  if (page.video) add('content video', 'Video', 'content');
  if (page.canvas) add('content canvas', 'A drawing or game canvas', 'content');
  if (page.next) add('nav pages', 'Pages of results (next and previous)', 'navigation');
  if (page.breadcrumb) add('nav breadcrumb', 'Breadcrumbs back to the category', 'navigation');
  if (page.alternates.length >= 3) add('content languages', 'In ' + page.alternates.length + ' languages', 'content');
  return [...out.values()];
}
/** a template's features: the ones at least half its pages show (one page: all of them). Pure. */
export function templateFeatures(pages, opt = {}) {
  const seen = new Map();
  for (const p of pages) for (const f of featuresOf(p, opt)) { const s = seen.get(f.key) || { ...f, pages: 0 }; s.pages++; seen.set(f.key, s); }
  const need = Math.max(1, Math.ceil(pages.length / 2));
  return [...seen.values()].filter((f) => f.pages >= need).map(({ pages: n, ...f }) => f);
}
/** the site's features across templates, each once, with the templates showing it: [{ key, name, kind, templates }]. A tool page is itself a
 *  feature (its h1). Pure. */
export function siteFeatures(templates) {
  const out = new Map();
  for (const t of templates) {
    if (t.key.startsWith('like:') && t.title) { const k = 'pages ' + t.key; out.set(k, { key: k, name: 'Pages: ' + t.title, kind: 'page', templates: [t.key] }); }
    if (t.kind === 'tool' && t.title) { const k = 'page ' + generic(t.title, ''); if (!out.has(k)) out.set(k, { key: k, name: 'A page: ' + t.title, kind: 'page', templates: [t.key] }); }
    for (const f of t.features) { const o = out.get(f.key); if (o) { if (!o.templates.includes(t.key)) o.templates.push(t.key); } else out.set(f.key, { ...f, templates: [t.key] }); }
  }
  return [...out.values()];
}
const GENERIC_KINDS = new Set(['navigation']);
/** rival features marked against Verse's pages: [{ ...feature, verse: has|partial|missing, found }] (navigation aids never block). Pure. */
export function markAgainst(features, verseText) {
  return features.map((f) => {
    if (GENERIC_KINDS.has(f.kind)) return { ...f, verse: 'has', found: [] };
    // an action is there when Verse offers it in so many words (a Copy button is copy to clipboard)
    const verb = (f.kind === 'action' ? f.key.slice(7) : f.kind === 'button' ? (f.name.match(/^(copy|share|download)\b/i) || [])[1] || '' : '').toLowerCase();
    const act = { copy: /\bcopy\b/i, share: /\bshare\b/i, download: /\bdownload\b/i }[verb];
    if (act) return { ...f, verse: act.test(verseText) ? 'has' : 'missing', found: act.test(verseText) ? [verb] : [] };
    // languages: Verse in as many languages, said in so many words
    if (f.key === 'content languages') { const n = +(f.name.match(/\d+/) || [0])[0], v = Math.max(0, ...[...String(verseText).matchAll(/\b(\d+)\s+languages\b/gi)].map((m) => +m[1])); return { ...f, verse: v >= n ? 'has' : 'missing', found: v ? [v + ' languages'] : [] }; }
    const name = f.kind === 'grid' ? f.name.replace(/\s*\(.*$/, '') + ' grid' : f.kind === 'page' ? f.name.replace(/^(?:A page|Pages):\s*/, '').replace(/…?\s*\(\d+ pages\)$/, '') : f.name.replace(/\s*\("[^"]*"\)$/, '');
    const s = showsFeature({ name }, verseText), found = s.found || [], kw = keywordsOf(name);
    // a partial match on one word of several ("emoji" of "Concentration Emoji Game") is not the feature
    const verse = s.verse === 'partial' && (found.length < 2 || found.length * 2 < kw.length) ? 'missing' : s.verse;
    return { ...f, verse, found };
  });
}

// ---- fetching, politely ----
async function get(url, { timeout = 12000, accept = 'text/html' } = {}) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept, 'accept-language': 'en-US,en;q=0.9', 'accept-encoding': 'gzip, deflate, br' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
    const buf = Buffer.from(await r.arrayBuffer()); let body = buf;
    if (buf[0] === 0x1f && buf[1] === 0x8b) { try { body = zlib.gunzipSync(buf); } catch (_) {} }
    return { ok: r.ok, status: r.status, url: r.url, type: r.headers.get('content-type') || '', text: body.slice(0, 40_000_000).toString('utf8') };
  } catch (e) { return { ok: false, status: 0, url, problem: String(e && e.message || e).slice(0, 80) }; }
}
/** the whole site read: { host, robots, sitemaps, urls_found, pages, templates, features, skipped } */
export async function crawlSite(start, { cap = 200, samples = 3, concurrency = 2, pause = 400, fetcher = get, render = null, log = () => {} } = {}) {
  const home = new URL(start), origin = home.origin, host = home.hostname;
  const robots = await fetcher(origin + '/robots.txt', { accept: 'text/plain' }), rules = robots.ok && !/<html/i.test(robots.text) ? robots.text.slice(0, 200000) : '';
  const allowed = (u) => { const x = new URL(u); return robotsAllows(rules, x.pathname + x.search); };
  let fetched = 0; const budget = () => fetched < cap;
  // sitemaps: the robots.txt Sitemap lines, else /sitemap.xml; an index's children read once per group (emoji_de.xml.gz after emoji_en.xml.gz is the same pages in German)
  const sitemapOf = new Map(), groupSize = new Map(), mapsRead = [], seenGroup = new Set();
  let queue = [...rules.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]); if (!queue.length) queue = [origin + '/sitemap.xml'];
  for (let n = 0; queue.length && n < 12 && budget(); n++) {
    const sm = queue.shift(), g = sitemapGroup(sm);
    const r = await fetcher(sm, { accept: 'application/xml,text/xml' }); fetched++; await sleep(pause);
    if (!r.ok) continue; mapsRead.push(sm.replace(origin, ''));
    const { maps, urls } = sitemapUrls(r.text);
    for (const c of maps) { const cg = sitemapGroup(c); if (seenGroup.has(cg)) continue; seenGroup.add(cg); queue.push(c); }
    for (const u of urls) { if (!pageWorth(u, host) || langOf(new URL(u).pathname) && langOf(new URL(u).pathname) !== 'en') continue; if (!sitemapOf.has(u)) { sitemapOf.set(u, g); groupSize.set(g, (groupSize.get(g) || 0) + 1); } }
  }
  log(host + ': ' + sitemapOf.size + ' pages in ' + mapsRead.length + ' sitemaps');
  // pages: the home page, then breadth first over links, reading a page only while its template still wants samples
  const byTemplate = new Map(), seen = new Set(), skipped = { robots: 0, failed: 0 }; let order = [home.href], rendered = 0;
  const shape = (u) => templateOf(u, sitemapOf);
  // a sample of each sitemap template goes in the queue too, spread through the list (first, middle, last), so item pages are read even when no link leads to them
  const bySm = new Map(); for (const u of sitemapOf.keys()) { const k = shape(u); if (!bySm.has(k)) bySm.set(k, []); bySm.get(k).push(u); }
  for (const [, us] of bySm) for (const i of [0, Math.floor(us.length / 2), us.length - 1].slice(0, Math.min(samples, us.length))) order.push(us[i]);
  const want = (u) => { if (seen.has(u)) return false; const k = shape(u), t = byTemplate.get(k); return !t || t.pages.length < (k.startsWith('page:') || k === 'home' ? 1 : samples); };
  while (order.length && budget()) {
    const batch = []; while (order.length && batch.length < concurrency) { const u = order.shift(); if (!want(u)) continue; seen.add(u); if (!allowed(u)) { skipped.robots++; continue; } batch.push(u); }
    if (!batch.length) continue;
    const got = await Promise.all(batch.map((u) => fetcher(u))); fetched += batch.length;
    for (let i = 0; i < got.length; i++) {
      const r = got[i]; if (!r.ok || !/html/i.test(r.type || 'text/html')) { skipped.failed++; continue; }
      const finalUrl = r.url || batch[i]; if (new URL(finalUrl).hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) { skipped.failed++; continue; }
      let page = readHtml(r.text, finalUrl); const k = batch[i] === home.href ? 'home' : shape(batch[i]);
      // a page that draws itself with script (its HTML is a shell) is read as a browser shows it
      if (render && page.text.length < 400 && /<script/i.test(r.text)) { const html = await render(finalUrl); if (html) { page = readHtml(html, finalUrl); rendered++; } }
      const t = byTemplate.get(k) || { key: k, pages: [] }; t.pages.push(page); byTemplate.set(k, t);
      for (const l of page.links) { const u = l.href; if (pageWorth(u, host) && !seen.has(u) && !langOf(new URL(u).pathname)) order.push(u); }
    }
    await sleep(pause);
  }
  // pages no sitemap names but built from the same template (one page per platform, per version...) fold into one: the same features, mostly
  const fp = (t) => new Set(templateFeatures(t.pages, { home: t.key === 'home' }).map((x) => x.key)), sim = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.max(1, a.size + b.size - n); };
  const list = [...byTemplate.values()].map((t) => ({ ...t, fp: fp(t) })), chrome = (list.find((t) => t.key === 'home') || { fp: new Set() }).fp; // what the home page shows is on every page
  for (const t of list) if (t.key !== 'home') t.fp = new Set([...t.fp].filter((k) => !chrome.has(k) && !/^(?:action|nav|content languages)/.test(k)));
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (!a || !/^(?:page|like):/.test(a.key) || !a.fp.size) continue;
    for (let j = i + 1; j < list.length; j++) { const b = list[j]; if (!b || b.key === 'home' || !b.key.startsWith('page:') || !b.fp.size || sim(a.fp, b.fp) < 0.6) continue;
      a.pages.push(...b.pages); a.merged = (a.merged || 1) + 1; list[j] = null; }
    if (a.merged && a.key.startsWith('page:')) a.key = 'like:' + a.key.slice(5);
  }
  byTemplate.clear(); for (const t of list) if (t) byTemplate.set(t.key, t);
  const templates = [...byTemplate.values()].map((t) => {
    const size = t.key.startsWith('sitemap:') ? (bySm.get(t.key) || []).length : t.pages.length, read = t.pages.length;
    const names = t.pages.map((p) => p.h1 || p.title);
    if (t.pages.length > samples * 2) t.pages = [t.pages[0], t.pages[Math.floor(t.pages.length / 2)], t.pages[t.pages.length - 1]];
    const kind = t.key.startsWith('like:') ? (size >= 5 ? 'item' : 'list') : kindOf(t.key, size);
    return { key: t.key, kind, known: size, read, sampled: t.pages.map((p) => p.url), title: t.key.startsWith('page:') ? clip(t.pages[0].h1 || t.pages[0].title.split(/\s[|·–—-]\s/)[0], 70) : t.key.startsWith('like:') ? clip(names.slice(0, 4).join(', ') + (read > 4 ? '… (' + read + ' pages)' : ''), 90) : '',
      features: templateFeatures(t.pages, { home: t.key === 'home', articles: kind === 'articles' }) };
  });
  const own = host.replace(/^www\./, '').split('.')[0].toLowerCase(); // the site's page about itself is not a feature
  return { host, robots: !!rules, sitemaps: mapsRead.length, urls_found: sitemapOf.size, pages: fetched - mapsRead.length - 0, read: templates.reduce((n, t) => n + t.read, 0), templates, rendered, features: siteFeatures(templates).filter((f) => !(f.kind === 'page' && generic(f.name.replace(/^A page:\s*/, ''), '') === own)), skipped };
}

// ---- Verse's side, as a browser shows it ----
const verseCache = new Map();
async function readVerse(browser, url) {
  if (verseCache.has(url)) return verseCache.get(url);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US' }), p = await ctx.newPage();
  let got = null;
  try {
    await p.goto(url, { waitUntil: 'load', timeout: 30000 }); await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    got = await p.evaluate(() => ({ url: location.href, text: (document.body ? document.body.innerText : '') + '\n' + [...document.querySelectorAll('input:not([type=hidden]),textarea')].map((e) => e.placeholder || e.getAttribute('aria-label') || '').join('\n') + '\n' + [...document.querySelectorAll('[aria-label],[title],img[alt]')].map((e) => e.getAttribute('aria-label') || e.title || e.alt).join('\n'),
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href.replace(/#.*$/, '')),
      controls: [document.querySelector('select') && 'a choice menu', document.querySelector('input[type=file]') && 'upload a file', document.querySelector('textarea') && 'a text box', document.querySelector('input[type=search],input[placeholder*=earch i]') && 'a search box', document.querySelector('input[type=checkbox],input[type=radio]') && 'options to tick or choose', document.querySelector('table') && 'a table', document.querySelector('canvas') && 'a drawing or game canvas', document.querySelector('audio') && 'sound or audio', document.querySelector('video') && 'video', ...['range', 'color', 'date', 'time', 'number'].filter((t) => document.querySelector('input[type=' + t + ']')).map((t) => 'a ' + t + ' picker')].filter(Boolean) }));
    if (got) got.text += '\n' + got.controls.join('\n');
  } catch (_) {} finally { await ctx.close().catch(() => {}); }
  verseCache.set(url, got); return got;
}
/** Verse's pages for a floor: its page and the Verse pages that page links to under the same first folder or named for the same thing, at most
 *  `cap`: { pages, text } */
export async function crawlVerse(browser, page, { cap = 30, base = VERSE } = {}) {
  if (!page) return { pages: 0, urls: [], text: '' };
  const first = new URL(page, base), top = '/' + (first.pathname.split('/').filter(Boolean)[0] || '') + '/', vh = first.hostname;
  const q = [first.href], seen = new Set(), texts = [], urls = [];
  while (q.length && urls.length < cap) {
    const u = q.shift(), key = new URL(u).pathname; if (seen.has(key)) continue; seen.add(key); // one read per page, not per query (/emoji-combos/?q=love, ?q=cute...)
    const g = await readVerse(browser, u); if (!g) continue; urls.push(new URL(u).pathname + new URL(u).search); texts.push(g.text);
    for (const l of g.links) { let x; try { x = new URL(l); } catch (_) { continue; } if (x.hostname !== vh || seen.has(x.pathname) || /\.(?:json|png|svg|xml|txt)$/.test(x.pathname)) continue;
      if (x.pathname.startsWith(top) || (urls.length === 1 && l !== first.href && /related|use with/i.test(''))) q.push(x.href); }
    // the "Use with" links of the floor's own page count too (Verse splits a site's features over pages that link each other)
    if (urls.length === 1) for (const l of g.links.slice(0, 400)) { let x; try { x = new URL(l); } catch (_) { continue; } if (x.hostname === vh && x.pathname !== '/' && !seen.has(x.pathname) && !/\.(?:json|png|svg|xml|txt)$/.test(x.pathname) && !/^\/(?:assimilated|tower|about|privacy|terms|history|growth)\b/.test(x.pathname)) q.push(x.href); }
  }
  return { pages: urls.length, urls, text: texts.join('\n') };
}

// ---- the files ----
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } };
/** a crawl folded into a floor's file under "crawl" (other sections untouched). Pure. */
export function mergeCrawl(file, floor, host, entry, date = today()) {
  const f = file ? { ...file } : { floor: floor.id, verse_page: floor.page || null, source: 'auto', sites: {} };
  const c = { ...(f.crawl || {}), sites: { ...((f.crawl && f.crawl.sites) || {}) } }; c.sites[host] = { ...entry, crawled: date }; c.updated = date; f.crawl = c; return f;
}
/** the deployed summary from every file's crawl: { about, sites: { host: { floor, pages, templates, features, verse_pages, verse_features,
 *  missing: [names], crawled } } }. Pure. */
export function publishOf(files) {
  const sites = {};
  for (const slug of Object.keys(files).sort()) {
    const c = files[slug] && files[slug].crawl; if (!c || !c.sites) continue;
    for (const [host, e] of Object.entries(c.sites)) {
      const missing = (e.features || []).filter((x) => x.verse === 'missing').map((x) => x.name);
      sites[host] = { floor: e.floor || null, pages: e.pages || 0, templates: (e.templates || []).length, features: (e.features || []).length, verse_pages: e.verse_pages || 0,
        verse_features: (e.features || []).filter((x) => x.verse !== 'missing').length, missing, crawled: e.crawled || null };
    }
  }
  return { about: 'Whole-site crawls of the Versus sites (tools/site-crawl.mjs): pages read, page templates, distinct features, and the ones Verse lacks. Generated; do not edit.', sites };
}
function readFiles() { const out = {}; for (const n of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) if (/\.json$/.test(n)) { const v = readJson(path.join(DIR, n)); if (v) out[n.slice(0, -5)] = v; } return out; }
function publish(dry) { const s = publishOf(readFiles()); if (!dry) fs.writeFileSync(OUT, JSON.stringify(s, null, 1) + '\n'); return s; }

async function floorsNow() {
  const { tower, towerArgs, hostOf } = await import('../void-live-deploy/lib/tower.js');
  const rd = (f) => readJson(path.join(root, 'void-live-deploy', f)) || {};
  const t = tower(...towerArgs((rd('lap.items.json') || {}).onlySite, { ev: rd('tower.evidence.json'), fr: rd('tower.frontier.json'), rk: rd('tower.rank.json'), sz: rd('tower.size.json'), tg: rd('tower.target.json') }));
  return t.floors.map((f) => ({ ...f, host: hostOf(f.url) }));
}

async function main(argv) {
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, dry = argv.includes('--dry');
  if (argv.includes('--publish')) { const s = publish(dry); console.log(Object.keys(s.sites).length + ' sites in tower.features.json'); return; }
  const floors = await floorsNow(); let pick = [];
  if (argv.includes('--target')) pick = floors.filter((f) => f.state === 'current');
  else if (argv.includes('--passed')) pick = [...floors.filter((f) => f.beaten), ...floors.filter((f) => f.cleared && !f.beaten)].slice(0, +opt('--max', 1000));
  else { const want = argv.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)); pick = floors.filter((f) => f.id === want || f.host === String(want || '').replace(/^www\./, '') || f.host === want); }
  if (!pick.length) { console.log('no floor matches'); process.exitCode = 1; return; }
  const skip = new Set(argv.includes('--fresh') ? [] : (() => { const s = publishOf(readFiles()).sites, d = +opt('--older', 0); return Object.keys(s).filter((h) => !d || (Date.now() - Date.parse(s[h].crawled || 0)) < d * 86400000); })());
  let browser = null;
  if (!argv.includes('--no-verse')) { const { chromium } = await import('playwright-core'); browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] }); }
  try {
    for (const f of pick) {
      if (argv.includes('--skip-done') && skip.has(f.host)) continue;
      const render = browser ? async (u) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US' }), p = await ctx.newPage();
        try { await p.goto(u, { waitUntil: 'load', timeout: 25000 }); await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); return await p.content(); } catch (_) { return ''; } finally { await ctx.close().catch(() => {}); } } : null;
      const t0 = Date.now(), site = await crawlSite(f.url, { cap: +opt('--cap', 200), samples: +opt('--samples', 3), render, log: (m) => console.log('  ' + m) });
      const verse = browser ? await crawlVerse(browser, f.page, { cap: +opt('--verse-cap', 30) }) : { pages: 0, urls: [], text: '' };
      const marked = markAgainst(site.features, verse.text), miss = marked.filter((x) => x.verse === 'missing');
      const entry = { floor: f.id, url: f.url, robots: site.robots, rendered: site.rendered, sitemaps: site.sitemaps, urls_found: site.urls_found, pages: site.read, fetched: site.pages, skipped: site.skipped,
        templates: site.templates.map((t) => ({ key: t.key, kind: t.kind, known: t.known, sampled: t.sampled, title: t.title || undefined, features: t.features.map((x) => x.key) })),
        features: marked.map(({ key, name, kind, templates, verse: v, found }) => ({ key, name, kind, templates, verse: v, found: found.slice(0, 4) })), verse_page: f.page, verse_pages: verse.pages, verse_urls: verse.urls };
      console.log(f.id + ' (' + f.host + '): ' + site.read + ' pages read, ' + site.templates.length + ' templates, ' + site.features.length + ' features; Verse ' + verse.pages + ' pages, missing ' + miss.length + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
      for (const m of miss) console.log('    missing: ' + m.name + '  [' + m.templates.join(', ') + ']');
      if (!dry && site.read) { const slug = featureSlug(f.id), file = path.join(DIR, slug + '.json'); fs.writeFileSync(file, JSON.stringify(mergeCrawl(readJson(file), f, f.host, entry), null, 1) + '\n'); }
    }
  } finally { if (browser) await browser.close().catch(() => {}); }
  const s = publish(dry); console.log(Object.keys(s.sites).length + ' sites in tower.features.json');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
