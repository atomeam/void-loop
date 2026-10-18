// a-to-mind.com/c/<clip>?p=<platform>&q=<ask>: the link in every Verse clip's description (tools/clips.mjs). Counts the visit in D1
// (void_clip_visits: which clip, which platform, when; no IP, no cookie) and sends the visitor to Void with the clip's ask, so we can
// see which clip drove visits and Verse can film more of what works. Hostile read: clip and platform are checked against patterns,
// the ask is capped and only ever becomes ?q= on Void's own page. GET /c/_stats with the owner's token -> visits per clip and platform.
import { ownerOk } from '../../lib/guard.js';

export const CLIP_RE = /^[0-9]{8}-[a-z0-9-]{2,60}$/, PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x', 'site', 'other'];
const TABLE = 'CREATE TABLE IF NOT EXISTS void_clip_visits (clip TEXT NOT NULL, platform TEXT NOT NULL, at TEXT NOT NULL)';

/** where the visitor goes and what is counted. Pure. */
export function landing(clip, url) {
  const p = PLATFORMS.includes(url.searchParams.get('p')) ? url.searchParams.get('p') : 'other';
  const q = String(url.searchParams.get('q') || '').replace(/[\u0000-\u001f]/g, '').slice(0, 120);
  const to = new URL('/', url.origin); if (q) to.searchParams.set('q', q); to.searchParams.set('src', 'clip');
  return { ok: CLIP_RE.test(clip), clip, platform: p, to: to.pathname + to.search };
}

export async function onRequestGet({ request, env, params, waitUntil }) {
  const url = new URL(request.url), clip = String(params.clip || '');
  if (clip === '_stats') {
    if (!(await ownerOk(request, env))) return new Response('only the owner', { status: 403 });
    await env.DB.prepare(TABLE).run();
    const { results } = await env.DB.prepare('SELECT clip, platform, COUNT(*) AS visits FROM void_clip_visits GROUP BY clip, platform ORDER BY visits DESC LIMIT 500').all();
    return Response.json({ visits: results }, { headers: { 'cache-control': 'no-store' } });
  }
  const l = landing(clip, url);
  if (l.ok && env.DB) {
    const job = env.DB.prepare(TABLE).run().then(() => env.DB.prepare('INSERT INTO void_clip_visits (clip, platform, at) VALUES (?, ?, ?)').bind(l.clip, l.platform, new Date().toISOString()).run()).catch(() => null);
    if (typeof waitUntil === 'function') waitUntil(job); else await job;
  }
  return new Response(null, { status: 302, headers: { location: l.to, 'cache-control': 'no-store' } });
}
