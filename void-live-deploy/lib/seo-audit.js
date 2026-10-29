/**
 * seo-audit: Verse's SEO tool turned on Verse's own pages (owner, 2026-10-26: "if we go after a seo site Verse uses its own tools as needed").
 * One page's HTML in, what a search engine would trip on out: the title and description (there, not too long, not shared with another page),
 * the canonical link (there and pointing at the page itself), JSON-LD that parses, one h1, the html lang, the share card (og:title, og:image),
 * every internal link and picture reaching something that exists, and how hard the description is to read (lib/writing-aids.js readingLevel,
 * the same one /word-count/ shows). Then, over many pages: duplicate titles and descriptions, pages nothing links to, and which pages lead to
 * what Verse sells (OFFERS). tools/seo-audit.mjs runs it over every page in void-live-deploy/ (and checks.mjs holds the count from growing);
 * /api/mcp offers it as seo_audit. Pure: the caller says which paths exist. Tests: tools/seo-audit.test.mjs.
 */
import { readingLevel } from './writing-aids.js';
export const SITE = 'https://a-to-mind.com';
/** the limits a result is held to: Google shows about 60 characters of a title and 155-160 of a description */
export const LIMITS = Object.freeze({ title: [10, 70], description: [50, 170] });
/** the pages that sell something (the store, the code review's Pro, the done-for-you automation services): a free page that leads to one is a path to a sale */
export const OFFERS = Object.freeze(['/store/', '/code-review/', '/one-time-fix/', '/keep-it-running/', '/first-automation-setup/', '/full-stack-audit/']);

const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i')); return m ? decode(m[1] != null ? m[1] : m[2]) : null; };
const metaOf = (html, key, val) => { for (const t of html.match(/<meta\b[^>]*>/gi) || []) if ((attr(t, key) || '').toLowerCase() === val) return attr(t, 'content'); return null; };
/** the path a link on page `from` reaches on this site ('/x/'), or null for another site, a mailto, a fragment, javascript: or data:. Pure. */
export function internalPath(href, from = '/') {
  const h = String(href || '').trim();
  if (!h || /^(#|mailto:|tel:|javascript:|data:|blob:|sms:)/i.test(h) || h.includes('${') || h.includes('{{')) return null;
  let u; try { u = new URL(h, SITE + from); } catch (_) { return null; }
  if (u.origin !== SITE) return null;
  try { return decodeURIComponent(u.pathname); } catch (_) { return u.pathname; }
}
// what the server answers without a file: the Pages Functions routes (_routes.json) and the API
const DYNAMIC = /^\/(?:api\/|c\/|is-it\/|gen\/|boards\/t\/|@|films\/rss$|fanfic\/rss$|tools\.json$|cdn-cgi\/)/;
/** whether a site path is served, given the files that exist (a Set of paths like '/photos/index.html', '/og.png'). Pure. */
export function served(p, files) {
  if (DYNAMIC.test(p)) return true;
  if (files.has(p)) return true;
  if (p.endsWith('/')) return files.has(p + 'index.html');
  return files.has(p + '.html') || files.has(p + '/index.html');
}

/** one page's findings: { path, title, description, canonical, h1, grade, links: [paths], defects: [{ kind, message }], notes }. Pure.
 *  defects break something (a search engine or a shared link meets nothing, or the wrong thing); notes cost a little (a title or description
 *  cut short in a result: Google still reads it all, so a long error message kept whole for search is a note, not a fault). 
 *  files: a Set of every served file path (see served()); without it links are listed but not checked. */
export function auditPage(html, path, files) {
  html = String(html || ''); const defects = [], notes = [], add = (kind, message) => defects.push({ kind, message }), note = (kind, message) => notes.push({ kind, message });
  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [, html])[1];
  const tm = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i), title = tm ? decode(tm[1]).replace(/\s+/g, ' ').trim() : '';
  if (!title) add('title', 'no <title>');
  else if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) note('title', 'title is ' + title.length + ' characters (' + LIMITS.title.join(' to ') + ' read whole in a result)');
  const description = (metaOf(head, 'name', 'description') || '').trim();
  if (!description) add('description', 'no meta description');
  else if (description.length < LIMITS.description[0] || description.length > LIMITS.description[1]) note('description', 'description is ' + description.length + ' characters (' + LIMITS.description.join(' to ') + ')');
  let canonical = null;
  for (const t of head.match(/<link\b[^>]*>/gi) || []) if ((attr(t, 'rel') || '').toLowerCase() === 'canonical') canonical = attr(t, 'href');
  if (!canonical) add('canonical', 'no canonical link');
  else if (internalPath(canonical, path) !== path) add('canonical', 'canonical points at ' + canonical.slice(0, 80) + ', not this page');
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(m[1]); } catch (e) { add('json-ld', 'JSON-LD does not parse: ' + String(e.message).slice(0, 80)); }
  }
  const h1 = (html.match(/<h1\b/gi) || []).length;
  if (h1 !== 1) add('h1', h1 ? h1 + ' h1 headings' : 'no h1 heading');
  if (!/<html\b[^>]*\slang\s*=/i.test(html)) add('lang', 'no lang on <html>');
  if (!metaOf(head, 'property', 'og:title')) add('share', 'no og:title (a shared link shows no card title)');
  const ogImage = metaOf(head, 'property', 'og:image');
  if (!ogImage) add('share', 'no og:image (a shared link shows no picture)');
  // every link and picture the page names, without the parts written by scripts (a template literal or a string in code is not a link)
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const links = [], seen = new Set();
  for (const m of body.matchAll(/<(a|link|img|source|script)\b[^>]*>/gi)) {
    const tag = m[0], name = m[1].toLowerCase(), rel = (attr(tag, 'rel') || '').toLowerCase();
    if (name === 'link' && /preconnect|dns-prefetch|alternate/.test(rel)) continue;
    const href = name === 'a' || name === 'link' ? attr(tag, 'href') : attr(tag, 'src') || (attr(tag, 'srcset') || '').split(/[\s,]/)[0];
    const p = internalPath(href, path), key = (name === 'a' ? 'a ' : 'r ') + p; if (p == null || seen.has(key)) continue; seen.add(key);
    if (name === 'a') links.push(p);
    if (files && !served(p, files)) add('broken', (name === 'a' ? 'link' : name) + ' to ' + p + ' reaches nothing');
  }
  for (const s of html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) { const p = internalPath(s[1], path); if (p != null && !seen.has('r ' + p)) { seen.add('r ' + p); if (files && !served(p, files)) add('broken', 'script ' + p + ' reaches nothing'); } }
  if (ogImage && files) { const p = internalPath(ogImage, path); if (p != null && !served(p, files)) add('broken', 'og:image ' + p + ' reaches nothing'); }
  const lv = description ? readingLevel(description) : null;
  return { path, title, description, canonical, h1, grade: lv ? lv.grade : null, ease: lv ? lv.ease : null, links, defects, notes };
}

