// Comments, the server half (lib/comments.js has the rules): under a published generator (thread gen:<id>), under /image/ (thread image), and the
// generators forum (/generators/forum/): topics, each a thread forum:<id> of replies, on the same rules, the same sum and the same limits.
//   GET  ?thread=<thread>          -> { items: [{ id, name, text, at }], check: { q, token } } (newest 100; reported ones left out)
//   POST { act: 'post', thread, name, text, answer, token, website } -> { ok, id }
//   POST { act: 'report', id }     -> { ok } three reports from three connections hide it
//   GET  ?topics=1                 -> { items: [{ id, title, name, at, last, replies }], check } (the forum, newest activity first, 50)
//   POST { act: 'topic', title, name, text, answer, token, website } -> { ok, id } a new forum topic and its first post
//   POST { act: 'report-topic', id } -> { ok } three reports hide a topic
//   DELETE ?id=<id> or ?topic=<id> (owner key) -> { ok }
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. An open endpoint with no account. The most a caller can do is post a plain-text comment
// of 500 characters under a 30-character name, to a thread on a closed list (image, or a generator that is published), after answering a small sum
// signed with the SALT secret at least 3 seconds after it was given, with the hidden "website" field left empty (a form-filling bot fills it).
// That is a bot check against simple spam, not a CAPTCHA: a determined script can still read the sum. A stronger check (Cloudflare Turnstile)
// needs a site key and a secret from the owner. Links, sexual or hateful words and key shapes are refused; 2 posts a minute and 15 a day per
// connection, 1,000 a day in all; a thread keeps its newest 300. Three reports from three connections hide a comment at once; the owner deletes.
// Text is shown as text, never HTML. Connections are SHA-256 of the address, the UTC day and SALT; no address is stored. No D1 or SALT: off.
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { cleanName, cleanText, commentProblem, newCheck, checkOk, THREAD_RE, ID_RE, TITLE_MAX } from '../../lib/comments.js';

