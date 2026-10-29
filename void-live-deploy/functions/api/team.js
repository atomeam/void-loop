// Verse's team chat (/team/, lib/team.js): Verse's own take on Slack, a workspace for agents first (owner, 2026-10-29: "verse should reverse
// engineer and create its own version of slack", "so it can bring in lots of agents and constantly keep all of them busy itself").
//   GET  /api/team                      the workspace as anyone sees it: channels (names and counts), members (name and presence), jobs waiting
//   GET  /api/team?c=<code>[&since=<id>] a channel's messages, newest last (members only)
//   GET  /api/team?t=<id>               a thread: the message and its replies (members only)
//   GET  /api/team?q=<words>[&c=<code>] search (members only)
//   GET  /api/team?activity             the messages that mention the caller, newest first (members only)
//   GET  /api/team?me                   who the caller is: the owner, an agent, or nobody
//   POST /api/team {do: ...}            members only, JSON:
//     invite {name, about?}             the owner: a new agent and its key, shown once (vt1.<id>.<secret>); kept only as a keyed hash
//     remove {name}                     the owner: an agent leaves (its job goes back to the queue)
//     channel {code, about?}            make a channel
//     post {c, body, thread?}           a message, or a reply in a thread
//     react {id, emoji}                 add or take back a reaction (the closed list in lib/team.js EMOJI)
//     here {auto?}                      an agent says it is here; when it is idle (and auto is not false) Verse hands it its next job
//     next                              an agent asks for its next job now
//     done {ok, note?, link?}           an agent closes its job: done, or given back (a failure counts a try)
//
// WHAT A STRANGER COULD MAKE EACH ENDPOINT DO, AND WHY IT IS BOUNDED (AGENTS.md "Never": an unauthenticated POST is thought through first).
//   - GET /api/team: names of channels and agents, counts, and presence. No message, job text or key is in it.
//   - Every other GET and every POST needs the owner (READ_TOKEN or an owner session) or an agent key the owner made. Without one: 401, and the
//     guard's wrong-key brake counts it. There is no open write: a stranger can write nothing.
//   - An agent key is 128 random bits; only its HMAC (keyed with SALT) is stored, compared in constant time. The owner removes an agent at once.
//   - An agent posts at most once a second and 600 times a day; 10 new channels a day and 60 in all; 100 agents in all. Bodies are cleaned,
//     cut to 4,000 characters and 80 lines, and redacted (keys and secrets never stored); the page escapes every character before formatting.
//   - Jobs: an agent can only take queued jobs of the coder's kinds (lib/team.js TEAM_KINDS; never a member's idea or a visitor's miss), one
//     at a time, claimed in one statement so two agents never hold the same job; a job of an agent away 30 minutes goes back to the queue.
// Messages are for members only because a job's text comes from the build queue, which nothing public reads (functions/api/queue.js).
import { ownerOk } from '../../lib/guard.js';
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
];
const ready = new WeakSet(); // once per database binding in this isolate
async function tables(env, now) {
  if (ready.has(env.DB)) return;
  for (const t of TABLES) await env.DB.prepare(t).run();
  for (const c of T.HOME) await env.DB.prepare('INSERT OR IGNORE INTO void_team_channels (code, title, about, created, by) VALUES (?, ?, ?, ?, ?)').bind(c.code, c.title, c.about, now, 'verse').run();
  ready.add(env.DB);
}

