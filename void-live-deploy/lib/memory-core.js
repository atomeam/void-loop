// Void's memory (D1): short records about things the owner has done, written by tools such as tools/ouroboros.py.
// Everything that arrives is untrusted: it is validated, re-redacted and capped here, whatever the sender claims to have done.
export const CREATE = [
  'CREATE TABLE IF NOT EXISTS void_memory (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, summary TEXT NOT NULL, links TEXT NOT NULL, state TEXT NOT NULL, remote TEXT NOT NULL, last_commit TEXT NOT NULL, digest TEXT NOT NULL, sha256 TEXT NOT NULL, source TEXT NOT NULL, at TEXT NOT NULL, updated TEXT NOT NULL, body TEXT NOT NULL DEFAULT \'\', body_sha256 TEXT NOT NULL DEFAULT \'\')',
  'CREATE INDEX IF NOT EXISTS void_memory_updated ON void_memory (updated)',
];
export const MAX_BATCH = 200;
export const MAX_DIGEST = 32768; // characters of digest text kept per record; a longer one is rejected, never silently cut (a cut copy would not match its hash)
export const MAX_BODY = 262144;
const STATES = new Set(['remote-current', 'unpushed-commits', 'uncommitted-work', 'no-remote', '']);
const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private key]'],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[aws key]'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[github token]'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[api key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, 'Bearer [token]'],
  [/\b((?:api[_-]?key|secret|token|passw(?:or)?d|passwd|auth)[\w-]*)\s*([:=])\s*['"]?[^\s'",;]{4,}/gi, '$1$2 [redacted]'],
  [/:\/\/[^/\s:@]+:[^/\s@]+@/g, '://[credentials]@'],
  [/\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g, '[long token]'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
];
export const scrub = (s) => SECRETS.reduce((t, [re, rep]) => t.replace(re, rep), String(s == null ? '' : s));
const text = (v, n) => scrub(v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// null = reject the record
export function cleanRecord(r) {
  if (!r || typeof r !== 'object') return null;
  const id = String(r.id || '');
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) return null;
  const name = text(r.name, 120);
  if (!name) return null;
  const state = String(r.state || '');
  if (!STATES.has(state)) return null;
  const links = [...new Set((Array.isArray(r.links) ? r.links : []).map((l) => String(l).toLowerCase().replace(/[^a-z0-9+#._-]/g, '').slice(0, 40)).filter(Boolean))].slice(0, 40);
  const rawBody = r.body == null ? '' : String(r.body);
  if (rawBody.length > MAX_DIGEST) return null;
  const body = scrub(rawBody).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
  const sha = String(r.sha256 || '');
  const digest = String(r.digest || '').replace(/[^A-Za-z0-9._/-]/g, '').slice(0, 200);
  return {
    id, kind: String(r.kind || 'project').replace(/[^a-z-]/g, '').slice(0, 20) || 'project', name, summary: text(r.summary, 300), links, state,
    remote: text(r.remote, 200), last_commit: String(r.last_commit || '').slice(0, 40).replace(/[^0-9TZ:+.-]/g, ''), digest, sha256: /^[0-9a-f]{64}$/.test(sha) ? sha : '', body,
  };
}

const ready = new WeakSet();
export async function ensure(env) {
  if (ready.has(env.DB)) return;
  await env.DB.batch(CREATE.map((q) => env.DB.prepare(q)));
  for (const col of ["body TEXT NOT NULL DEFAULT ''", "body_sha256 TEXT NOT NULL DEFAULT ''"]) {
    try { await env.DB.prepare('ALTER TABLE void_memory ADD COLUMN ' + col).run(); } catch (_) { /* already there */ }
  }
  ready.add(env.DB);
}
const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function upsert(env, records, source = 'ouroboros') {
  const now = new Date().toISOString();
  const ok = records.map(cleanRecord).filter(Boolean);
  if (ok.length) {
    for (const r of ok) r.body_sha256 = r.body ? await sha256hex(r.body) : '';
    await env.DB.batch(ok.map((r) => env.DB.prepare(
      'INSERT INTO void_memory (id, kind, name, summary, links, state, remote, last_commit, digest, sha256, source, at, updated, body, body_sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name, summary = excluded.summary, links = excluded.links, state = excluded.state, remote = excluded.remote, last_commit = excluded.last_commit, digest = excluded.digest, sha256 = excluded.sha256, source = excluded.source, updated = excluded.updated, body = excluded.body, body_sha256 = excluded.body_sha256',
    ).bind(r.id, r.kind, r.name, r.summary, JSON.stringify(r.links), r.state, r.remote, r.last_commit, r.digest, r.sha256, String(source).slice(0, 40), now, now, r.body, r.body_sha256)));
  }
  return { saved: ok.length, rejected: records.length - ok.length };
}

const like = (t) => '%' + t.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
export async function search(env, q, limit = 20) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const n = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
  const where = terms.map(() => "(lower(name) LIKE ? ESCAPE '\\' OR lower(summary) LIKE ? ESCAPE '\\' OR lower(links) LIKE ? ESCAPE '\\')").join(' AND ');
  const args = terms.flatMap((t) => [like(t), like(t), like(t)]);
  const { results } = await env.DB.prepare(`SELECT id, kind, name, summary, links, state, remote, last_commit, digest, sha256, updated FROM void_memory${where ? ' WHERE ' + where : ''} ORDER BY updated DESC LIMIT ${n}`).bind(...args).all();
  return results.map((r) => ({ ...r, links: JSON.parse(r.links || '[]') }));
}
export async function byId(env, id) {
  const r = await env.DB.prepare('SELECT id, kind, name, summary, links, state, remote, last_commit, digest, sha256, body, body_sha256, updated FROM void_memory WHERE id = ?').bind(String(id).slice(0, 80)).first();
  return r ? [{ ...r, links: JSON.parse(r.links || '[]') }] : [];
}
export const forget = async (env, id) => (await env.DB.prepare('DELETE FROM void_memory WHERE id = ?').bind(String(id)).run()).meta.changes;