export const POST_MINUTE = 2, POST_DAY = 15, POST_ALL = 1000, THREAD_MAX = 300, REPORTS_HIDE = 3, TOPICS_MAX = 500;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'comments are off for now' }, 503);
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;
function newId() { const a = new Uint8Array(10); crypto.getRandomValues(a); return [...a].map((x) => 'abcdefghijklmnopqrstuvwxyz234567'[x & 31]).join(''); }
let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_comments (id TEXT PRIMARY KEY, thread TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL, reports INTEGER NOT NULL DEFAULT 0)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS void_comments_thread ON void_comments (thread, at)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_forum (id TEXT PRIMARY KEY, title TEXT NOT NULL, name TEXT NOT NULL, at INTEGER NOT NULL, last INTEGER NOT NULL, replies INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_comments_seen (k TEXT PRIMARY KEY, day TEXT NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_comments_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run();
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_comments_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_comments_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();
async function threadExists(env, thread) {
  if (thread === 'image') return true;
  if (thread.startsWith('forum:')) { try { return !!(await env.DB.prepare('SELECT 1 FROM void_forum WHERE id = ? AND reports < ?').bind(thread.slice(6), REPORTS_HIDE).first()); } catch (_) { return false; } }
  try { return !!(await env.DB.prepare('SELECT 1 FROM void_gens WHERE id = ? AND reports < 3').bind(thread.slice(4)).first()); } catch (_) { return false; }
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB || !env.SALT) return off();
  const u = new URL(request.url), thread = u.searchParams.get('thread') || '';
  if (u.searchParams.get('topics') === '1') {
    try { await ensure(env); const { results } = await env.DB.prepare('SELECT id, title, name, at, last, replies FROM void_forum WHERE reports < ? ORDER BY last DESC LIMIT 50').bind(REPORTS_HIDE).all(); return json({ ok: true, items: results || [], check: await newCheck(env.SALT) }); } catch (_) { return off(); }
  }
  if (!THREAD_RE.test(thread)) return json({ ok: false, error: 'not a thread' }, 404);
  try {
    await ensure(env);
    const { results } = await env.DB.prepare('SELECT id, name, text, at FROM void_comments WHERE thread = ? AND reports < ? ORDER BY at ' + (thread.startsWith('forum:') ? 'ASC' : 'DESC') + ' LIMIT 100').bind(thread, REPORTS_HIDE).all();
    const topic = thread.startsWith('forum:') ? await env.DB.prepare('SELECT id, title, name, at, replies FROM void_forum WHERE id = ? AND reports < ?').bind(thread.slice(6), REPORTS_HIDE).first() : null;
    if (thread.startsWith('forum:') && !topic) return json({ ok: false, error: 'not a topic (it may have been taken down)' }, 404);
    return json({ ok: true, items: results || [], check: await newCheck(env.SALT), ...(topic ? { topic } : {}) });
  } catch (_) { return off(); }
}
export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off();
  let b; try { b = JSON.parse((await request.text()).slice(0, 4000)); } catch (_) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);
  const day = dayOf(), conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  try {
    await ensure(env);
    if (b.act === 'report') {
      if (!ID_RE.test(String(b.id || ''))) return json({ ok: false, error: 'not a comment' }, 404);
      if ((await bump(here, 'comments:r:' + conn)) > 20) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
      const r = await env.DB.prepare('INSERT INTO void_comments_seen (k, day) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind('r:' + conn + ':' + b.id, day).run();
      if (Number(r && r.meta && r.meta.changes) > 0) await env.DB.prepare('UPDATE void_comments SET reports = reports + 1 WHERE id = ?').bind(b.id).run();
      return json({ ok: true });
    }
    if (b.act === 'report-topic') {
      if (!/^[a-z2-7]{10}$/.test(String(b.id || ''))) return json({ ok: false, error: 'not a topic' }, 404);
      if ((await bump(here, 'comments:r:' + conn)) > 20) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
      const r = await env.DB.prepare('INSERT INTO void_comments_seen (k, day) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind('t:' + conn + ':' + b.id, day).run();
      if (Number(r && r.meta && r.meta.changes) > 0) await env.DB.prepare('UPDATE void_forum SET reports = reports + 1 WHERE id = ?').bind(b.id).run();
      return json({ ok: true });
    }
    if (b.act !== 'post' && b.act !== 'topic') return json({ ok: false, error: 'bad request' }, 400);
    const isTopic = b.act === 'topic', title = isTopic ? cleanText(b.title).replace(/\n/g, ' ').slice(0, TITLE_MAX) : '';
    let thread = String(b.thread || '');
    if (isTopic) { if (!title) return json({ ok: false, error: 'a topic needs a title' }, 400); thread = 'forum:' + newId(); }
    else if (!THREAD_RE.test(thread) || !(await threadExists(env, thread))) return json({ ok: false, error: 'not a thread' }, 404);
    if (String(b.website || '')) return json({ ok: true, id: newId() }); // the hidden field was filled: a bot; it is told yes and nothing is kept
    if ((await bump(here, 'comments:p:' + conn)) > POST_MINUTE) return json({ ok: false, error: 'slow down: a couple a minute' }, 429, { 'retry-after': '60' });
    const bad = await checkOk(env.SALT, b.token, b.answer); if (bad) return json({ ok: false, error: bad }, 400);
    const name = cleanName(b.name), text = cleanText(b.text), problem = commentProblem(name, text, isSecret) || (isTopic ? commentProblem(name, title, isSecret) : '');
    if (problem) return json({ ok: false, error: problem }, 400);
    if ((await used(env, 'c:' + conn, day)) >= POST_DAY) return json({ ok: false, error: 'that is enough comments for today' }, 429, { 'retry-after': String(secondsToMidnight()) });
    if ((await used(env, 'all', day)) >= POST_ALL) return json({ ok: false, error: 'comments are busy today; try tomorrow' }, 429, { 'retry-after': String(secondsToMidnight()) });
    if (!(await used(env, 'all', day))) await env.DB.prepare('DELETE FROM void_comments_seen WHERE day < ?').bind(day).run();
    const id = newId();
    const now = Date.now();
    if (isTopic) {
      await env.DB.prepare('INSERT INTO void_forum (id, title, name, at, last) VALUES (?, ?, ?, ?, ?)').bind(thread.slice(6), title, name, now, now).run();
      await env.DB.prepare('DELETE FROM void_forum WHERE id NOT IN (SELECT id FROM void_forum ORDER BY last DESC LIMIT ?)').bind(TOPICS_MAX).run();
    } else if (thread.startsWith('forum:')) await env.DB.prepare('UPDATE void_forum SET last = ?, replies = replies + 1 WHERE id = ?').bind(now, thread.slice(6)).run();
    await env.DB.prepare('INSERT INTO void_comments (id, thread, name, text, at) VALUES (?, ?, ?, ?, ?)').bind(id, thread, name, text, now).run();
    await env.DB.prepare('DELETE FROM void_comments WHERE thread = ? AND id NOT IN (SELECT id FROM void_comments WHERE thread = ? ORDER BY at DESC LIMIT ?)').bind(thread, thread, THREAD_MAX).run();
    await tick(env, 'c:' + conn, day); await tick(env, 'all', day);
    return json({ ok: true, id: isTopic ? thread.slice(6) : id });
  } catch (_) { return off(); }
}
export async function onRequestDelete({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const u = new URL(request.url), id = u.searchParams.get('id'), topic = u.searchParams.get('topic');
  if (topic !== null) { if (!/^[a-z2-7]{10}$/.test(topic)) return json({ ok: false, error: 'not a topic' }, 404); try { await ensure(env); await env.DB.prepare('DELETE FROM void_forum WHERE id = ?').bind(topic).run(); await env.DB.prepare('DELETE FROM void_comments WHERE thread = ?').bind('forum:' + topic).run(); return json({ ok: true }); } catch (_) { return off(); } }
  if (!ID_RE.test(String(id || ''))) return json({ ok: false, error: 'not a comment' }, 404);
  try { await ensure(env); await env.DB.prepare('DELETE FROM void_comments WHERE id = ?').bind(id).run(); return json({ ok: true }); } catch (_) { return off(); }
}