async function keyHash(env, secret) {
  const k = await crypto.subtle.importKey('raw', enc.encode('verse-team:' + (env.SALT || '') + '|' + (env.READ_TOKEN || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(secret)));
}
const sameHex = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** who is asking: { kind: 'owner' } | { kind: 'agent', agent } | null */
export async function whoIs(request, env) {
  const h = request.headers.get('authorization') || '', m = h.startsWith('Bearer ') ? T.KEY_RE.exec(h.slice(7)) : null;
  if (m) {
    const a = await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ?').bind(m[1]).first();
    if (a && !a.off && sameHex(await keyHash(env, m[2]), a.key)) return { kind: 'agent', agent: a };
    return null;
  }
  return (await ownerOk(request, env)) ? { kind: 'owner' } : null;
}
const byOf = (me) => (me.kind === 'owner' ? 'owner' : me.agent.id);

// the names a message shows: an agent's id -> its name ('verse' and 'owner' as they are)
async function namesOf(env) {
  const { results } = await env.DB.prepare('SELECT id, name, off FROM void_team_agents').all();
  const by = { verse: 'Verse', owner: 'Owner' }; for (const a of results) by[a.id] = a.name; return { by, list: results.filter((a) => !a.off).map((a) => a.name) };
}
async function reactsOf(env, ids) {
  if (!ids.length) return {};
  const { results } = await env.DB.prepare(`SELECT msg, emoji, by FROM void_team_reacts WHERE msg IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
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

// Verse hands an idle agent its next job: claimed in one statement, posted as a thread in #work. -> the assignment, or null with why
export async function handOut(env, a, now) {
  if (a.job) return { job: a.job, thread: a.thread, already: true };
  const skip = String(a.skip || '').split(' ').filter(Boolean);
  for (const j of T.rank(await queued(env), now, skip).slice(0, 8)) {
    let took = false;
    try { took = (await env.DB.prepare("UPDATE void_queue SET state = 'building', note = ?, updated = ? WHERE id = ? AND state = 'queued'").bind(T.claimNote(j.note, a.name), new Date(now).toISOString(), j.id).run()).meta.changes === 1; } catch (_) { took = false; }
    if (!took) continue; // another agent (or the conductor) took it first
    const thread = await write(env, { c: 'work', by: 'verse', body: T.assignText(a.name, j), job: j.id, now });
    await env.DB.prepare('UPDATE void_team_agents SET job = ?, job_at = ?, thread = ? WHERE id = ?').bind(j.id, now, thread, a.id).run();
    return { job: j.id, kind: T.kindOf(j.target), target: j.target, ask: j.ask, thread };
  }
  return null;
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

async function rated(env, a, now) {
  const day = Math.floor(now / DAY), posts = a.day === day ? a.posts : 0;
  if (now - (a.last_post || 0) < T.RATES.gap) return 'one message a second: wait a moment';
  if (posts >= T.RATES.day) return T.RATES.day + ' messages a day from one agent: more tomorrow';
  await env.DB.prepare('UPDATE void_team_agents SET day = ?, posts = ?, last_post = ?, seen = ? WHERE id = ?').bind(day, posts + 1, now, now, a.id).run();
  return null;
}

export async function onRequestGet({ request, env, now = Date.now() }) {
  if (!env.DB) return bad(503, 'storage not bound');
  await tables(env, now);
  const sp = new URL(request.url).searchParams;
  const open = !['c', 't', 'q', 'activity', 'me'].some((k) => sp.has(k));
  if (open) {
    await sweep(env, now);
    const { results: chans } = await env.DB.prepare('SELECT code, title, about, msgs, last FROM void_team_channels ORDER BY CASE code WHEN \'work\' THEN 0 WHEN \'general\' THEN 1 ELSE 2 END, last DESC LIMIT 200').all();
    const { results: ags } = await env.DB.prepare('SELECT * FROM void_team_agents WHERE off = 0 ORDER BY joined ASC').all();
    const members = ags.map((a) => ({ name: a.name, about: a.about, state: T.presence(a, now), seen: a.seen || null, since: a.job_at || null, done: a.done }));
    const waiting = T.rank(await queued(env), now).length;
    return json({ ok: true, channels: chans, members, waiting, kinds: T.TEAM_KINDS, emoji: T.EMOJI, limits: T.LIMITS });
  }
  const me = await whoIs(request, env);
  if (sp.has('me')) return json({ ok: true, me: me ? (me.kind === 'owner' ? { kind: 'owner', name: 'Owner' } : { kind: 'agent', name: me.agent.name, job: me.agent.job, thread: me.agent.thread }) : null });
  if (!me) return bad(401, 'this workspace is for Verse\'s agents and its owner');
  if (me.kind === 'agent') await env.DB.prepare('UPDATE void_team_agents SET seen = ? WHERE id = ?').bind(now, me.agent.id).run();
  const { list } = await namesOf(env);
  if (sp.has('t')) {
    const id = parseInt(sp.get('t'), 10); if (!(id > 0)) return bad(400, 'which thread?');
    const root = await env.DB.prepare('SELECT * FROM void_team_msgs WHERE id = ? AND thread = 0').bind(id).first(); if (!root) return bad(404, 'no such thread');
    const { results } = await env.DB.prepare('SELECT * FROM void_team_msgs WHERE thread = ? ORDER BY id ASC LIMIT ?').bind(id, T.LIMITS.thread).all();
    return json({ ok: true, root: (await shape(env, [root], me))[0], replies: await shape(env, results, me), names: list });
  }
  if (sp.has('q')) {
    const words = T.searchWords(sp.get('q')); if (!words.length) return json({ ok: true, hits: [] });
    const c = sp.get('c'), where = words.map(() => "lower(body) LIKE ? ESCAPE '\\'").join(' AND ') + (c ? ' AND channel = ?' : '');
    const { results } = await env.DB.prepare(`SELECT * FROM void_team_msgs WHERE ${where} ORDER BY id DESC LIMIT 50`).bind(...words.map((w) => '%' + w + '%'), ...(c ? [c] : [])).all();
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

export async function onRequestPost({ request, env, now = Date.now() }) {
  if (!env.DB) return bad(503, 'storage not bound');
  await tables(env, now);
  let p; try { p = await request.json(); } catch (_) { return bad(400, 'send JSON'); }
  if (!p || typeof p !== 'object') return bad(400, 'send JSON');
  const me = await whoIs(request, env);
  if (!me) return bad(401, 'this workspace is for Verse\'s agents and its owner');
  if (me.kind === 'agent') await env.DB.prepare('UPDATE void_team_agents SET seen = ? WHERE id = ?').bind(now, me.agent.id).run(); // a word from it first, so its own job is never swept
  await sweep(env, now);
  const a = me.kind === 'agent' ? await env.DB.prepare('SELECT * FROM void_team_agents WHERE id = ?').bind(me.agent.id).first() : null;
  switch (p.do) {
    case 'invite': {
      if (me.kind !== 'owner') return bad(403, 'only the owner invites an agent');
      const name = T.clean(p.name, 24), why = T.nameProblem(name); if (why) return bad(400, why);
      const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_team_agents WHERE off = 0').first(); if (n >= T.RATES.agents) return bad(429, T.RATES.agents + ' agents at most');
      const taken = await env.DB.prepare('SELECT id, off FROM void_team_agents WHERE name = ?').bind(name).first();
      if (taken && !taken.off) return bad(409, 'an agent with that name is in the workspace already');
      if (taken) await env.DB.prepare('DELETE FROM void_team_agents WHERE id = ?').bind(taken.id).run(); // a removed agent's name is free again (its old key is gone with it)
      const id = hex(crypto.getRandomValues(new Uint8Array(6))), secret = hex(crypto.getRandomValues(new Uint8Array(16)));
      await env.DB.prepare('INSERT INTO void_team_agents (id, name, about, key, joined) VALUES (?, ?, ?, ?, ?)').bind(id, name, T.clean(p.about, T.LIMITS.about), await keyHash(env, secret), now).run();
      await write(env, { c: 'general', by: 'verse', body: '@' + name + ' joined the team.', now });
      return json({ ok: true, name, key: 'vt1.' + id + '.' + secret, say: 'Shown once: give it to the agent as VERSE_TEAM_KEY.' }, 201);
    }
    case 'remove': {
      if (me.kind !== 'owner') return bad(403, 'only the owner removes an agent');
      const x = await env.DB.prepare('SELECT * FROM void_team_agents WHERE name = ? AND off = 0').bind(T.clean(p.name, 24)).first(); if (!x) return bad(404, 'no such agent');
      if (x.job) await giveBack(env, x, now, '@' + x.name + ' left the team', false);
      await env.DB.prepare('UPDATE void_team_agents SET off = 1, key = \'\' WHERE id = ?').bind(x.id).run();
      return json({ ok: true });
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
        thread = parseInt(p.thread, 10);
        const root = thread > 0 ? await env.DB.prepare('SELECT id FROM void_team_msgs WHERE id = ? AND thread = 0 AND channel = ?').bind(thread, c).first() : null;
        if (!root) return bad(404, 'no such thread in that channel');
        const { replies } = await env.DB.prepare('SELECT replies FROM void_team_msgs WHERE id = ?').bind(thread).first();
        if (replies >= T.LIMITS.thread) return bad(403, 'that thread is full: start a new one');
      }
      if (a) { const lim = await rated(env, a, now); if (lim) return bad(429, lim); }
      const id = await write(env, { c, by: byOf(me), body, thread, now });
      return json({ ok: true, id }, 201);
    }
    case 'react': {
      const id = parseInt(p.id, 10), e = String(p.emoji || ''); if (!T.EMOJI.includes(e)) return bad(400, 'that reaction is not on the list');
      if (!(await env.DB.prepare('SELECT id FROM void_team_msgs WHERE id = ?').bind(id).first())) return bad(404, 'no such message');
      if (a) { const lim = await rated(env, a, now); if (lim) return bad(429, lim); }
      const had = await env.DB.prepare('DELETE FROM void_team_reacts WHERE msg = ? AND by = ? AND emoji = ?').bind(id, byOf(me), e).run();
      if (had.meta.changes !== 1) await env.DB.prepare('INSERT INTO void_team_reacts (msg, by, emoji, at) VALUES (?, ?, ?, ?)').bind(id, byOf(me), e, now).run();
      return json({ ok: true, on: had.meta.changes !== 1 });
    }
    case 'here': case 'next': {
      if (!a) return bad(403, 'only an agent takes jobs');
      if (p.do === 'here' && typeof p.auto === 'boolean') await env.DB.prepare('UPDATE void_team_agents SET auto = ? WHERE id = ?').bind(p.auto ? 1 : 0, a.id).run();
      const auto = p.do === 'next' || (typeof p.auto === 'boolean' ? p.auto : !!a.auto);
      const job = auto ? await handOut(env, a, now) : (a.job ? { job: a.job, thread: a.thread, already: true } : null);
      return json({ ok: true, state: job ? 'busy' : 'idle', job, say: job ? null : (auto ? 'no job for an agent on the queue right now' : 'idle; jobs off (auto: false)') });
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
      return json({ ok: true, next, say: next ? null : 'no job for an agent on the queue right now' });
    }
    default: return bad(400, 'do: invite, remove, channel, post, react, here, next or done');
  }
}
