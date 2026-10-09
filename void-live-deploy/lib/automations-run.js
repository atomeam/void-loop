/**
 * Void's automations, the side that touches the world (lib/automations.js says what a rule may do; this runs it).
 * D1: void_automations (the rules) and void_automation_runs (what each run did, newest 200 kept). GitHub through its
 * REST API with GITHUB_TOKEN (a fine-grained token the owner sets in the Pages project: contents + pull requests +
 * issues on the allowed repos). Without the token a GitHub step fails with that reason in the log, nothing else.
 * A webhook rule has its own secret: shown once when it is made (or rotated), kept only as a SHA-256. The secret is the
 * whole of a hook's authorisation, so the spend it can cause is fenced here too: a rule runs at most RUN_CAP_DAY times a
 * day from webhooks (AUTOMATION_RUN_CAP), and queue.add does not queue the same ask for the same target twice inside
 * QUEUE_DEDUPE_MS. A leaked or looping hook secret costs at most a day's cap, not the build queue.
 */
import { validate, steps, matches, due, RUN_CAP_DAY, QUEUE_DEDUPE_MS, MAX_EVENT } from './automations.js';
import { sameSecret } from './guard.js';

export const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_automations (id TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL, rule TEXT NOT NULL, hook TEXT, created TEXT NOT NULL, updated TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_automation_runs (id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, at TEXT NOT NULL, trigger TEXT NOT NULL, ok INTEGER NOT NULL, log TEXT NOT NULL)',
];
export const KEEP_RUNS = 200;
const now = () => new Date().toISOString();
const dayAgo = (at) => new Date(Date.parse(at) - 864e5).toISOString();
const runCap = (env) => { const n = Number(env && env.AUTOMATION_RUN_CAP); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100000) : RUN_CAP_DAY; };
/** runs of this rule since this time yesterday. Every run row is one that actually ran: a refused, unmatched or too-big
 * event writes none, so the cap counts the runs that could spend something, not the knocks that failed to match. */
async function runsToday(env, ruleId, at = now()) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_automation_runs WHERE rule_id = ? AND at >= ?').bind(String(ruleId), dayAgo(at)).first();
  return (row && Number(row.n)) || 0;
}
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('void-hook:' + s)));
const newSecret = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const slugId = (name) => (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'rule') + '-' + Date.now().toString(36).slice(-5);

export async function ensure(env) { for (const t of TABLES) await env.DB.prepare(t).run(); }

export async function list(env) {
  await ensure(env);
  const rules = (await env.DB.prepare('SELECT id, name, enabled, rule, hook, created, updated FROM void_automations ORDER BY created').all()).results || [];
  const runs = (await env.DB.prepare('SELECT id, rule_id, at, trigger, ok, log FROM void_automation_runs ORDER BY at DESC LIMIT 30').all()).results || [];
  return {
    rules: rules.map((r) => ({ ...JSON.parse(r.rule), id: r.id, enabled: !!r.enabled, hasHook: !!r.hook, created: r.created, updated: r.updated })),
    runs: runs.map((r) => ({ id: r.id, rule: r.rule_id, at: r.at, trigger: r.trigger, ok: !!r.ok, log: JSON.parse(r.log) })),
  };
}
export async function get(env, id) {
  await ensure(env);
  const r = await env.DB.prepare('SELECT id, enabled, rule, hook FROM void_automations WHERE id = ?').bind(String(id)).first();
  return r ? { rule: { ...JSON.parse(r.rule), id: r.id, enabled: !!r.enabled }, hook: r.hook } : null;
}

