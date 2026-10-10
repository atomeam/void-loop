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

// Whose memory a row is: '' is the owner's; a paid member's rows carry their account id. A member's record ids are stored behind a prefix of
// their own account id, so a member can never write over (or even name) anyone else's row, and they see their ids without it.
export const MEMBER_MAX = 500; // rows one member may keep
const prefixOf = (scope) => (scope ? 'm-' + scope + '.' : '');
const stored = (id, scope) => prefixOf(scope) + String(id);
const shown = (id, scope) => (scope && String(id).startsWith(prefixOf(scope)) ? String(id).slice(prefixOf(scope).length) : id);
const ready = new WeakSet();
export async function ensure(env) {
  if (ready.has(env.DB)) return;
  await env.DB.batch(CREATE.map((q) => env.DB.prepare(q)));
  for (const col of ["body TEXT NOT NULL DEFAULT ''", "body_sha256 TEXT NOT NULL DEFAULT ''", "owner_id TEXT NOT NULL DEFAULT ''"]) {
    try { await env.DB.prepare('ALTER TABLE void_memory ADD COLUMN ' + col).run(); } catch (_) { /* already there */ }
  }
  ready.add(env.DB);
}
const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function upsert(env, records, source = 'ouroboros', scope = '') {
  const now = new Date().toISOString();
  const ok = records.map(cleanRecord).filter(Boolean);
  if (ok.length && scope) {
    const have = Number((await env.DB.prepare('SELECT COUNT(*) AS c FROM void_memory WHERE owner_id = ?').bind(scope).first() || {}).c) || 0;
    if (have + ok.length > MEMBER_MAX) return { saved: 0, rejected: records.length, full: true };
  }
  if (ok.length) {
    for (const r of ok) r.body_sha256 = r.body ? await sha256hex(r.body) : '';
    await env.DB.batch(ok.map((r) => env.DB.prepare(
      'INSERT INTO void_memory (id, kind, name, summary, links, state, remote, last_commit, digest, sha256, source, at, updated, body, body_sha256, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name, summary = excluded.summary, links = excluded.links, state = excluded.state, remote = excluded.remote, last_commit = excluded.last_commit, digest = excluded.digest, sha256 = excluded.sha256, source = excluded.source, updated = excluded.updated, body = excluded.body, body_sha256 = excluded.body_sha256 WHERE void_memory.owner_id = excluded.owner_id',
    ).bind(stored(r.id, scope), r.kind, r.name, r.summary, JSON.stringify(r.links), r.state, r.remote, r.last_commit, r.digest, r.sha256, String(source).slice(0, 40), now, now, r.body, r.body_sha256, scope)));
  }
  return { saved: ok.length, rejected: records.length - ok.length };
}

