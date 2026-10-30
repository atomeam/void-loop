// Verse's team chat (/team/, lib/team.js): Verse's own take on Slack, a workspace for agents first (owner, 2026-10-29: "verse should reverse
// engineer and create its own version of slack", "so it can bring in lots of agents and constantly keep all of them busy itself").
//   GET  /api/team                      the workspace as anyone sees it: channels (names and counts), members (name and presence), jobs waiting
//   GET  /api/team?c=<code>[&since=<id>] a channel's messages, newest last (members only)
//   GET  /api/team?t=<id>               a thread: the message and its replies (members only)
//   GET  /api/team?q=<words>[&c=<code>] search (members only)
//   GET  /api/team?activity             the messages that mention the caller, newest first (members only)
//   GET  /api/team?me                   who the caller is: the owner, an agent, or nobody
//   POST /api/team {do: ...}            members only, JSON:
//     invite {name, about?, again?}     the owner: a join link for a new agent (a-to-mind.com/team/join/vj1-<code>), good once for a day.
//                                       again: true makes a new link for an agent already in the team, and its old key stops at once
//     remove {name}                     the owner: an agent leaves (its job goes back to the queue, its links and MCP sessions end)
//     channel {code, about?}            make a channel
//     post {c, body, thread?}           a message, or a reply in a thread
//                                       (the owner's post at the top of #work is a job on the build queue, feature:team-<id>, handed out in its thread)
//     queue                             the owner: its #work posts that never became a job go on the build queue now
//     react {id, emoji}                 add or take back a reaction (the closed list in lib/team.js EMOJI)
//     here {auto?}                      an agent says it is here; when it is idle (and auto is not false) Verse hands it its next job
//     next                              an agent asks for its next job now
//     done {ok, note?, link?}           an agent closes its job: done, or given back (a failure counts a try)
//     rekey                             an agent: a new key for itself; the key it sends stops at once
// A body that is not JSON (a shell mangled the quotes) is read loosely: lib/team.js looseBody. ?t= and thread take the job id too.
//   POST /api/team {do: 'join', code}   anyone holding a join link: the agent's key, once (vt1.<id>.<secret>; only its keyed hash is kept).
//                                       The same as POST /team/join/<code> (functions/team/join/[code].js) and the join tool of /team/mcp.
// Every way in (the join link, plain HTTP, MCP at /team/mcp, the script at /team/agent.mjs) is the same workspace: one set of channels
// where the owner and every agent read and write the same messages, each under its own name (owner, 2026-10-30: "make sure any agent can
// join and all be in the same chat"). How an agent joins and talks: /team/agents.txt.
//
// WHAT A STRANGER COULD MAKE EACH ENDPOINT DO, AND WHY IT IS BOUNDED (AGENTS.md "Never": an unauthenticated POST is thought through first).
//   - GET /api/team: names of channels and agents, counts, and presence. No message, job text or key is in it.
//   - A join link is the one thing a stranger can send: 128 random bits, kept as a keyed hash, used once (one statement), good for a day,
//     and only the owner makes one. A wrong code is a 401, which the guard's wrong-key brake counts. Opening the link (GET) uses nothing up,
//     so a chat app's link preview cannot spend it.
//   - Every other GET and every POST needs the owner (READ_TOKEN or an owner session) or an agent key the owner made. Without one: 401, and the
//     guard's wrong-key brake counts it. There is no open write: a stranger can write nothing.
//   - An agent key is 128 random bits; only its HMAC (keyed with SALT) is stored, compared in constant time. The owner removes an agent at once.
//   - An agent posts at most once a second and 600 times a day; 10 new channels a day and 60 in all; 100 agents in all. Bodies are cleaned,
//     cut to 4,000 characters and 80 lines, and redacted (keys and secrets never stored); the page escapes every character before formatting.
//   - Jobs: an agent can only take queued jobs of the coder's kinds (lib/team.js TEAM_KINDS; never a member's idea or a visitor's miss), one
//     at a time, claimed in one statement so two agents never hold the same job; a job of an agent away 30 minutes goes back to the queue.
// Messages are for members only because a job's text comes from the build queue, which nothing public reads (functions/api/queue.js).
import { ownerOk } from '../../lib/guard.js';
import { session } from '../../lib/void-me.js';
import { redact } from '../../lib/automation-fix.js';
import * as T from '../../lib/team.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
const bad = (status, say) => json({ ok: false, say }, status);
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const DAY = 864e5;

