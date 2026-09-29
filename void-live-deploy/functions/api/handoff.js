// Void handoff: agents and people drop a file or report, get a link back.
// POST /api/handoff  (Authorization: Bearer <HANDOFF_TOKEN>)  {name, author?, body} -> {id, url, expires}
// GET  /api/handoff?id=<id>            -> JSON   |   &raw=1 -> plain text body
// Reads use an unguessable 128-bit id (a private link). Writes need the token.
// Uses the existing D1 binding `DB`. Secret to add in Pages settings: HANDOFF_TOKEN.
const MAX_BYTES = 256 * 1024;
const TTL_SECONDS = 7 * 24 * 3600;
const ID_RE = /^[a-f0-9]{32}$/;
const NAME_RE = /^[A-Za-z0-9._\- ]{1,80}$/;
const reply = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      ...extra,
    },
  });
function sameToken(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
async function ensureTable(db) {
  await db
    .prepare('CREATE TABLE IF NOT EXISTS handoff (id TEXT PRIMARY KEY, name TEXT NOT NULL, author TEXT, body TEXT NOT NULL, created INTEGER NOT NULL)')
    .run();
}
export async function onRequest({ request, env }) {
  if (!env.DB) return reply({ error: 'storage not bound' }, 503);
  const url = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  await ensureTable(env.DB);
  if (request.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    if (!ID_RE.test(id)) return reply({ error: 'bad id' }, 400);
    const row = await env.DB.prepare('SELECT id, name, author, body, created FROM handoff WHERE id = ?').bind(id).first();
    if (!row || row.created + TTL_SECONDS < now) return reply({ error: 'not found' }, 404);
    if (url.searchParams.get('raw') === '1') {
      return new Response(row.body, {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
      });
    }
    return reply({ id: row.id, name: row.name, author: row.author, created: row.created, expires: row.created + TTL_SECONDS, body: row.body });
  }
  if (request.method === 'POST') {
    if (!env.HANDOFF_TOKEN) return reply({ error: 'handoff token not set' }, 503);
    const auth = request.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ') || !sameToken(auth.slice(7), env.HANDOFF_TOKEN)) return reply({ error: 'unauthorized' }, 401);
    let data;
    try { data = await request.json(); } catch { return reply({ error: 'send JSON' }, 400); }
    const name = typeof data.name === 'string' ? data.name : '';
    const author = typeof data.author === 'string' ? data.author.slice(0, 40) : null;
    const body = typeof data.body === 'string' ? data.body : '';
    if (!NAME_RE.test(name)) return reply({ error: 'name: 1-80 chars, letters digits . _ - space' }, 400);
    if (!body) return reply({ error: 'body is empty' }, 400);
    if (new TextEncoder().encode(body).length > MAX_BYTES) return reply({ error: 'body over 256 KB' }, 413);
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('DELETE FROM handoff WHERE created < ?').bind(now - TTL_SECONDS).run();
    await env.DB.prepare('INSERT INTO handoff (id, name, author, body, created) VALUES (?, ?, ?, ?, ?)').bind(id, name, author, body, now).run();
    return reply({ id, url: `${url.origin}/api/handoff?id=${id}&raw=1`, expires: now + TTL_SECONDS }, 201);
  }
  return reply({ error: 'GET or POST' }, 405, { allow: 'GET, POST' });
}