/** make or replace a rule; a new webhook rule (or rotate: true) gets a fresh secret, returned once */
export async function save(env, input, { rotate = false } = {}) {
  const v = validate(input, env);
  if (!v.ok) return { ok: false, errors: v.errors };
  await ensure(env);
  const rule = v.rule, id = rule.id || slugId(rule.name), at = now();
  const old = await env.DB.prepare('SELECT hook, created FROM void_automations WHERE id = ?').bind(id).first();
  let hook = old ? old.hook : null, secret = null;
  if (rule.when.on === 'webhook' && (!hook || rotate)) { secret = newSecret(); hook = await sha(secret); }
  if (rule.when.on !== 'webhook') hook = null;
  const body = JSON.stringify({ ...rule, id: undefined, enabled: undefined });
  await env.DB.prepare('INSERT INTO void_automations (id, name, enabled, rule, hook, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, enabled = excluded.enabled, rule = excluded.rule, hook = excluded.hook, updated = excluded.updated')
    .bind(id, rule.name, rule.enabled ? 1 : 0, body, hook, old ? old.created : at, at).run();
  return { ok: true, rule: { ...rule, id }, ...(secret ? { hookSecret: secret, hookUrl: '/api/hook/' + id } : {}) };
}
export async function setEnabled(env, id, enabled) {
  await ensure(env);
  const r = await env.DB.prepare('UPDATE void_automations SET enabled = ?, updated = ? WHERE id = ?').bind(enabled ? 1 : 0, now(), String(id)).run();
  return !!(r && r.meta && r.meta.changes);
}
export async function remove(env, id) {
  await ensure(env);
  const r = await env.DB.prepare('DELETE FROM void_automations WHERE id = ?').bind(String(id)).run();
  return !!(r && r.meta && r.meta.changes);
}
/** is this the rule's webhook secret? constant time, and false for a rule with no hook */
export async function hookOk(stored, given) { return !!stored && typeof given === 'string' && !!given && sameSecret(await sha(given), stored); }

// ---- the actions ----
const GH = 'https://api.github.com';
async function gh(env, fetcher, method, path, body) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set in the Pages project, so Void cannot reach GitHub');
  const r = await fetcher(GH + path, { method, headers: { authorization: 'Bearer ' + env.GITHUB_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'void-automations', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, data };
}
const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const enc = encodeURIComponent;
const pathEnc = (p) => p.split('/').map(enc).join('/');

export async function act(env, step, { fetcher = fetch } = {}) {
  if (step.error) throw new Error(step.error);
  if (step.action === 'note') return step.text;
  if (step.action === 'queue.add') {
    const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target = ? AND state IN ('queued','building') LIMIT 1").bind(step.target).first();
    if (open) return 'a job for ' + step.target + ' is already open (' + open.id + ')';
    // the same ask for the same target finished not long ago: a replayed or looping event does not queue it again
    const recent = await env.DB.prepare('SELECT id FROM void_queue WHERE target = ? AND lower(trim(ask)) = ? AND updated >= ? ORDER BY updated DESC LIMIT 1').bind(step.target, step.ask.trim().toLowerCase(), new Date(Date.parse(now()) - QUEUE_DEDUPE_MS).toISOString()).first();
    if (recent) return 'the same ask for ' + step.target + ' ran not long ago (' + recent.id + ')';
    const id = Date.now().toString(36), at = now();
    await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, step.ask, step.target, 'queued', 'from an automation', at, at).run();
    return 'queued ' + id;
  }
  if (step.action === 'github.comment') {
    const r = await gh(env, fetcher, 'POST', '/repos/' + step.repo + '/issues/' + step.issue + '/comments', { body: step.body });
    if (!r.ok) throw new Error('GitHub said ' + r.status + ' to the comment');
    return 'commented on #' + step.issue + (r.data && r.data.html_url ? ' ' + r.data.html_url : '');
  }
  if (step.action === 'github.pr') {
    const repo = '/repos/' + step.repo;
    const base = await gh(env, fetcher, 'GET', repo + '/git/ref/heads/' + pathEnc(step.base));
    if (!base.ok) throw new Error('no base branch ' + step.base + ' (' + base.status + ')');
    const made = await gh(env, fetcher, 'POST', repo + '/git/refs', { ref: 'refs/heads/' + step.branch, sha: base.data.object.sha });
    if (!made.ok && made.status !== 422) throw new Error('could not make branch ' + step.branch + ' (' + made.status + ')');
    for (const f of step.files) {
      const cur = await gh(env, fetcher, 'GET', repo + '/contents/' + pathEnc(f.path) + '?ref=' + enc(step.branch));
      const put = await gh(env, fetcher, 'PUT', repo + '/contents/' + pathEnc(f.path), { message: step.title, content: b64(f.content), branch: step.branch, ...(cur.ok && cur.data && cur.data.sha ? { sha: cur.data.sha } : {}) });
      if (!put.ok) throw new Error('could not write ' + f.path + ' (' + put.status + ')');
    }
    const pr = await gh(env, fetcher, 'POST', repo + '/pulls', { title: step.title, head: step.branch, base: step.base, body: step.body || 'Opened by a Void automation.', draft: true });
    if (pr.ok) return 'opened ' + pr.data.html_url;
    if (pr.status === 422) { const open = await gh(env, fetcher, 'GET', repo + '/pulls?state=open&head=' + enc(step.repo.split('/')[0] + ':' + step.branch)); if (open.ok && open.data && open.data[0]) return 'updated ' + open.data[0].html_url; }
    throw new Error('could not open the pull request (' + pr.status + ')');
  }
  if (step.action === 'http.post') {
    const r = await fetcher(step.url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'void-automations' }, body: JSON.stringify({ text: step.body }), redirect: 'manual' });
    if (r.status >= 300) throw new Error(step.url + ' answered ' + r.status);
    return step.url + ' answered ' + r.status;
  }
  throw new Error('unknown action ' + step.action);
}