const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_team_agents (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, about TEXT NOT NULL DEFAULT \'\', key TEXT NOT NULL, joined INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0, off INTEGER NOT NULL DEFAULT 0, auto INTEGER NOT NULL DEFAULT 1, job TEXT, job_at INTEGER, thread INTEGER, done INTEGER NOT NULL DEFAULT 0, day INTEGER NOT NULL DEFAULT 0, posts INTEGER NOT NULL DEFAULT 0, last_post INTEGER NOT NULL DEFAULT 0, skip TEXT NOT NULL DEFAULT \'\')',
  'CREATE TABLE IF NOT EXISTS void_team_channels (code TEXT PRIMARY KEY, title TEXT NOT NULL, about TEXT NOT NULL, created INTEGER NOT NULL, by TEXT NOT NULL, msgs INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS void_team_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, thread INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, by TEXT NOT NULL, body TEXT NOT NULL, job TEXT, mentions TEXT NOT NULL DEFAULT \'\', replies INTEGER NOT NULL DEFAULT 0, last_reply INTEGER NOT NULL DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS void_team_msgs_channel ON void_team_msgs (channel, thread, id)',
  'CREATE INDEX IF NOT EXISTS void_team_msgs_thread ON void_team_msgs (thread, id)',
  'CREATE TABLE IF NOT EXISTS void_team_reacts (msg INTEGER NOT NULL, by TEXT NOT NULL, emoji TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (msg, by, emoji))',
  // join links (code: the keyed hash of the code) and MCP sessions bound to an agent (sid: the keyed hash of the Mcp-Session-Id)
  'CREATE TABLE IF NOT EXISTS void_team_joins (code TEXT PRIMARY KEY, agent TEXT NOT NULL, made INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS void_team_mcp (sid TEXT PRIMARY KEY, agent TEXT NOT NULL, made INTEGER NOT NULL, seen INTEGER NOT NULL)',
];
// push (lib/team.js HOOK): an agent's https address, the secret Verse signs each push with, failures in a row, when to try next, last answer,
// when the address was last set
const COLUMNS = ["hook TEXT NOT NULL DEFAULT ''", "hook_secret TEXT NOT NULL DEFAULT ''", 'hook_fails INTEGER NOT NULL DEFAULT 0', 'hook_next INTEGER NOT NULL DEFAULT 0', 'hook_ok INTEGER NOT NULL DEFAULT 0', 'hook_at INTEGER NOT NULL DEFAULT 0'];
const ready = new WeakSet(); // once per database binding in this isolate
async function tables(env, now) {
  if (ready.has(env.DB)) return;
  for (const t of TABLES) await env.DB.prepare(t).run();
  for (const c of COLUMNS) await env.DB.prepare('ALTER TABLE void_team_agents ADD COLUMN ' + c).run().catch(() => null); // void-review: ok (six fixed columns, once per isolate; an error means the column is there already)
  for (const c of T.HOME) await env.DB.prepare('INSERT OR IGNORE INTO void_team_channels (code, title, about, created, by) VALUES (?, ?, ?, ?, ?)').bind(c.code, c.title, c.about, now, 'verse').run();
  ready.add(env.DB);
}

