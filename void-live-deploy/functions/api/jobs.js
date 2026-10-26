// Live job listings for the jobs pages (/jobs/ and its lane pages, lib/job-sites.js): GET /api/jobs -> { at, sources: { <id>: { ok, at, count } }, jobs: [...] },
// GET /api/jobs?format=rss&<search> -> RSS 2.0 of that search from the sources whose terms allow a feed (Jobicy only).
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED (docs/RULES.md: every open GET is written down). This is an open, read-only GET. The most a caller can do is:
//   - make Verse's server ask THREE fixed addresses (Remotive, Jobicy, Himalayas; written here, no part of them comes from the caller) for their newest jobs, and only when
//     the edge cache has none: each source's answer is kept for as long as its terms ask (Jobicy an hour, Remotive twelve hours, Himalayas a day: lib/jobs-core.js
//     SOURCES ttl), so a flood of calls costs at most three upstream calls per data centre per period; a failed answer is cached for five minutes so it is not retried
//     in a loop. The caller's search (for the feed) is read only against the cached list, never sent anywhere.
//   - read public job listings, cut to a short excerpt with emails, phone numbers, addresses and links taken out (lib/jobs-core.js scrub). No key, no secret, no KV, no
//     database, no write, no model. Nothing about the caller is kept.
// THE SOURCES' TERMS (read 2026-10-26, lib/jobs-core.js): every listing keeps its source and its link to the original posting; the feed carries Jobicy only (Remotive and
// Himalayas ask that their jobs are not passed on through feeds); no JobPosting data anywhere; X-Robots-Tag noindex on every answer, so this is never a job board for a
// search engine to pick up.
import { SOURCES, normalise, toRss, fromQuery } from '../../lib/jobs-core.js';

export const UA = 'Verse (a-to-mind.com; jobs page)';
// the fixed addresses: newest jobs, a modest page of each (Himalayas allows 20 a call)
export const UPSTREAM = Object.freeze({ remotive: SOURCES.remotive.api + '?limit=150', jobicy: SOURCES.jobicy.api + '?count=100', himalayas: SOURCES.himalayas.api + '?limit=20&offset=0' });
const FAIL_TTL = 300;

/** one source's listings through the edge cache: { ok, at, jobs }. */
export async function sourceJobs(id, { fetchFn = fetch, cache = null, origin = 'https://a-to-mind.com', now = Date.now } = {}) {
  const key = new Request(origin + '/__jobs/' + id + '/v1');
  if (cache) { try { const hit = await cache.match(key); if (hit) return await hit.json(); } catch (_) { /* a miss */ } }
  let out;
  try {
    const r = await fetchFn(UPSTREAM[id], { headers: { accept: 'application/json', 'user-agent': UA }, signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
    if (!r.ok) throw new Error('status ' + r.status);
    const jobs = normalise(id, await r.json()); if (!jobs.length) throw new Error('empty');
    out = { ok: true, at: new Date(now()).toISOString(), jobs };
  } catch (e) { out = { ok: false, at: new Date(now()).toISOString(), error: String((e && e.message) || e).slice(0, 60), jobs: [] }; }
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + (out.ok ? SOURCES[id].ttl : FAIL_TTL) } })); } catch (_) { /* no cache here */ } }
  return out;
}
/** every source at once. */
export async function allJobs(opts = {}) {
  const ids = Object.keys(UPSTREAM), got = await Promise.all(ids.map((id) => sourceJobs(id, opts)));
  const sources = {}, jobs = []; ids.forEach((id, i) => { sources[id] = { ok: got[i].ok, at: got[i].at, count: got[i].jobs.length }; jobs.push(...got[i].jobs); });
  return { at: new Date((opts.now || Date.now)()).toISOString(), sources, credit: 'Listings from Remotive (remotive.com), Jobicy (jobicy.com) and Himalayas (himalayas.app); each links to its original posting.', jobs };
}

export async function onRequestGet({ request }) {
  const u = new URL(request.url), cache = typeof caches !== 'undefined' ? caches.default : null;
  const data = await allJobs({ cache, origin: u.origin });
  const head = { 'x-robots-tag': 'noindex, nofollow', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' };
  if (u.searchParams.get('format') === 'rss') return new Response(toRss(data.jobs, fromQuery(u.search), u.origin), { headers: { ...head, 'content-type': 'application/rss+xml; charset=utf-8' } });
  return new Response(JSON.stringify(data), { headers: { ...head, 'content-type': 'application/json; charset=utf-8' } });
}
