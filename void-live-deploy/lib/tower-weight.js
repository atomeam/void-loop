// Versus by weight: size is what a site weighs, not how popular it is: the bytes it transfers, the scripts it runs, its elements and its routes.
// payload, route count, client-side script). Pure helpers shared by tools/tower-size.mjs (measures a site, writes tower.size.json), lib/tower.js
// (the queue's size key) and the card. The 1kB Club (https://1kb.club/) is the bar the lightest sites clear.
export const SCRIPT_COST = 2000, NODE_COST = 10, ROUTE_COST = 500; // one script weighs as 2 KB, a DOM element as 10 bytes, a route as 500 bytes
/** the weight of a measured site in bytes-equivalent: transfer bytes plus what scripts, elements and routes cost to carry. Lower is lighter. Pure. */
export const weightOf = (m) => (m && Number.isFinite(+m.bytes) ? Math.round(+m.bytes + SCRIPT_COST * (+m.scripts || 0) + NODE_COST * (+m.nodes || 0) + ROUTE_COST * (+m.routes || 0)) : null);
/** a size in words: "870 B", "12 KB", "1.4 MB". Pure. */
export const bytesLabel = (n) => (!Number.isFinite(+n) ? '' : n < 1000 ? Math.round(n) + ' B' : n < 1e6 ? (n < 1e4 ? (n / 1e3).toFixed(1) : Math.round(n / 1e3)) + ' KB' : (n / 1e6).toFixed(1) + ' MB');
/** the weight bands: 0 = under 1 KB club (a page of at most 1,000 bytes), 1 = light (under 50 KB), 2 = medium (under 500 KB), 3 = heavy. Pure. */
export const weightBand = (w) => (w === null || w === undefined || !Number.isFinite(+w) ? null : w <= 1000 ? 0 : w < 50000 ? 1 : w < 500000 ? 2 : 3);
/** what one home page is made of, from its html text, the sizes of what it loads and its sitemap: { bytes, scripts, styles, nodes, routes }.
 *  `assets` is [{ url, bytes }] for the same-site scripts, stylesheets and images the html names; `sitemapUrls` the count of urls its sitemap lists
 *  (null when it has none: the page's own internal links stand in). Pure. */
export function measure({ html = '', htmlBytes = null, assets = [], sitemapUrls = null, host = '' } = {}) {
  const text = String(html), tags = text.match(/<[a-zA-Z][^\s>/]*/g) || [];
  const scripts = (text.match(/<script\b/gi) || []).length, styles = (text.match(/<link\b[^>]*rel=["']?stylesheet|<style\b/gi) || []).length;
  const links = new Set(); for (const m of text.matchAll(/<a\b[^>]*\shref=["']([^"'#?]+)/gi)) { const h = m[1].trim(); if (/^\//.test(h) && !/^\/\//.test(h)) links.add(h); else if (host && h.replace(/^https?:\/\/(www\.)?/, '').startsWith(host + '/')) links.add(h); }
  const own = Number.isFinite(+htmlBytes) && htmlBytes !== null ? +htmlBytes : Buffer.byteLength(text), loaded = assets.reduce((n, a) => n + (Number.isFinite(+a.bytes) ? +a.bytes : 0), 0);
  return { bytes: own + loaded, scripts, styles, nodes: tags.length, routes: Number.isFinite(+sitemapUrls) && sitemapUrls !== null ? +sitemapUrls : links.size };
}