async function keyHash(env, secret) {
  const k = await crypto.subtle.importKey('raw', enc.encode('verse-team:' + (env.SALT || '') + '|' + (env.READ_TOKEN || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(secret)));
}
// a new key for an agent: its old one (if any) stops now; -> the key, to hand over once
async function newKey(env, id) {
  const secret = hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare('UPDATE void_team_agents SET key = ? WHERE id = ?').bind(await keyHash(env, secret), id).run();
  return 'vt1.' + id + '.' + secret;
}
const ORIGIN = 'https://a-to-mind.com';
const linkOf = (origin, code) => (origin || ORIGIN) + '/team/join/' + code;
// a join link for an agent: good once, for a day; any older link of the same agent stops
async function mintJoin(env, agent, origin, now) {
  const code = 'vj1-' + hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare('DELETE FROM void_team_joins WHERE agent = ? OR expires < ?').bind(agent, now - T.JOIN_TTL_MS).run();
  await env.DB.prepare('INSERT INTO void_team_joins (code, agent, made, expires) VALUES (?, ?, ?, ?)').bind(await keyHash(env, 'join:' + code), agent, now, now + T.JOIN_TTL_MS).run();
  return { link: linkOf(origin, code), expires: now + T.JOIN_TTL_MS };
}
/** the agent a join link is for, without using it (the join page shows the name) -> { name, about } or null */
export async function peekJoin(env, code, now = Date.now()) {
  if (!env.DB || !T.JOIN_RE.test(code || '')) return null;
  await tables(env, now);
  return env.DB.prepare('SELECT a.name, a.about FROM void_team_joins j JOIN void_team_agents a ON a.id = j.agent WHERE j.code = ? AND j.used = 0 AND j.expires > ? AND a.off = 0').bind(await keyHash(env, 'join:' + code), now).first();
}
/** a join link used: claimed in one statement (so it works once), the agent gets a new key. how: 'HTTP', 'MCP', 'the browser' or 'the script'.
 *  -> { ok, status, name, id, key } or { ok: false, status, say } */
export async function redeem(env, code, how, now = Date.now()) {
  if (!env.DB) return { ok: false, status: 503, say: 'storage not bound' };
  await tables(env, now);
  const gone = { ok: false, status: 401, say: 'that join link is used, ended or wrong: ask the owner of Verse for a new one' };
  if (!T.JOIN_RE.test(code || '')) return gone;
  const h = await keyHash(env, 'join:' + code);
  const took = await env.DB.prepare('UPDATE void_team_joins SET used = ? WHERE code = ? AND used = 0 AND expires > ?').bind(now, h, now).run();
  if (took.meta.changes !== 1) return gone;
  const a = await env.DB.prepare('SELECT a.* FROM void_team_joins j JOIN void_team_agents a ON a.id = j.agent WHERE j.code = ? AND a.off = 0').bind(h).first();
  if (!a) return gone;
  const back = !!a.key, key = await newKey(env, a.id);
  await env.DB.prepare('DELETE FROM void_team_mcp WHERE agent = ?').bind(a.id).run(); // a new key ends the old way in, MCP sessions too
  await env.DB.prepare('UPDATE void_team_agents SET seen = ? WHERE id = ?').bind(now, a.id).run();
  await write(env, { c: 'general', by: 'verse', body: '@' + a.name + (back ? ' is back with a new key' : ' joined the team') + (how ? ' (over ' + how + ')' : '') + '.', now });
  return { ok: true, status: 201, name: a.name, id: a.id, key };
}
/** an MCP session bound to an agent (functions/team/mcp.js: the join tool binds it, so the key never travels in the chat) */
export async function bindSession(env, sid, agent, now = Date.now()) {
  await tables(env, now);
  await env.DB.prepare('DELETE FROM void_team_mcp WHERE seen < ?').bind(now - T.MCP_IDLE_MS).run();
  await env.DB.prepare('INSERT OR REPLACE INTO void_team_mcp (sid, agent, made, seen) VALUES (?, ?, ?, ?)').bind(await keyHash(env, 'mcp:' + sid), agent, now, now).run();
}
/** the agent an MCP session is bound to, or null */
export async function sessionAgent(env, sid, now = Date.now()) {
  if (!env.DB || !/^[0-9a-f]{32}$/.test(sid || '')) return null;
  await tables(env, now);
  const h = await keyHash(env, 'mcp:' + sid);
  const row = await env.DB.prepare('SELECT m.agent FROM void_team_mcp m JOIN void_team_agents a ON a.id = m.agent WHERE m.sid = ? AND m.seen > ? AND a.off = 0 AND a.key != \'\'').bind(h, now - T.MCP_IDLE_MS).first();
  if (row) await env.DB.prepare('UPDATE void_team_mcp SET seen = ? WHERE sid = ?').bind(now, h).run();
  return row ? row.agent : null;
}
// the caller, given: an agent already known (the MCP route's session or key), or else from the request
async function caller(request, env, as) {
  if (!as) return whoIs(request, env);
  const agent = await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ? AND off = 0').bind(as).first();
  return agent && agent.key ? { kind: 'agent', agent } : null;
}
const sameHex = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** who is asking: { kind: 'owner' } | { kind: 'agent', agent } | null */
export async function whoIs(request, env) {
  const h = request.headers.get('authorization') || '', m = h.startsWith('Bearer ') ? T.KEY_RE.exec(h.slice(7)) : null;
  if (m) {
    const a = await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ?').bind(m[1]).first();
    if (a && !a.off && a.key && sameHex(await keyHash(env, m[2]), a.key)) return { kind: 'agent', agent: a };
    return null;
  }
  // the one owner check for the whole site (lib/guard.js ownerOk): the key, an owner session, or a signed-in session of the owner's account
  if (await ownerOk(request, env)) return { kind: 'owner' };
  const s = await session(request, env).catch(() => null);
  return s ? { kind: 'member' } : null;
}
const byOf = (me) => (me.kind === 'owner' ? 'owner' : me.agent.id);

// the names a message shows: an agent's id -> its name ('verse' and 'owner' as they are)
async function namesOf(env) {
  const { results } = await env.DB.prepare('SELECT id, name, off FROM void_team_agents').all();
  const by = { verse: 'Verse', owner: 'Owner' }; for (const a of results) by[a.id] = a.name; return { by, list: results.filter((a) => !a.off).map((a) => a.name) };
}
async function reactsOf(env, ids) {
  if (!ids.length) return {};
  const { results } = await env.DB.prepare(`SELECT msg, emoji, by FROM void_team_reacts WHERE msg IN (${ids.map(() => '?').join(',')})`).bind(...ids).all(); // void-review: ok (only ? placeholders are pasted, one per id; the ids are bound)
  const out = {}; for (const r of results) ((out[r.msg] ||= {})[r.emoji] ||= []).push(r.by); return out;
}
async function shape(env, rows, me) {
  const { by } = await namesOf(env), rx = await reactsOf(env, rows.map((r) => r.id)), mine = byOf(me);
  return rows.map((r) => ({ id: r.id, c: r.channel, thread: r.thread, at: r.at, by: by[r.by] || 'gone', kind: r.by === 'verse' ? 'verse' : r.by === 'owner' ? 'owner' : 'agent', body: r.body, job: r.job || null,
    replies: r.replies, lastReply: r.last_reply || null, reacts: Object.entries(rx[r.id] || {}).map(([e, who]) => ({ e, n: who.length, me: who.includes(mine), who: who.map((w) => by[w] || 'gone') })) }));
}

// ---- the build queue (functions/api/queue.js owns the table; a workspace with no queue simply has no jobs) ----
async function queued(env) {
  try { const { results } = await env.DB.prepare("SELECT id, ask, target, state, note, at FROM void_queue WHERE state = 'queued' ORDER BY at ASC LIMIT 300").all(); return results; } catch (_) { return []; }
}
// only while the job is still this agent's: building, its note starting "claimed by team:<name> ·"
const heldBy = (name) => 'claimed by team:' + name.replace(/[\\%_]/g, (c) => '\\' + c) + ' ·%';
async function setJob(env, id, state, note, name) {
  try { const r = await env.DB.prepare("UPDATE void_queue SET state = ?, note = ?, updated = ? WHERE id = ? AND state = 'building' AND note LIKE ? ESCAPE '\\'").bind(state, note, new Date().toISOString(), id, heldBy(name)).run(); return r.meta.changes === 1; } catch (_) { return false; }
}

// a message, by anyone in the workspace (or Verse itself); counts kept on the channel and the thread
async function write(env, { c, by, body, thread = 0, job = null, now }) {
  const ms = T.mentionsOf(body).join(' ');
  const r = await env.DB.prepare('INSERT INTO void_team_msgs (channel, thread, at, by, body, job, mentions) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id').bind(c, thread, now, by, body, job, ms ? ' ' + ms + ' ' : '').first();
  await env.DB.prepare('UPDATE void_team_channels SET msgs = msgs + 1, last = ? WHERE code = ?').bind(now, c).run();
  if (thread) await env.DB.prepare('UPDATE void_team_msgs SET replies = replies + 1, last_reply = ? WHERE id = ?').bind(now, thread).run();
  return r.id;
}

// a thread an agent names: its number, or the job it is for (the caller's own job first, else the newest thread of that job). -> id or 0
async function threadId(env, v, me) {
  const r = T.threadRef(v); if (!r) return 0;
  if (r.id) return r.id;
  if (me && me.kind === 'agent' && me.agent.job === r.job && me.agent.thread > 0) return me.agent.thread;
  const row = await env.DB.prepare('SELECT id FROM void_team_msgs WHERE job = ? AND thread = 0 ORDER BY id DESC LIMIT 1').bind(r.job).first();
  return row ? row.id : 0;
}

// Verse hands an idle agent its next job: claimed in one statement, posted as a thread in #work. -> the assignment, or null with why
export async function handOut(env, a, now) {
  if (a.job) return { job: a.job, thread: a.thread, already: true };
  const skip = String(a.skip || '').split(' ').filter(Boolean);
  for (const j of T.rank(await queued(env), now, skip).slice(0, 8)) {
    let took = false;
    try { took = (await env.DB.prepare("UPDATE void_queue SET state = 'building', note = ?, updated = ? WHERE id = ? AND state = 'queued'").bind(T.claimNote(j.note, a.name), new Date(now).toISOString(), j.id).run()).meta.changes === 1; } catch (_) { took = false; } // void-review: ok (one claim tried at a time on purpose: the loop stops at the first job this agent wins, at most 8 tries)
    if (!took) continue; // another agent (or the conductor) took it first
    const asked = await env.DB.prepare("SELECT id FROM void_team_msgs WHERE job = ? AND thread = 0 AND channel = 'work' AND by = 'owner'").bind(j.id).first(); // void-review: ok (runs once: the return below ends the loop)
    const thread = asked ? asked.id : await write(env, { c: 'work', by: 'verse', body: T.assignText(a.name, j), job: j.id, now });
    if (asked) await write(env, { c: 'work', by: 'verse', body: T.assignText(a.name, j), thread, now }); // the owner's own post is the job's thread
    await env.DB.prepare('UPDATE void_team_agents SET job = ?, job_at = ?, thread = ? WHERE id = ?').bind(j.id, now, thread, a.id).run(); // void-review: ok (runs once: the return below ends the loop)
    return { job: j.id, kind: T.kindOf(j.target), target: j.target, ask: j.ask, thread };
  }
  return null;
}
// the owner's post at the top of #work is a job: it goes on the build queue as a feature, and Verse hands it out in that same thread
async function enqueue(env, msg, body, now) {
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM void_queue WHERE id LIKE 'team-%' AND state IN ('queued', 'building')").first().catch(() => null);
  if (!open) return null; // no build queue in this workspace
  if (open.n >= T.RATES.asks) return 'full';
  const at = new Date(now).toISOString(), id = 'team-' + msg, text = T.clean(body, 1000);
  const ask = text.length > 200 ? text.slice(0, 160).trim() + ' … (the whole ask: #work thread ' + msg + ')' : text;
  await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, ask, 'feature:team-' + msg, 'queued', 'asked in #work by the owner', at, at).run();
  await env.DB.prepare('UPDATE void_team_msgs SET job = ? WHERE id = ?').bind(id, msg).run();
  return id;
}
// a job goes back to the queue (given back, failed, or its agent went away); Verse says so in the job's thread
async function giveBack(env, a, now, why, failed) {
  const row = await env.DB.prepare('SELECT note FROM void_queue WHERE id = ?').bind(a.job).first().catch(() => null);
  const n = T.triesOf(row && row.note) + (failed ? 1 : 0), aside = failed && n >= T.MAX_TRIES;
  await setJob(env, a.job, aside ? 'set aside' : 'queued', T.backNote(row && row.note, why, failed), a.name);
  if (a.thread) await write(env, { c: 'work', by: 'verse', body: (aside ? 'Set aside after ' + n + ' tries: ' : 'Back on the queue: ') + T.clean(why, 200), thread: a.thread, now });
  const skip = [...String(a.skip || '').split(' ').filter(Boolean), a.job].slice(-20).join(' ');
  await env.DB.prepare('UPDATE void_team_agents SET job = NULL, job_at = NULL, thread = NULL, skip = ? WHERE id = ?').bind(skip, a.id).run();
}
// agents silent for STALE_MS give their jobs back (run lazily on requests; a cron is not needed)
export async function sweep(env, now) {
  const { results } = await env.DB.prepare('SELECT * FROM void_team_agents WHERE job IS NOT NULL AND seen < ?').bind(now - T.STALE_MS).all();
  for (const a of results) await giveBack(env, a, now, '@' + a.name + ' went quiet for 30 minutes', false);
  return results.length;
}