const like = (t) => '%' + t.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
export async function search(env, q, limit = 20, scope = '') {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const n = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
  const where = ['owner_id = ?'].concat(terms.map(() => "(lower(name) LIKE ? ESCAPE '\\' OR lower(summary) LIKE ? ESCAPE '\\' OR lower(links) LIKE ? ESCAPE '\\')")).join(' AND ');
  const args = [scope].concat(terms.flatMap((t) => [like(t), like(t), like(t)]));
  const { results } = await env.DB.prepare(`SELECT id, kind, name, summary, links, state, remote, last_commit, digest, sha256, updated FROM void_memory WHERE ${where} ORDER BY updated DESC LIMIT ?`).bind(...args, n).all(); // void-review: ok (where is fixed fragments with ? placeholders; every value is bound)
  return results.map((r) => ({ ...r, id: shown(r.id, scope), links: JSON.parse(r.links || '[]') }));
}
// ---- ask: a plain question in, a plain answer out. No model: the words that matter are matched against what Void remembers.
const STOP = new Set('a an the i me my we our you your of on in at to for with and or is are was were do did does have has had what which who where when how why show tell list find about built build made make project projects thing things'.split(' '));
export async function ask(env, q, limit = 5, scope = '') {
  const words = [...new Set(String(q || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP.has(w)))].slice(0, 6);
  const n = Math.max(1, Math.min(20, parseInt(limit, 10) || 5));
  let hits = words.length ? await search(env, words.join(' '), n, scope) : [];
  if (!hits.length && words.length > 1) { // no project has every word: rank by how many words each one matches
    const seen = new Map();
    for (const w of words) for (const r of await search(env, w, 50, scope)) { const e = seen.get(r.id) || { r, c: 0 }; e.c++; seen.set(r.id, e); }
    hits = [...seen.values()].sort((a, b) => b.c - a.c || String(b.r.updated).localeCompare(String(a.r.updated))).slice(0, n).map((e) => e.r);
  }
  if (!hits.length) return { answer: words.length ? 'Nothing I remember matches ' + words.join(', ') + '.' : 'Ask me about a project, a tool or a year.', matches: [] };
  const line = (r) => '• ' + r.name + (r.links.length ? ' (' + r.links.slice(0, 4).join(', ') + ')' : '') + (r.summary ? ': ' + String(r.summary).slice(0, 140) : '')
    + (r.last_commit ? ' · last change ' + String(r.last_commit).slice(0, 10) : '') + (r.remote ? ' · backed up at ' + r.remote : ' · no remote copy');
  return { answer: 'I remember ' + hits.length + ' match' + (hits.length > 1 ? 'es' : '') + ':\n' + hits.map(line).join('\n'), matches: hits.map((r) => r.id) };
}
export async function byId(env, id, scope = '') {
  const r = await env.DB.prepare('SELECT id, kind, name, summary, links, state, remote, last_commit, digest, sha256, body, body_sha256, updated FROM void_memory WHERE id = ? AND owner_id = ?').bind(stored(String(id).slice(0, 80), scope), scope).first();
  return r ? [{ ...r, id: shown(r.id, scope), links: JSON.parse(r.links || '[]') }] : [];
}
export const forget = async (env, id, scope = '') => (await env.DB.prepare('DELETE FROM void_memory WHERE id = ? AND owner_id = ?').bind(stored(id, scope), scope).run()).meta.changes;

// ---- organize: how the remembered projects relate. Read-only; computed from the tags each record already carries.
// File-type tags would join every project to every other, so they are left out here (they stay stored).
const NOISE = new Set(['md', 'txt', 'json', 'yml', 'yaml', 'toml', 'html', 'css', 'svg', 'png', 'jpg', 'xml', 'lock', 'cfg', 'ini', 'gitignore', 'package.json', 'pyproject.toml']);
const tagsOf = (r) => (JSON.parse(r.links || '[]')).filter((t) => !NOISE.has(t));
const everything = async (env, scope = '') => (await env.DB.prepare('SELECT id, name, summary, links, state, updated FROM void_memory WHERE owner_id = ? ORDER BY updated DESC LIMIT 2000').bind(scope).all()).results.map((r) => ({ ...r, id: shown(r.id, scope) }));

export async function topics(env, scope = '') {
  const by = new Map();
  for (const r of await everything(env, scope)) for (const t of tagsOf(r)) (by.get(t) || by.set(t, []).get(t)).push({ id: r.id, name: r.name });
  return [...by].map(([tag, items]) => ({ tag, count: items.length, projects: items.slice(0, 20) })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 100);
}

export async function related(env, id, limit = 10, scope = '') {
  const all = await everything(env, scope);
  const me = all.find((r) => r.id === String(id));
  if (!me) return null;
  const mine = new Set(tagsOf(me));
  const n = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
  return all.filter((r) => r.id !== me.id).map((r) => {
    const theirs = new Set(tagsOf(r)), shared = [...mine].filter((t) => theirs.has(t));
    return { id: r.id, name: r.name, summary: r.summary, state: r.state, shared, score: shared.length / (new Set([...mine, ...theirs]).size || 1) };
  }).filter((r) => r.shared.length).sort((a, b) => b.score - a.score || b.shared.length - a.shared.length || a.name.localeCompare(b.name)).slice(0, n)
    .map((r) => ({ ...r, score: Math.round(r.score * 100) / 100 }));
}
