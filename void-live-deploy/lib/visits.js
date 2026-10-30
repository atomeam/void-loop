// Who visits Verse, counted by Verse itself (owner chore, 2026-10-26: nobody knew whether anyone outside us visits the site, the owner will not
// switch on Cloudflare Web Analytics, and no token the repo holds can read Cloudflare's analytics; docs/RULES.md: an owner chore is worked around
// or gathered another way, never dropped). The pure half, shared by functions/api/visit.js (the route), /visit.js (the beacon) and
// tools/traffic.mjs (the daily count in domains/traffic.json). COUNTS ONLY: no address, no cookie, no user agent string, nothing that names a person
// is stored or returned. A visit is sorted into one of three classes: a person, our own automation, or a bot.

/** the tower gate's phone Chrome (tools/tower-gate.mjs UA): an exact string no person's phone sends in late 2026 */
export const GATE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const OURS_RE = /^a2m-|HeadlessChrome|Playwright/i;
const BOT_RE = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|uptime|lighthouse|pagespeed|gtmetrix|python|curl\/|wget|httpclient|axios|node-fetch|undici|go-http|java\/|okhttp|scrapy|phantom|selenium|puppeteer|headless/i;

export const CLASSES = Object.freeze(['person', 'ours', 'bot']);

/** a visit's class from what the request says about itself: the user agent, the browser suite's x-void-test header, navigator.webdriver. Pure. */
export function classify({ ua, test, webdriver } = {}) {
  const u = String(ua || '');
  if (test || webdriver || u === GATE_UA || OURS_RE.test(u)) return 'ours';
  if (!u.trim() || BOT_RE.test(u)) return 'bot';
  return 'person';
}

export const LIMITS = Object.freeze({
  body: 300,          // bytes: {"p":"/","r":"news.ycombinator.com","w":0} is about 45
  perMinute: 20,      // beacons per hashed connection per minute (edge cache)
  perDay: 300,        // beacons per hashed connection per UTC day (D1)
  globalPerDay: 8000, // beacons per UTC day in all: the D1 write budget (about 6 writes each)
  keysPerDay: 50,     // distinct pages, referrer hosts or countries kept per day; the rest count as "other"
  countCap: 9999999,  // one count never goes past this
  days: 31,           // the most days a read covers
  shownMin: 2,        // a page or referrer host seen fewer times than this over the range is folded into "other" when read back
});

/** a page's path reduced to its first segment ("/markets/aapl" -> "/markets/"), "/" for the stage, "other" for anything else. Pure. */
export function cleanPage(p) {
  const s = String(p || '').split(/[?#]/)[0];
  if (s === '/' || s === '' || s === '/index.html' || s === '/void.html') return '/';
  const m = /^\/([a-z0-9-]{1,32})(?:\/|\.html$|$)/.exec(s);
  return m ? '/' + m[1] + '/' : 'other';
}

/** a referrer's host only, lowercased, "www." dropped; "" for none, our own host or anything that is not a public-looking host name. Pure. */
export function refHost(r, own = 'a-to-mind.com') {
  let h = String(r || '').trim().toLowerCase();
  if (!h) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(h)) { try { const u = new URL(h); if (!/^https?:$/.test(u.protocol)) return ''; h = u.hostname; } catch (_) { return ''; } }
  h = h.replace(/^www\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9.-]{3,80}$/.test(h) || !/\.[a-z]{2,}$/.test(h)) return ''; // a bare intranet name or an address is never kept
  if (h === own || h.endsWith('.' + own) || /\.pages\.dev$/.test(h) || h === 'localhost') return '';
  return h;
}

/** a two-letter country code from request.cf, or "". Pure. */
export const countryOf = (c) => (/^[A-Z]{2}$/.test(String(c || '')) && c !== 'XX' && c !== 'T1' ? c : '');

/** the beacon's body: text/plain (sendBeacon) or JSON, { p, r, w }; unknown fields ignored. -> { ok, page, ref, webdriver } or { ok: false, status, error }
 *  with a fixed message (nothing from the request is put in an error). Pure. */
export function parseBeacon(contentType, text, own) {
  if (!/^(text\/plain|application\/json)\s*(;|$)/i.test(String(contentType || ''))) return { ok: false, status: 415, error: 'send JSON' };
  const s = typeof text === 'string' ? text : '';
  if (new TextEncoder().encode(s).length > LIMITS.body) return { ok: false, status: 413, error: 'too big' };
  let b; try { b = JSON.parse(s); } catch (_) { return { ok: false, status: 400, error: 'bad request' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, status: 400, error: 'bad request' };
  return { ok: true, page: cleanPage(b.p), ref: refHost(b.r, own), webdriver: b.w === 1 || b.w === true };
}

const num = (x) => { const n = Math.floor(Number(x)); return Number.isFinite(n) && n > 0 ? n : 0; };
const zero = () => ({ person: 0, ours: 0, bot: 0 });

/** stored rows [{ day, kind, k, n }] -> what a read returns: per day the views and unique visitors of each class, and over the range the top
 *  pages, referrer hosts and countries of people (each seen at least LIMITS.shownMin times; the rest summed as "other"). Integers only. Pure. */
export function summarize(rows, { top = 10 } = {}) {
  const days = {}, tops = { page: {}, ref: {}, country: {} };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.day))) continue;
    const n = num(r.n); if (!n) continue;
    if ((r.kind === 'views' || r.kind === 'uniq') && CLASSES.includes(r.k)) {
      const d = days[r.day] || (days[r.day] = { day: r.day, views: zero(), uniq: zero() });
      d[r.kind][r.k] = Math.min(d[r.kind][r.k] + n, LIMITS.countCap);
    } else if (tops[r.kind] && typeof r.k === 'string') tops[r.kind][r.k] = (tops[r.kind][r.k] || 0) + n;
  }
  const rank = (o) => {
    let other = 0; const list = [];
    for (const [k, n] of Object.entries(o)) { if (k === 'other' || n < LIMITS.shownMin) other += n; else list.push({ k, n }); }
    list.sort((a, b) => b.n - a.n || (a.k < b.k ? -1 : 1));
    for (const x of list.slice(top)) other += x.n;
    return { top: list.slice(0, top), other };
  };
  return { days: Object.values(days).sort((a, b) => (a.day < b.day ? -1 : 1)), pages: rank(tops.page), referrers: rank(tops.ref), countries: rank(tops.country) };
}

/** the line on the growth card and in self.json: "People this week: 12 (…)". `t` is domains/traffic.json. Pure. */
export function peopleLine(t) {
  if (!t || !t.week || !Number.isFinite(t.week.people)) return '';
  const w = t.week, src = t.source === 'cloudflare' ? "from Cloudflare's counts, our own runs taken out" : 'counted by Verse itself, no cookies, our own runs and bots taken out';
  if (w.unique === false) return 'Visits by people this week: ' + w.people.toLocaleString('en') + ' (' + src + ')'; // no unique count from this source: visits, said as visits
  return 'People this week: ' + w.people.toLocaleString('en') + ' (' + (Number.isFinite(w.views) ? w.views.toLocaleString('en') + (w.views === 1 ? ' visit; ' : ' visits; ') : '') + src + ')';
}