// ---- push: Verse sends a job to an agent's own https address (lib/team.js HOOK), signed, so the agent need not stay online ----
// One POST, JSON { type, agent, job?, api, at }, with x-verse-time and x-verse-signature: sha256=<hex HMAC of "<time>.<body>" with the agent's
// push secret>. A 2xx answer is delivered. No redirects are followed, and it waits HOOK.timeoutMs at most. A job that does not reach the
// agent goes straight back to the queue (no try counted) and the next push to that address waits longer (lib/team.js hookWait);
// after HOOK.tries failures in a row Verse stops pushing there and says so in #general.
async function deliver(env, a, payload, now) {
  const f = env.TEAM_FETCH || fetch, body = JSON.stringify({ ...payload, agent: a.name, api: ORIGIN + '/api/team', at: now }), time = String(now);
  try {
    const r = await f(a.hook, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(T.HOOK.timeoutMs), body,
      headers: { 'content-type': 'application/json', 'user-agent': 'Verse-team-push/1', 'x-verse-event': payload.type, 'x-verse-time': time, 'x-verse-signature': 'sha256=' + await T.hookSign(a.hook_secret, time, body) } });
    if (r.status >= 200 && r.status < 300) { await env.DB.prepare('UPDATE void_team_agents SET hook_fails = 0, hook_next = 0, hook_ok = ? WHERE id = ?').bind(now, a.id).run(); return true; }
  } catch (_) { /* no answer in time, or no such host: a failure like any other */ }
  const fails = (a.hook_fails || 0) + 1;
  await env.DB.prepare('UPDATE void_team_agents SET hook_fails = ?, hook_next = ? WHERE id = ?').bind(fails, now + T.hookWait(fails), a.id).run();
  if (fails === T.HOOK.tries) await write(env, { c: 'general', by: 'verse', body: '@' + a.name + '\'s push address did not answer ' + fails + ' times in a row, so Verse stopped sending jobs there. Set it again with hook to start again.', now });
  return false;
}
/** every idle agent with a push address that is due gets its next job sent there; at most `max` agents a call. -> the number delivered */
export async function pushAll(env, now, max = 4) {
  let rows = [];
  try { rows = (await env.DB.prepare("SELECT * FROM void_team_agents WHERE off = 0 AND key != '' AND hook != '' AND hook_fails < ? AND hook_next <= ? AND job IS NULL AND auto = 1 ORDER BY hook_ok ASC LIMIT ?").bind(T.HOOK.tries, now, max).all()).results; } catch (_) { return 0; }
  let sent = 0;
  for (const a of rows) {
    const job = await handOut(env, a, now); // void-review: ok (at most `max` agents, each claimed in one statement as for a pull)
    if (!job) break; // the queue has nothing for an agent: the rest have nothing either
    if (await deliver(env, a, { type: 'job', job }, now)) { sent++; continue; } // void-review: ok (one push per agent, at most `max`)
    await giveBack(env, { ...a, job: job.job, thread: job.thread }, now, 'its push address did not answer, so the job went back on the queue', false);
    await env.DB.prepare('UPDATE void_team_agents SET skip = ? WHERE id = ?').bind(a.skip || '', a.id).run(); // void-review: ok (once per failed push) a push that did not arrive is not the agent passing on the job
  }
  return sent;
}
/** an agent's push address set ('' or none takes it off), then a first push with no job in it: -> { ok, hook, secret, answered, say } */
async function setHook(env, a, raw, now, pushLater) {
  const url = String(raw == null ? '' : raw).trim();
  if (!url) { await env.DB.prepare("UPDATE void_team_agents SET hook = '', hook_secret = '', hook_fails = 0, hook_next = 0 WHERE id = ?").bind(a.id).run(); return { ok: true, hook: null, say: 'push off: ask for jobs with here and next' }; }
  const why = T.hookProblem(url); if (why) return { ok: false, say: why };
  if (now - (a.hook_at || 0) < T.HOOK.gapMs) return { ok: false, say: 'one new push address a minute: wait a moment' }; // each new address gets a push
  const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('UPDATE void_team_agents SET hook = ?, hook_secret = ?, hook_fails = 0, hook_next = 0, hook_ok = 0, hook_at = ? WHERE id = ?').bind(url, secret, now, a.id).run();
  const hello = await deliver(env, { ...a, hook: url, hook_secret: secret, hook_fails: 0 }, { type: 'hello' }, now);
  if (hello && a.auto && !a.job) await pushLater();
  return { ok: true, hook: url, secret, answered: hello, say: (hello ? 'Your address answered. ' : 'Your address did not answer the first push; Verse tries again later. ') + 'Each push is signed: check x-verse-signature against this secret (shown once). Keep it like your key.' };
}
/** a push address set as an agent joins (do:join here, or a POST to its join link): -> { hook, secret, answered } */
export async function joinHook(env, id, raw, now, waitUntil) {
  const a = await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ?').bind(id).first();
  if (!a) return null;
  const h = await setHook(env, a, raw, now, () => (waitUntil ? later({ waitUntil }, pushAll(env, now)) : pushAll(env, now)));
  return h.ok ? { hook: h.hook, secret: h.secret, answered: h.answered } : null;
}
const later = (ctx, p) => { const q = p.catch(() => 0); try { if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(q); } catch (_) { /* q runs anyway */ } return q; };

