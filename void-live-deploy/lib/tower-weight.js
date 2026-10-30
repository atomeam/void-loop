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
/** the interactive elements of one home page, by kind (owner, 2026-10-29: smallest is the fewest interactive elements on the home page, the
 *  lighter page first on a tie; domains/targets/sycophanthex.json counts them the same way: 33 links and 1 input make 34). A link is every
 *  <a href>, an input every field a person types into or ticks (textarea included), a button every <button>, submit, reset, image input or
 *  role="button", a select every <select>. Scripts, styles, comments, noscript and templates are left out first. Pure. */
export function controlsOf(html = '') {
  const t = String(html).replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, ' '), n = (re) => (t.match(re) || []).length;
  const links = n(/<a\b[^>]*\shref\s*=/gi), selects = n(/<select\b/gi);
  const inputs = n(/<input\b(?![^>]*\btype\s*=\s*["']?(?:hidden|submit|button|reset|image)\b)/gi) + n(/<textarea\b/gi);
  const buttons = n(/<button\b/gi) + n(/<input\b[^>]*\btype\s*=\s*["']?(?:submit|button|reset|image)\b/gi) + n(/<(?!button\b|a\b|input\b)[a-z][a-z0-9-]*\b[^>]*\brole\s*=\s*["']?button\b/gi);
  return { links, inputs, buttons, selects, total: links + inputs + buttons + selects };
}
/** the controls count a ranking may trust, else null: a home page whose html holds fewer than 2 controls is the shell a script builds the page in,
 *  a sign-in wall or a stub, not the page (2026-10-29: linkedin.com/jobs read 1 control over 19 scripts and put the jobs lane first). Pure. */
export const trustedControls = (row) => { const c = row && row.controls; return c === null || c === undefined || !Number.isFinite(+c) || +c < 2 ? null : +c; };
/** the controls count the queue may rank on, else null: a trusted count read on the rendered page of the site itself. A row the browser could not
 *  render (counted 'unrendered') or read without a browser (counted 'html') is a raw-html guess, and a page tools/tower-size.mjs found to be a bot
 *  wall or a country or language picker (shell 'wall' or 'gateway') is a door, not the site: each sorts behind every rendered row, so a failed render
 *  or a splash page never jumps the queue as a fake small site (owner review, 2026-10-30: howsecureismypassword.net read 3 raw controls, 9 rendered;
 *  serverdiscounter.com's 3 were a bot check's links, wheeloutlet.com's 6 a country picker). Pure. */
export const rankableControls = (row) => (!row || ['unrendered', 'html'].includes(row.counted) || ['wall', 'gateway'].includes(row.shell) ? null : trustedControls(row));
/** what one home page is made of, from its html text, the sizes of what it loads and its sitemap: { bytes, controls, scripts, styles, nodes, routes }.
 *  `assets` is [{ url, bytes }] for the same-site scripts, stylesheets and images the html names; `sitemapUrls` the count of urls its sitemap lists
 *  (null when it has none: the page's own internal links stand in). `controls` is controlsOf's total. Pure. */
export function measure({ html = '', htmlBytes = null, assets = [], sitemapUrls = null, host = '' } = {}) {
  const text = String(html), tags = text.match(/<[a-zA-Z][^\s>/]*/g) || [];
  const scripts = (text.match(/<script\b/gi) || []).length, styles = (text.match(/<link\b[^>]*rel=["']?stylesheet|<style\b/gi) || []).length;
  const links = new Set(); for (const m of text.matchAll(/<a\b[^>]*\shref=["']([^"'#?]+)/gi)) { const h = m[1].trim(); if (/^\//.test(h) && !/^\/\//.test(h)) links.add(h); else if (host && h.replace(/^https?:\/\/(www\.)?/, '').startsWith(host + '/')) links.add(h); }
  const own = Number.isFinite(+htmlBytes) && htmlBytes !== null ? +htmlBytes : Buffer.byteLength(text), loaded = assets.reduce((n, a) => n + (Number.isFinite(+a.bytes) ? +a.bytes : 0), 0);
  return { bytes: own + loaded, controls: controlsOf(text).total, scripts, styles, nodes: tags.length, routes: Number.isFinite(+sitemapUrls) && sitemapUrls !== null ? +sitemapUrls : links.size };
}