/** run one rule for one event: every step in order, the first failure stops the rest; the run is logged either way */
export async function run(env, rule, event, trigger, opts = {}) {
  const ev = event && typeof event === 'object' ? event : {};
  if (JSON.stringify(ev).length > MAX_EVENT) return { ok: false, skipped: 'the event is too big' };
  if (!rule.enabled && trigger !== 'manual') return { ok: false, skipped: 'the rule is switched off' };
  if (trigger === 'webhook' && (await runsToday(env, rule.id)) >= runCap(env)) return { ok: false, skipped: 'this rule has run its ' + runCap(env) + ' times a day from webhooks' };
  if (!matches(rule, ev)) return { ok: true, skipped: 'the event does not match' };
  const log = []; let ok = true;
  for (const s of steps(rule, ev)) {
    try { log.push({ action: s.action, ok: true, said: String(await act(env, s, opts)).slice(0, 300) }); }
    catch (e) { ok = false; log.push({ action: s.action, ok: false, said: String((e && e.message) || e).slice(0, 300) }); break; }
  }
  await ensure(env);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await env.DB.prepare('INSERT INTO void_automation_runs (id, rule_id, at, trigger, ok, log) VALUES (?, ?, ?, ?, ?, ?)').bind(id, rule.id, now(), trigger, ok ? 1 : 0, JSON.stringify(log)).run();
  await env.DB.prepare('DELETE FROM void_automation_runs WHERE id NOT IN (SELECT id FROM void_automation_runs ORDER BY at DESC LIMIT ?)').bind(KEEP_RUNS).run();
  return { ok, log };
}

/** the clock: run every scheduled rule that is due, one after another; the event is { tick: true, at }. Returns what ran. */
export async function tick(env, now = Date.now(), opts = {}) {
  await ensure(env);
  const rows = (await env.DB.prepare("SELECT id, enabled, rule FROM void_automations WHERE enabled = 1").all()).results || [];
  const last = (await env.DB.prepare('SELECT rule_id, MAX(at) AS at FROM void_automation_runs GROUP BY rule_id').all()).results || [];
  const lastOf = Object.fromEntries(last.map((r) => [r.rule_id, r.at]));
  const at = new Date(now).toISOString(), ran = [];
  for (const r of rows) {
    const rule = { ...JSON.parse(r.rule), id: r.id, enabled: !!r.enabled };
    if (!due(rule, lastOf[r.id] || null, now)) continue;
    const out = await run(env, rule, { tick: true, at }, 'schedule', opts);
    ran.push({ id: r.id, ok: out.ok, ...(out.skipped ? { skipped: out.skipped } : {}) });
  }
  return { at, checked: rows.length, ran };
}