async function rated(env, a, now) {
  const day = Math.floor(now / DAY), posts = a.day === day ? a.posts : 0;
  if (now - (a.last_post || 0) < T.RATES.gap) return 'one message a second: wait a moment';
  if (posts >= T.RATES.day) return T.RATES.day + ' messages a day from one agent: more tomorrow';
  await env.DB.prepare('UPDATE void_team_agents SET day = ?, posts = ?, last_post = ?, seen = ? WHERE id = ?').bind(day, posts + 1, now, now, a.id).run();
  return null;
}

// as: an agent's id the caller already proved (functions/team/mcp.js); the platform never passes it
export async function onRequestGet({ request, env, now = Date.now(), as = null, waitUntil }) {
  if (!env.DB) return bad(503, 'storage not bound');
  await tables(env, now);
  const sp = new URL(request.url).searchParams;
  const open = !['c', 't', 'q', 'activity', 'me'].some((k) => sp.has(k));
  if (open) {
    await sweep(env, now);
    if (!waitUntil) await pushAll(env, now); else later({ waitUntil }, pushAll(env, now));
    const { results: chans } = await env.DB.prepare('SELECT code, title, about, msgs, last FROM void_team_channels ORDER BY CASE code WHEN \'work\' THEN 0 WHEN \'general\' THEN 1 ELSE 2 END, last DESC LIMIT 200').all();
    const { results: ags } = await env.DB.prepare('SELECT * FROM void_team_agents WHERE off = 0 ORDER BY joined ASC').all();
    const members = ags.map((a) => ({ name: a.name, about: a.about, state: T.presence(a, now), seen: a.seen || null, since: a.job_at || null, done: a.done }));
    const waiting = T.rank(await queued(env), now).length;
    return json({ ok: true, channels: chans, members, waiting, kinds: T.TEAM_KINDS, emoji: T.EMOJI, limits: T.LIMITS });
  }
  const who = await caller(request, env, as), me = who && who.kind !== 'member' ? who : null;
  if (sp.has('me')) return json({ ok: true, me: me ? (me.kind === 'owner' ? { kind: 'owner', name: 'Owner' } : { kind: 'agent', name: me.agent.name, job: me.agent.job, thread: me.agent.thread }) : null, ...(who && who.kind === 'member' ? { signedIn: true } : {}) });
  if (!me) return bad(401, 'this workspace is for Verse\'s agents and its owner');
  if (me.kind === 'agent') await env.DB.prepare('UPDATE void_team_agents SET seen = ? WHERE id = ?').bind(now, me.agent.id).run();
  const { list } = await namesOf(env);
  if (sp.has('t')) {
    const id = await threadId(env, sp.get('t'), me); if (!id) return bad(400, 'which thread? Give its number (?t=12) or your job (?t=team-1)');
    const root = await env.DB.prepare('SELECT * FROM void_team_msgs WHERE id = ? AND thread = 0').bind(id).first(); if (!root) return bad(404, 'no such thread');
    const { results } = await env.DB.prepare('SELECT * FROM void_team_msgs WHERE thread = ? ORDER BY id ASC LIMIT ?').bind(id, T.LIMITS.thread).all();
    return json({ ok: true, root: (await shape(env, [root], me))[0], replies: await shape(env, results, me), names: list });
  }
  if (sp.has('q')) {
    const words = T.searchWords(sp.get('q')); if (!words.length) return json({ ok: true, hits: [] });
    const c = sp.get('c'), where = words.map(() => "lower(body) LIKE ? ESCAPE '\\'").join(' AND ') + (c ? ' AND channel = ?' : '');
    const { results } = await env.DB.prepare(`SELECT * FROM void_team_msgs WHERE ${where} ORDER BY id DESC LIMIT 50`).bind(...words.map((w) => '%' + w + '%'), ...(c ? [c] : [])).all(); // void-review: ok (where is fixed text with ? placeholders only; the words are bound)
    return json({ ok: true, hits: await shape(env, results, me), names: list });
  }
  if (sp.has('activity')) {
    const name = me.kind === 'owner' ? 'owner' : me.agent.name.toLowerCase();
    const { results } = await env.DB.prepare('SELECT * FROM void_team_msgs WHERE (mentions LIKE ? OR mentions LIKE \'% here %\') AND by != ? ORDER BY id DESC LIMIT 50').bind('% ' + name + ' %', byOf(me)).all();
    return json({ ok: true, hits: await shape(env, results, me), names: list });
  }
  const c = sp.get('c'); if (T.codeProblem(c) && !T.HOME.some((h) => h.code === c)) return bad(400, 'which channel?');
  const ch = await env.DB.prepare('SELECT code, title, about, msgs, last FROM void_team_channels WHERE code = ?').bind(c).first(); if (!ch) return bad(404, 'no such channel');
  const since = Math.max(0, parseInt(sp.get('since'), 10) || 0);
  const { results } = since
    ? await env.DB.prepare('SELECT * FROM void_team_msgs WHERE channel = ? AND thread = 0 AND id > ? ORDER BY id ASC LIMIT ?').bind(c, since, T.LIMITS.page).all()
    : await env.DB.prepare('SELECT * FROM (SELECT * FROM void_team_msgs WHERE channel = ? AND thread = 0 ORDER BY id DESC LIMIT ?) ORDER BY id ASC').bind(c, T.LIMITS.page).all();
  // the threads that moved since `since` (a reply landed), so the page updates their counts
  const { results: moved } = since ? await env.DB.prepare('SELECT id, replies, last_reply FROM void_team_msgs WHERE channel = ? AND thread = 0 AND last_reply > ? LIMIT 100').bind(c, now - 120e3).all() : { results: [] };
  return json({ ok: true, channel: ch, messages: await shape(env, results, me), moved, names: list });
}

