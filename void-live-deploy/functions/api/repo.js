// See a public GitHub repository (lib/repo-look.js has the reading, skills/repo.js is the card). GET /api/repo?r=owner/name or a github.com URL.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server read one public repo's facts from api.github.com: the name must match ^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$
//     after parsing, every path is built here from that name (a caller picks no host, path, query or header), a redirect is followed only
//     when it stays on api.github.com/repositories/<number>, each body is cut at 200 KB, and the card lists at most 60 files and 5 commits (no SSRF);
//   - spend the shared unauthenticated GitHub allowance: a repeat inside 10 minutes is answered from the edge cache and costs nothing, a miss
//     costs 6 GitHub calls and the caller's allowance of 6 misses a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read text that people wrote in that repo (README, commit messages). It is untrusted: cut, stripped of control characters and key shapes,
//     escaped by the page, and NEVER given to a model. There is no model, no token, no secret, no database and no write here.
// Private or missing repos get one plain sentence: "I can only see public repos". A failure is never cached.
import { rateLimited } from './answer.js';
import { parseRepo, lookRepo } from '../../lib/repo-look.js';

export const RL_MAX = 6, TTL = 600;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });

export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), full = parseRepo(u.searchParams.get('r'));
  if (!full) return json({ ok: false, kind: 'missing', say: 'Give me a public repo as owner/name, like atomeam/void-loop, or paste its github.com link.' }, 400);
  const key = new Request(u.origin + '/__void-repo/' + encodeURIComponent(full.toLowerCase()));
  try { const hit = await caches.default.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=300' }); } catch (_) {}
  if (await rateLimited(request, env || {}, 'repo', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of repos in a minute. Give me a moment and ask again.' }, 429);
  const out = await lookRepo(full, fetchFn);
  if (!out.ok) return json(out, out.kind === 'missing' ? 404 : out.kind === 'limited' ? 429 : 502, { 'cache-control': 'no-store' });
  try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {}
  return json(out, 200, { 'cache-control': 'public, max-age=300' });
}
