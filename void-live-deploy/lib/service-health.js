// service-health — is each outside service Verse hands you to reachable, and how fast (asked by Verse, 2026-10-16: "Create a 'Service
// Health' dashboard card that monitors the connectivity and response speed of the new adapters (Waymo, Uber, Crypto, etc.)").
// Laid out the way status pages do it (Uptime Kuma, Statuspage): one row per service, a dot for up / slow / down, and its response
// time. Checked from the visitor's own browser only when the card opens or "Check again" is tapped: no timer, no server call, nothing
// kept. A link-only adapter (skills/providers.js: Waymo, Uber, Lyft, Uber Eats, DoorDash) has no API Verse calls, so its row times
// reaching the provider's site; a public API (CoinGecko for crypto, Bluesky's AppView for social) is asked for its health answer.
// Pure apart from `check`, which takes its fetch and clock as arguments.
// The stability gauge (asked by Verse, 2026-10-18: "a 'stability-gauge' on the Service Health card that fluctuates in real-time based on
// the frequency of incident reports in incidents.json"): Verse's own browser suite on main is a service too; its dial reads lib/autopsy.js
// stabilityOf over incidents.json (100 with no red suite in 7 days, 12 less per red one, halving every 12 hours) and the card redraws it on "Check again" and once
// a minute while open, so the needle moves as incidents land or age out.

export const SLOW_MS = 1500, TIMEOUT_MS = 8000, GAUGE_EVERY_MS = 60000;
/** the public APIs the stage's cards call, beside the link-only adapters of skills/providers.js. */
export const APIS = [
  { id: 'coingecko', name: 'CoinGecko', kind: 'crypto', url: 'https://api.coingecko.com/api/v3/ping', how: 'api' },
  { id: 'bluesky', name: 'Bluesky', kind: 'social', url: 'https://public.api.bsky.app/xrpc/_health', how: 'api' },
];
/** the provider adapters' sites, for a reachability check. providers: the PROVIDERS map of skills/providers.js. Pure. */
export function servicesOf(providers = {}) {
  const site = (p) => { try { const u = new URL(p.web({})); return u.origin + '/'; } catch (_) { return ''; } };
  return Object.values(providers).map((p) => ({ id: p.id, name: p.name, kind: p.kind, url: site(p), how: 'link' })).filter((s) => s.url).concat(APIS);
}
/** up, slow or down from one check { ok, ms }. Pure. */
export const grade = (r) => (!r || !r.ok ? 'down' : r.ms > SLOW_MS ? 'slow' : 'up');
/** how a time reads: 312 ms, 2.4 s. Pure. */
export const msText = (ms) => (ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s');

/** one check: a link-only site is fetched no-cors (any answer means it is reachable); an API must answer 2xx. -> { ok, ms, error? } */
export async function check(svc, { fetch: f = globalThis.fetch, now = () => performance.now(), timeout = TIMEOUT_MS } = {}) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null, t0 = now();
  const timer = setTimeout(() => ac && ac.abort(), timeout);
  try {
    const r = await f(svc.url, { mode: svc.how === 'api' ? 'cors' : 'no-cors', cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined });
    const ms = now() - t0;
    return svc.how === 'api' && !(r && r.ok) ? { ok: false, ms, error: 'answered ' + (r ? r.status : 'nothing') } : { ok: true, ms };
  } catch (e) {
    const ms = now() - t0;
    return { ok: false, ms, error: ms >= timeout - 50 ? 'no answer in ' + msText(timeout) : 'could not be reached' };
  } finally { clearTimeout(timer); }
}

/** the card's rows and summary from services and their results (same order; a missing result is "checking"). Pure. */
export function healthHtml(esc, services, results = []) {
  const done = results.filter(Boolean), up = done.filter((r) => grade(r) === 'up').length, slow = done.filter((r) => grade(r) === 'slow').length;
  const head = done.length < services.length ? 'checking ' + services.length + ' services…'
    : up + ' of ' + services.length + ' up' + (slow ? ', ' + slow + ' slow' : '') + (services.length - up - slow ? ', ' + (services.length - up - slow) + ' down' : '');
  const rows = services.map((s, i) => {
    const r = results[i], g = r ? grade(r) : 'checking';
    const said = !r ? 'checking…' : g === 'down' ? 'down · ' + (r.error || 'no answer') : g + ' · ' + msText(r.ms);
    return '<li class="sh-row" data-service="' + esc(s.id) + '" data-state="' + g + '"><span class="sh-dot" aria-hidden="true"></span><b>' + esc(s.name) + '</b>'
      + ' <span class="sh-kind">' + esc(s.kind) + ' · ' + (s.how === 'api' ? 'public API' : 'link into their app') + '</span> <span class="sh-said">' + esc(said) + '</span></li>';
  }).join('');
  return '<p class="sh-sum" aria-live="polite">' + esc(head) + '</p><ul class="sh-list">' + rows + '</ul>';
}

/** the needle's angle for a stability score: 0 points left (-90), 100 points right (+90). Pure. */
export const needleOf = (score) => Math.round(-90 + 1.8 * Math.max(0, Math.min(100, Number(score) || 0)));

/** the stability dial for Verse's own suite from a stabilityOf() reading: a half dial, a needle turned by the score, the label and the
 *  counts; a reading with no red suite recorded yet says so and rests the needle at the top. Every value is escaped. Pure. */
export function gaugeHtml(esc, g) {
  const known = !!(g && g.known), score = known ? g.score : 100, label = known ? g.label : 'none', deg = needleOf(score);
  const col = label === 'steady' ? '#3fb950' : label === 'wobbly' ? '#d29922' : label === 'shaky' ? '#f85149' : '#888';
  const said = !known ? 'no red suite recorded yet' : (g.capped ? 'at least ' : '') + g.week + ' red suite' + (g.week === 1 ? '' : 's') + ' on main in 7 days' + (g.fixed ? ' not yet fixed' : '') + (g.day ? ', ' + g.day + ' in the last day' : '') + (g.last != null ? '; the last one ' + (g.last < 1 ? 'under an hour' : g.last + (g.last === 1 ? ' hour' : ' hours')) + ' ago, and each counts for less as it ages' : '') + (g.fixed ? '; ' + g.fixed + ' fixed by a later green run no longer count' : '');
  return '<div class="sh-gauge" data-stability="' + esc(label) + '" data-score="' + esc(score) + '" role="img" aria-label="' + esc('Verse stability ' + score + ' of 100: ' + label + ', ' + said) + '">'
    + '<svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true"><path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="rgba(128,128,128,.3)" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="' + col + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + esc(Math.round(157 * score / 100)) + ' 157"/>'
    + '<g class="sh-needle" style="transform-origin:60px 62px;transform:rotate(' + esc(deg) + 'deg)"><line x1="60" y1="62" x2="60" y2="20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="62" r="4" fill="currentColor"/></g></svg>'
    + '<div><b>Verse itself</b> <span class="sh-kind">the browser suite on main</span><br><span class="sh-said" data-sh-label>' + esc(label === 'none' ? 'nothing to gauge' : label + ' · ' + score + '/100') + '</span> <span class="sh-kind">' + esc(said) + '</span></div></div>';
}