/** many pages' findings joined: duplicate titles and descriptions become defects on each page that shares them, every page gets its inbound
 *  count (links from other pages), orphans (nothing links to them) are named, and each offer's inbound pages are listed. Pure.
 *  pages: auditPage results. Returns { pages, defects (total), byKind, orphans, offers: { path: [from...] }, hardest (descriptions by grade) }. */
export function auditSite(pages) {
  const dup = (key) => { const m = new Map(); for (const p of pages) if (p[key]) m.set(p[key], [...(m.get(p[key]) || []), p.path]); return m; };
  const titles = dup('title'), descs = dup('description'), inbound = new Map(pages.map((p) => [p.path, new Set()]));
  for (const p of pages) for (const l of p.links) if (l !== p.path && inbound.has(l)) inbound.get(l).add(p.path);
  const out = pages.map((p) => {
    const defects = [...p.defects];
    const t = titles.get(p.title); if (t && t.length > 1) defects.push({ kind: 'duplicate', message: 'title shared with ' + t.filter((x) => x !== p.path).slice(0, 3).join(', ') });
    const d = descs.get(p.description); if (d && d.length > 1) defects.push({ kind: 'duplicate', message: 'description shared with ' + d.filter((x) => x !== p.path).slice(0, 3).join(', ') });
    return { ...p, inbound: inbound.get(p.path).size, defects };
  });
  const byKind = {}; for (const p of out) for (const d of p.defects) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  const offers = Object.fromEntries(OFFERS.filter((o) => inbound.has(o)).map((o) => [o, [...inbound.get(o)].sort()]));
  return { pages: out, defects: out.reduce((n, p) => n + p.defects.length, 0), notes: out.reduce((n, p) => n + (p.notes || []).length, 0), byKind, orphans: out.filter((p) => p.path !== '/' && !p.inbound).map((p) => p.path),
    offers, toOffers: out.filter((p) => p.links.some((l) => OFFERS.includes(l) && l !== p.path)).length,
    hardest: out.filter((p) => p.grade != null).sort((a, b) => b.grade - a.grade).slice(0, 10).map((p) => ({ path: p.path, grade: p.grade })) };
}
