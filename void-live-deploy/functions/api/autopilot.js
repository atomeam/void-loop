// What Verse did on its own, for a-to-mind.com/autopilot/. GET /api/autopilot?days=1|7 (lib/autopilot.js has the reading).
// Reads three records and nothing else: the commits Verse's own loops landed on main (GitHub's API, by author email), the successful
// deploys of main (deploy.yml runs) and the conductor's record (domains/conductor.json on main). Open GET, no input but the window:
// every path is built here, each answer is cached at the edge for 10 minutes, so a burst of visitors costs GitHub one read per window.
// GITHUB_TOKEN is used when the Pages project has it (a read only); without it the public allowance serves the cache misses.
import { REPO, OWN_EMAILS, summarize, kindCounts, startedByHour } from '../../lib/autopilot.js';

export const TTL = 600;
const GH = 'https://api.github.com', RAW = 'https://raw.githubusercontent.com/' + REPO + '/main/domains/conductor.json';
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=300' : 'no-store', ...extra } });

async function getJson(fetchFn, url, env) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'a-to-mind.com autopilot' };
  if (env && env.GITHUB_TOKEN && url.startsWith(GH)) headers.authorization = 'Bearer ' + env.GITHUB_TOKEN;
  const r = await fetchFn(url, { headers }); if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/** everything the page shows for the window, read live. `fetchFn` for tests. */
export async function readAutopilot(env, days, fetchFn = fetch, now = Date.now()) {
  const since = now - days * 86400e3, iso = new Date(since).toISOString().replace(/\.\d+Z$/, 'Z'), pages = days > 1 ? 6 : 3;
  const out = { days, since: new Date(since).toISOString(), read: new Date(now).toISOString(), sources: {} };
  const commits = []; let complete = true;
  try {
    for (const email of OWN_EMAILS) {
      for (let p = 1; p <= pages; p++) {
        const list = await getJson(fetchFn, GH + '/repos/' + REPO + '/commits?sha=main&per_page=100&page=' + p + '&since=' + iso + '&author=' + encodeURIComponent(email), env);
        if (!Array.isArray(list)) break; commits.push(...list); if (list.length < 100) break; if (p === pages) complete = false;
      }
    }
    const s = summarize(commits, since);
    Object.assign(out, { own: s.own.slice(0, 200), ownCount: s.own.length, kinds: kindCounts(s.own), merged: s.merged, complete });
    out.sources.commits = 'ok';
  } catch (e) { out.sources.commits = String(e.message || e).slice(0, 80); }
  try {
    const runs = await getJson(fetchFn, GH + '/repos/' + REPO + '/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=1&created=' + encodeURIComponent('>=' + iso), env);
    out.deploys = Number(runs && runs.total_count) || 0; out.sources.deploys = 'ok';
  } catch (e) { out.sources.deploys = String(e.message || e).slice(0, 80); }
  try {
    const c = await getJson(fetchFn, RAW, env);
    out.conductor = { updated: c.updated || null, last24h: c.last24h || null, byHour: startedByHour(c.ticks, Date.parse(c.updated) || now), held: Array.isArray(c.held) ? c.held.length : 0,
      heldWhy: [...new Set((c.held || []).map((h) => String(h && h.why || '').slice(0, 120)).filter(Boolean))].slice(0, 4), broken: Array.isArray(c.broken) ? c.broken.length : 0 };
    out.sources.conductor = 'ok';
  } catch (e) { out.sources.conductor = String(e.message || e).slice(0, 80); }
  return out;
}

export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), days = u.searchParams.get('days') === '7' ? 7 : 1;
  const key = new Request(u.origin + '/__void-autopilot/' + days);
  try { const hit = await caches.default.match(key); if (hit) return json({ ...(await hit.json()), cached: true }); } catch (_) {}
  const out = await readAutopilot(env, days, fetchFn);
  const ok = Object.values(out.sources).every((v) => v === 'ok');
  if (ok) try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {}
  return json(out);
}
