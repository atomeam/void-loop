// Does anyone outside us visit Verse? (owner chore, 2026-10-26; docs/playbooks/traffic.md). Daily, from .github/workflows/traffic.yml, into
// domains/traffic.json: per day all visits, likely people, our own automation and bots, unique people, and over the range the top pages, referrer
// hosts and countries, as aggregates only (no address, no user agent string, nothing that names a person).
// Two sources, the better one first:
//   1. Cloudflare's GraphQL Analytics API for the zone a-to-mind.com (httpRequestsAdaptiveGroups: HTML responses to eyeballs, grouped by day and
//      user agent, path, referrer host and country, 31 days on every plan; httpRequests1dGroups for page views and uniques), with each token
//      the environment holds. Needs a token with Zone > Analytics > Read (and Zone > Zone > Read, or CLOUDFLARE_ZONE_ID set). As of 2026-10-26 no
//      token the repo holds has it (tools/cf-scope.mjs), so:
//   2. Verse's own count (functions/api/visit.js, fired by /visit.js on page load, cookie-less, our automation's user agents and bots sorted out).
//
//   node tools/traffic.mjs              print the summary
//   node tools/traffic.mjs --write      also write domains/traffic.json
//   node tools/traffic.mjs --json       print the JSON
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classify, refHost, cleanPage, peopleLine } from '../void-live-deploy/lib/visits.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.cloudflare.com/client/v4';
export const SITE = 'https://a-to-mind.com', ZONE = 'a-to-mind.com', OUT = resolve(root, 'domains/traffic.json');
const day = (t) => new Date(t).toISOString().slice(0, 10);
const short = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 120);

export const Q_DAILY = `query($zone: String!, $from: Date!, $to: Date!) { viewer { zones(filter: {zoneTag: $zone}) {
  httpRequests1dGroups(limit: 31, filter: {date_geq: $from, date_leq: $to}, orderBy: [date_ASC]) { dimensions { date } sum { requests pageViews } uniq { uniques } } } } }`;
export const Q_SPLIT = `query($zone: String!, $from: Time!, $to: Time!) { viewer { zones(filter: {zoneTag: $zone}) {
  httpRequestsAdaptiveGroups(limit: 10000, orderBy: [count_DESC], filter: {datetime_geq: $from, datetime_lt: $to, requestSource: "eyeball", edgeResponseContentTypeName: "html"}) {
    count dimensions { date userAgent clientRequestPath clientRefererHost clientCountryName } } } } }`;

/** adaptive groups [{ count, dimensions: { date, userAgent, clientRequestPath, clientRefererHost, clientCountryName } }] -> per day { all, people, ours,
 *  bots } and the people's top pages, referrer hosts and countries. The user agent decides the class and is then dropped. Pure. */
export function splitGroups(groups, top = 10) {
  const days = {}, pages = {}, refs = {}, countries = {};
  for (const g of Array.isArray(groups) ? groups : []) {
    const n = Math.floor(Number(g && g.count)) || 0, d = g && g.dimensions; if (!n || !d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) continue;
    const row = days[d.date] || (days[d.date] = { day: d.date, all: 0, people: 0, ours: 0, bots: 0 });
    const cls = classify({ ua: d.userAgent });
    row.all += n; row[cls === 'person' ? 'people' : cls === 'ours' ? 'ours' : 'bots'] += n;
    if (cls !== 'person') continue;
    const p = cleanPage(d.clientRequestPath); pages[p] = (pages[p] || 0) + n;
    const r = refHost(d.clientRefererHost, ZONE); if (r) refs[r] = (refs[r] || 0) + n;
    if (d.clientCountryName) countries[d.clientCountryName] = (countries[d.clientCountryName] || 0) + n;
  }
  const rank = (o) => Object.entries(o).filter(([k, n]) => k !== 'other' && n >= 2).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, top).map(([k, n]) => ({ k, n }));
  return { days: Object.values(days).sort((a, b) => (a.day < b.day ? -1 : 1)), pages: rank(pages), referrers: rank(refs), countries: rank(countries), truncated: (groups || []).length >= 10000 };
}

/** the first-party read (GET /api/visit?days=N, lib/visits.js summarize) -> the same shape. Pure. */
export function fromVisits(j) {
  if (!j || !j.ok || !Array.isArray(j.days)) return null;
  const top = (o) => (o && Array.isArray(o.top) ? o.top.map((x) => ({ k: String(x.k), n: Number(x.n) || 0 })) : []);
  return {
    days: j.days.map((d) => ({ day: d.day, all: d.views.person + d.views.ours + d.views.bot, people: d.views.person, ours: d.views.ours, bots: d.views.bot, uniquePeople: d.uniq.person })),
    pages: top(j.pages), referrers: top(j.referrers), countries: top(j.countries),
  };
}