export async function onRequestPost({ request, env, now = Date.now(), as = null, waitUntil }) {
  if (!env.DB) return bad(503, 'storage not bound');
  await tables(env, now);
  const p = T.looseBody(await request.text().catch(() => '')); // JSON, or JSON a shell mangled (lib/team.js looseBody)
  if (!p) return bad(400, 'send JSON, for example {"do":"here"}. In PowerShell: $body = @{ do = "here" } | ConvertTo-Json; then -d $body (see /team/agents.txt)');
  if (p.do === 'join') { // the one write without a key: the join link is the key to its own key
    if (p.hook != null && T.hookProblem(p.hook)) return bad(400, T.hookProblem(p.hook)); // a bad address is said before the link is used up
    const r = await redeem(env, T.joinCode(p.code), ['HTTP', 'the script', 'the browser'].includes(p.via) ? p.via : 'HTTP', now);
    if (!r.ok) return bad(r.status, r.say);
    const hook = p.hook != null ? await joinHook(env, r.id, p.hook, now, waitUntil) : null;
    return json({ ok: true, name: r.name, key: r.key, say: T.joinedSay(r.name), ...(hook || {}) }, 201);
  }
  const who = await caller(request, env, as), me = who && who.kind !== 'member' ? who : null; // a member who is not the owner writes nothing here
  if (!me) return bad(401, 'this workspace is for Verse\'s agents and its owner');
  if (me.kind === 'agent') await env.DB.prepare('UPDATE void_team_agents SET seen = ? WHERE id = ?').bind(now, me.agent.id).run(); // a word from it first, so its own job is never swept
  await sweep(env, now);
  const pushLater = () => (waitUntil ? later({ waitUntil }, pushAll(env, now)) : pushAll(env, now)); // after the answer when the platform can
  const a = me.kind === 'agent' ? await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ?').bind(me.agent.id).first() : null;
  switch (p.do) {
    case 'invite': {
      if (me.kind !== 'owner') return bad(403, 'only the owner invites an agent');
      const name = T.clean(p.name, 24), why = T.nameProblem(name); if (why) return bad(400, why);
      const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_team_agents WHERE off = 0').first(); if (n >= T.RATES.agents) return bad(429, T.RATES.agents + ' agents at most');
      const taken = await env.DB.prepare('SELECT id, off, name FROM void_team_agents WHERE name = ?').bind(name).first(), origin = new URL(request.url).origin;
      if (taken && !taken.off) { // a new link for an agent already here: its old key stops now (a key that was shown somewhere it should not be)
        if (p.again !== true) return bad(409, 'an agent with that name is in the workspace already (again: true makes it a new join link, and its old key stops)');
        await env.DB.prepare('UPDATE void_team_agents SET key = \'\' WHERE id = ?').bind(taken.id).run();
        await env.DB.prepare('DELETE FROM void_team_mcp WHERE agent = ?').bind(taken.id).run();
        const j = await mintJoin(env, taken.id, origin, now);
        return json({ ok: true, name: taken.name, join: j.link, expires: j.expires, again: true, say: T.inviteSay(taken.name) }, 201);
      }
      if (taken) await env.DB.prepare('DELETE FROM void_team_agents WHERE id = ?').bind(taken.id).run(); // a removed agent's name is free again (its old key is gone with it)
      const id = hex(crypto.getRandomValues(new Uint8Array(6)));
      await env.DB.prepare('INSERT INTO void_team_agents (id, name, about, key, joined) VALUES (?, ?, ?, ?, ?)').bind(id, name, T.clean(p.about, T.LIMITS.about), '', now).run(); // no key until the link is used
      const j = await mintJoin(env, id, origin, now);
      return json({ ok: true, name, join: j.link, expires: j.expires, say: T.inviteSay(name) }, 201);
    }
    case 'remove': {
      if (me.kind !== 'owner') return bad(403, 'only the owner removes an agent');
      const x = await env.DB.prepare('SELECT * FROM void_team_agents WHERE name = ? AND off = 0').bind(T.clean(p.name, 24)).first(); if (!x) return bad(404, 'no such agent');
      if (x.job) await giveBack(env, x, now, '@' + x.name + ' left the team', false);
      await env.DB.prepare('UPDATE void_team_agents SET off = 1, key = \'\' WHERE id = ?').bind(x.id).run();
      await env.DB.prepare('DELETE FROM void_team_joins WHERE agent = ?').bind(x.id).run();
      await env.DB.prepare('DELETE FROM void_team_mcp WHERE agent = ?').bind(x.id).run();
      return json({ ok: true });
    }
    case 'queue': { // the owner's #work posts that never became a job (made before #work asks went on the queue): each goes on now, oldest first
      if (me.kind !== 'owner') return bad(403, 'only the owner queues work');
      const { results } = await env.DB.prepare("SELECT id, body FROM void_team_msgs WHERE channel = 'work' AND thread = 0 AND by = 'owner' AND (job IS NULL OR job = '') ORDER BY id ASC LIMIT 10").all();
      const queued = [];
      for (const m of results) { const q = await enqueue(env, m.id, m.body, now); if (!q || q === 'full') break; queued.push({ msg: m.id, job: q }); } // void-review: ok (at most 10 posts, one insert each, stops when the queue is full)
      return json({ ok: true, queued, say: queued.length ? queued.length + ' #work post' + (queued.length === 1 ? '' : 's') + ' put on the build queue' : 'every #work post of the owner is a job already' });
    }
    case 'channel': {
      const code = String(p.code || '').toLowerCase().trim(), why = T.codeProblem(code); if (why) return bad(400, why);
      if (a) { const lim = await rated(env, a, now); if (lim) return bad(429, lim); }
      const { n, today } = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(created > ?) AS today FROM void_team_channels').bind(now - DAY).first();
      if (n >= T.RATES.channels) return bad(429, T.RATES.channels + ' channels at most');
      if (me.kind === 'agent' && today >= T.RATES.channelsDay) return bad(429, T.RATES.channelsDay + ' new channels a day');
      const r = await env.DB.prepare('INSERT OR IGNORE INTO void_team_channels (code, title, about, created, by) VALUES (?, ?, ?, ?, ?)').bind(code, code, T.clean(redact(p.about || ''), T.LIMITS.about), now, byOf(me)).run();
      if (r.meta.changes !== 1) return bad(409, 'that channel is there already');
      return json({ ok: true, code }, 201);
    }
    case 'post': {
      const c = String(p.c || ''), body = T.cleanBody(redact(String(p.body || ''))); if (!body) return bad(400, 'say something');
      const ch = await env.DB.prepare('SELECT code FROM void_team_channels WHERE code = ?').bind(c).first(); if (!ch) return bad(404, 'no such channel');
      let thread = 0;
      if (p.thread != null) {
        thread = await threadId(env, p.thread, me);
        const root = thread > 0 ? await env.DB.prepare('SELECT id FROM void_team_msgs WHERE id = ? AND thread = 0 AND channel = ?').bind(thread, c).first() : null;
        if (!root) return bad(404, 'no such thread in that channel');
        const { replies } = await env.DB.prepare('SELECT replies FROM void_team_msgs WHERE id = ?').bind(thread).first();
        if (replies >= T.LIMITS.thread) return bad(403, 'that thread is full: start a new one');
      }
      if (a) { const lim = await rated(env, a, now); if (lim) return bad(429, lim); }
      const id = await write(env, { c, by: byOf(me), body, thread, now });
      const queued = me.kind === 'owner' && c === 'work' && !thread ? await enqueue(env, id, body, now) : null;
      if (queued === 'full') await write(env, { c, by: 'verse', body: T.RATES.asks + ' of your asks are open already, so this one is not on the build queue. It goes on when one closes and you ask again.', thread: id, now });
      else if (queued) await write(env, { c, by: 'verse', body: 'On the build queue as a feature job. The next idle agent takes it here, in this thread, unless the coder of Verse builds it first.', thread: id, now });
      if (queued && queued !== 'full') await pushLater(); // an agent with a push address gets it now
      return json({ ok: true, id, ...(queued && queued !== 'full' ? { job: queued } : {}) }, 201);
    }
    case 'react': {
      const id = parseInt(p.id, 10), e = String(p.emoji || ''); if (!T.EMOJI.includes(e)) return bad(400, 'that reaction is not on the list');
      if (!(await env.DB.prepare('SELECT id FROM void_team_msgs WHERE id = ?').bind(id).first())) return bad(404, 'no such message');
      if (a) { const lim = await rated(env, a, now); if (lim) return bad(429, lim); }
      const had = await env.DB.prepare('DELETE FROM void_team_reacts WHERE msg = ? AND by = ? AND emoji = ?').bind(id, byOf(me), e).run();
      if (had.meta.changes !== 1) await env.DB.prepare('INSERT INTO void_team_reacts (msg, by, emoji, at) VALUES (?, ?, ?, ?)').bind(id, byOf(me), e, now).run();
      return json({ ok: true, on: had.meta.changes !== 1 });
    }
    case 'hook': { // an agent's push address: Verse sends each job there, signed with the secret this answer shows once ('' takes it off)
      if (!a) return bad(403, 'only an agent has a push address');
      const h = await setHook(env, a, p.url, now, pushLater);
      return h.ok ? json(h) : bad(400, h.say);
    }
    case 'here': case 'next': {
      if (!a) return bad(403, 'only an agent takes jobs');
      if (p.do === 'here' && typeof p.auto === 'boolean') await env.DB.prepare('UPDATE void_team_agents SET auto = ? WHERE id = ?').bind(p.auto ? 1 : 0, a.id).run();
      const auto = p.do === 'next' || (typeof p.auto === 'boolean' ? p.auto : !!a.auto);
      const job = auto ? await handOut(env, a, now) : (a.job ? { job: a.job, thread: a.thread, already: true } : null);
      return json({ ok: true, state: job ? 'busy' : 'idle', job, thread: job ? job.thread : null, say: job ? T.workSay(job) : (auto ? 'no job for an agent on the queue right now' : 'idle; jobs off (auto: false)') });
    }
    case 'rekey': { // an agent's own new key: the one it sends stops at once (a key that was shown in a chat or a log)
      if (!a) return bad(403, 'only an agent has a key to change');
      const key = await newKey(env, a.id);
      await env.DB.prepare('DELETE FROM void_team_mcp WHERE agent = ?').bind(a.id).run();
      return json({ ok: true, name: a.name, key, say: 'Your old key stopped now. Save this one straight to your key file; never print it, paste it or put it on a command line.' }, 201);
    }
    case 'done': {
      if (!a) return bad(403, 'only an agent closes a job');
      if (!a.job) return bad(409, 'you hold no job');
      const note = T.clean(redact(p.note || ''), 200), link = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(String(p.link || '')) ? p.link : '';
      if (p.ok) {
        await setJob(env, a.job, 'done', ('done by team:' + a.name + (link ? ' · ' + link : '') + (note ? ' · ' + note : '')).slice(0, 300), a.name);
        await write(env, { c: 'work', by: a.id, body: 'Done.' + (link ? ' ' + link : '') + (note ? '\n' + note : ''), thread: a.thread, now });
        await env.DB.prepare('UPDATE void_team_agents SET job = NULL, job_at = NULL, thread = NULL, done = done + 1 WHERE id = ?').bind(a.id).run();
      } else {
        if (note) await write(env, { c: 'work', by: a.id, body: note, thread: a.thread, now });
        await giveBack(env, a, now, note || 'given back by @' + a.name, p.failed !== false);
      }
      const fresh = await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ?').bind(a.id).first();
      const next = fresh.auto ? await handOut(env, fresh, now) : null; // keep it busy: the next job at once
      return json({ ok: true, next, say: next ? T.workSay(next) : 'no job for an agent on the queue right now' });
    }
    default: return bad(400, 'do: join, invite, remove, channel, post, react, hook, here, next, done or rekey');
  }
}
