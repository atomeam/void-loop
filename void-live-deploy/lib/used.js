// How often the lab's experiments are really opened (the fringe → core loop, owner's direction 2026-10-13: "if you want void to
// be truly self-sustaining, you need to focus on the feedback loops between the fringe experiments and the core"; the owner
// chose to reuse /api/miss, capped). The page sends { kind: 'used', id } when a lab experiment opens; only an id that names a
// page under /fringe/ is counted, nothing typed is sent or kept, and the page sends one per browser per experiment per day
// (the endpoint also keeps one per connection per experiment per day). Rows are per day, so "opened on N different days" is
// a COUNT. tools/lab-use.mjs reads it (owner-only GET /api/misses?used=1) and the will turns it into wants: an experiment
// opened on enough days becomes "make it a core skill", one never opened goes to the salvage shelf.
export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TABLE = 'CREATE TABLE IF NOT EXISTS void_used (id TEXT NOT NULL, day TEXT NOT NULL, opens INTEGER NOT NULL, PRIMARY KEY (id, day))';
const made = new WeakMap();
function ensure(env) {
  let p = made.get(env.DB);
  if (!p) { p = env.DB.prepare(TABLE).run().catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}

/** true when `id` names a live lab page: the static file /fringe/<id>.html (the deployed files are the fixed list) */
export async function isLab(env, origin, id) {
  if (!ID.test(String(id || '')) || id.length > 60 || !env.ASSETS) return false;
  try { const r = await env.ASSETS.fetch(new Request(origin + '/fringe/' + id + '.html')); return r.ok; } catch (_) { return false; }
}

/** count one open of `id` on `day` (YYYY-MM-DD) */
export async function noteUse(env, id, day) {
  await ensure(env);
  await env.DB.prepare('INSERT INTO void_used (id, day, opens) VALUES (?, ?, 1) ON CONFLICT(id, day) DO UPDATE SET opens = opens + 1').bind(id, day).run();
}

/** per experiment since `from` (YYYY-MM-DD): { id, days, opens, first, last } */
export async function readUse(env, from) {
  await ensure(env);
  const { results } = await env.DB.prepare('SELECT id, COUNT(*) AS days, SUM(opens) AS opens, MIN(day) AS first, MAX(day) AS last FROM void_used WHERE day >= ? GROUP BY id ORDER BY days DESC, id').bind(from).all();
  return results || [];
}