/** the file: source, per day, the last seven days summed, the tops. `now` is a time; days before the window are dropped. Pure. */
export function build(src, parts, now = Date.now(), note = '') {
  const since = day(now - 6 * 864e5), days = parts.days || [];
  const wk = days.filter((d) => d.day >= since), sum = (k) => wk.reduce((a, d) => a + (Number(d[k]) || 0), 0);
  const uniq = wk.some((d) => Number.isFinite(d.uniquePeople));
  const t = { at: new Date(now).toISOString().slice(0, 16) + 'Z', source: src, note, week: { since, unique: uniq, people: uniq ? sum('uniquePeople') : sum('people'), views: sum('people'), ours: sum('ours'), bots: sum('bots') }, days, pages: parts.pages || [], referrers: parts.referrers || [], countries: parts.countries || [] };
  if (parts.truncated) t.truncated = true;
  t.line = peopleLine(t);
  return t;
}

async function call(fetcher, token, path, body) {
  try {
    const res = await fetcher(API + path, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    let j = null; try { j = await res.json(); } catch (_) {}
    return { status: res.status, body: j };
  } catch (e) { return { status: 0, body: { errors: [{ message: 'network: ' + short(e && e.message) }] } }; }
}
const errOf = (r) => { const e = r.body && r.body.errors && r.body.errors[0]; return e ? short(e.message || e.code) : 'HTTP ' + r.status; };

/** Cloudflare, with each token in turn: { ok, parts, token } or { ok: false, why } (one line per token, never the token). */
export async function fromCloudflare(env, fetcher = fetch, now = Date.now()) {
  const names = ['CLOUDFLARE_ANALYTICS_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_WORKERS_TOKEN'].filter((n) => env[n]), why = [];
  if (!names.length) return { ok: false, why: ['no Cloudflare token in this environment'] };
  for (const name of names) {
    const token = env[name];
    let zone = env.CLOUDFLARE_ZONE_ID;
    if (!zone) {
      const z = await call(fetcher, token, '/zones?name=' + ZONE);
      zone = z.status === 200 && z.body && z.body.success && z.body.result && z.body.result[0] && z.body.result[0].id;
      if (!zone) { why.push(name + ': cannot look up the zone (' + errOf(z) + '; needs Zone > Zone > Read or CLOUDFLARE_ZONE_ID)'); continue; }
    }
    const to = new Date(now), from = new Date(now - 29 * 864e5);
    const s = await call(fetcher, token, '/graphql', { query: Q_SPLIT, variables: { zone, from: day(from) + 'T00:00:00Z', to: to.toISOString() } });
    const zs = s.body && s.body.data && s.body.data.viewer && s.body.data.viewer.zones && s.body.data.viewer.zones[0];
    if (s.status !== 200 || !zs || (s.body.errors && s.body.errors.length)) { why.push(name + ': ' + errOf(s) + ' (needs Zone > Analytics > Read)'); continue; }
    const parts = splitGroups(zs.httpRequestsAdaptiveGroups);
    const d = await call(fetcher, token, '/graphql', { query: Q_DAILY, variables: { zone, from: day(from), to: day(to) } });
    const dz = d.body && d.body.data && d.body.data.viewer && d.body.data.viewer.zones && d.body.data.viewer.zones[0];
    for (const g of (dz && dz.httpRequests1dGroups) || []) {
      const row = parts.days.find((x) => x.day === g.dimensions.date);
      if (row) { row.pageViews = g.sum.pageViews; row.uniquesAll = g.uniq.uniques; } // Cloudflare's own totals, ours and bots included
    }
    return { ok: true, parts, token: name };
  }
  return { ok: false, why };
}

export async function fromSite(fetcher = fetch, site = SITE) {
  try {
    const r = await fetcher(site + '/api/visit?days=31', { headers: { 'user-agent': 'a2m-traffic/1.0' }, signal: AbortSignal.timeout(20000) });
    const parts = fromVisits(await r.json());
    return parts ? { ok: true, parts } : { ok: false, why: 'HTTP ' + r.status };
  } catch (e) { return { ok: false, why: short(e && e.message) }; }
}

async function main(argv) {
  const cf = await fromCloudflare(process.env);
  let t;
  if (cf.ok) t = build('cloudflare', cf.parts, Date.now(), "Cloudflare's GraphQL Analytics (HTML responses to eyeballs), read with " + cf.token);
  else {
    for (const w of cf.why) console.log('cloudflare: ' + w);
    const site = await fromSite();
    if (!site.ok) { console.error('the site count could not be read: ' + site.why); return 1; }
    t = build('verse', site.parts, Date.now(), 'Verse\'s own count (/api/visit, a beacon per page load on the stage); Cloudflare unreadable: ' + cf.why.join('; '));
  }
  if (argv.includes('--json')) console.log(JSON.stringify(t, null, 1));
  else console.log(t.line + '\n' + t.days.slice(-7).map((d) => d.day + '  people ' + d.people + (d.uniquePeople != null ? ' (' + d.uniquePeople + ' unique)' : '') + '  ours ' + d.ours + '  bots ' + d.bots).join('\n'));
  if (argv.includes('--write')) {
    let old = null; try { old = JSON.parse(readFileSync(OUT, 'utf8')); } catch (_) {}
    if (old && old.source === 'cloudflare' && t.source !== 'cloudflare') console.log('note: an earlier run read Cloudflare; this one could not');
    writeFileSync(OUT, JSON.stringify(t, null, 1) + '\n');
    console.log('wrote domains/traffic.json');
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
