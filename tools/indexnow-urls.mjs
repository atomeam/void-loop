// The pure half of tools/indexnow.mjs (owner, 2026-10-26: "wire IndexNow into the deployment pipeline so that search engines utilizing the
// protocol (like Bing and Yandex) are notified within minutes whenever new single-purpose utility pages go live"): which sitemap URLs a set of
// changed files touches, the sitemap parse, the key file, the POST body and what each engine answer means. No git, no network, no disk writes.
// The protocol (indexnow.org/documentation, Yandex's IndexNow reference): POST JSON { host, key, keyLocation, urlList } to
// https://api.indexnow.org/indexnow, at most 10,000 URLs a request, every URL on `host`; the key is 8-128 of a-z A-Z 0-9 and '-', served as
// <key>.txt holding the key. An IndexNow key is public by design: an engine fetches it from the site to check the site is ours.

export const ENDPOINT = 'https://api.indexnow.org/indexnow';
export const MAX_URLS = 10000;
export const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;
const D = 'void-live-deploy/';

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
/** the <loc> URLs of a sitemap, in order, unescaped and without repeats. */
export function sitemapUrls(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)) { const u = unesc(m[1]); if (u && !out.includes(u)) out.push(u); }
  return out;
}

/** the key a key file holds: the file is <key>.txt and holds exactly the key; null when the name, the body or the shape disagree. */
export function keyFromFile(name, body) {
  const m = /^([^/]+)\.txt$/.exec(String(name || ''));
  const key = m && m[1];
  return key && KEY_RE.test(key) && String(body || '').trim() === key ? key : null;
}

/**
 * The listed URLs a deploy's changed files touch. `changed` are repo paths (git diff --name-only); `pages` are tools/sitemap.mjs pages():
 * { loc, files } with the files whose change is a change of that page (the /is-it/ days name their one function and skill); `listed` are
 * the sitemap's URLs, the only ones ever sent. A file in a page's own folder counts too (a tool page's script beside its index.html), never
 * for the home page (everything is in its folder); the repo's void.html is the home page (the deploy copies it to index.html).
 */
export function changedUrls(changed, pages, listed, site = 'https://a-to-mind.com') {
  const files = new Set((changed || []).map((f) => String(f).replace(/\\/g, '/')));
  if (files.has('void.html')) files.add(D + 'index.html');
  const want = new Set(listed || []), live = (pages || []).filter((p) => want.has(site + p.loc));
  // a file belongs to the deepest listed page folder holding it: pdf/merge/app.js is /pdf/merge/'s, not /pdf/'s
  const dirOf = (p) => (p.loc !== '/' && p.loc.endsWith('/') ? D + p.loc.slice(1) : null);
  const owner = new Map();
  for (const f of files) {
    let best = null;
    for (const p of live) { const d = dirOf(p); if (d && f.startsWith(d) && (!best || d.length > dirOf(best).length)) best = p; }
    if (best) owner.set(f, best.loc);
  }
  const out = [];
  for (const p of live) {
    const url = site + p.loc;
    if (out.includes(url)) continue;
    if ((p.files || []).some((f) => files.has(f)) || [...owner.values()].includes(p.loc)) out.push(url);
  }
  return out;
}

/** the request bodies for `urls`, at most MAX_URLS each; none when there is nothing to send. */
export function bodies(urls, { host, key, keyLocation }, max = MAX_URLS) {
  const out = [];
  for (let i = 0; i < (urls || []).length; i += max) out.push({ host, key, keyLocation, urlList: urls.slice(i, i + max) });
  return out;
}

/** what an engine's HTTP status means (indexnow.org, Yandex's reference), and whether the URLs were taken. */
export function meaning(status) {
  const m = {
    200: [true, 'OK: URLs submitted'],
    202: [true, 'Accepted: URLs received, the key is still being checked'],
    400: [false, 'Bad request: the body is not valid IndexNow'],
    403: [false, 'Forbidden: key not valid (the key file was not found or does not hold the key)'],
    422: [false, 'Unprocessable: a URL is not on the host, or the key or keyLocation does not fit the protocol'],
    429: [false, 'Too many requests: the engine is rate-limiting (possible spam)'],
  }[status];
  return m ? { ok: m[0], text: m[1] } : { ok: status >= 200 && status < 300, text: 'HTTP ' + status };
}
