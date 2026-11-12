// Internal credits for /prizes/. Append-only void_credits. Issued from realized earnings (read only) under a daily cap. Not money. Tests: tools/credits.test.mjs.
import { odds } from './prizes.js';
import { readEarnings } from './earnings.js';
import { ensureStoreTables } from './store-db.js';
import { ensureTables, session } from './void-me.js';
import { connId } from './guard.js';
import { workOk } from './boards.js';
import { jsonNoStore } from './http.js'; // one copy (lib/http.js, convergence step 3)

export const EARN = Object.freeze({ daily: 1, tool: 1, bug: 5, build: 10 });
export const SPEND = Object.freeze({ answer: 2, skill: 5, cap: 3 });
export const ANSWERS_PER = 5, CAP_STEP = 2, MEMBER_DAY = 20, DAILY_CAP = 24, IP_GAP_MS = 60_000, IP_HOUR_MAX = 8, POW_BITS = 12;
export const PAGE_SINCE = '2026-10-28T00:00:00.000Z';
const TABLE = 'CREATE TABLE IF NOT EXISTS void_credits (id TEXT PRIMARY KEY, at TEXT NOT NULL, member TEXT NOT NULL, ip TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, ref TEXT NOT NULL)';
const made = new WeakMap();
const enc = new TextEncoder();
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const iso = (now) => new Date(now).toISOString();
export const nextDay = (now) => { const d = new Date(now); d.setUTCHours(24, 0, 0, 0); return d.toISOString(); };
export function maskName(name) { const raw = String(name || '').trim(); if (!raw || /@/.test(raw)) return '·'; const s = [...raw]; return s[0] + '·'.repeat(Math.min(4, Math.max(1, s.length - 1))); }
export const botUa = (ua) => { const s = String(ua || ''); return s.length < 12 || /bot|spider|crawl|headless|python-requests|curl\/|wget|httpie/i.test(s); };
export function oddsFromCounts(counts) { const slices = Object.entries(counts || {}).filter(([k, n]) => EARN[k] && n > 0).map(([k, n]) => ({ label: k, value: EARN[k], weight: n })); return slices.length ? odds(slices, 0) : null; }

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function challengeFor(ip, env, now = Date.now()) {
  const hour = Math.floor(now / 3600000);
  return hour.toString(36) + '.' + (await hmac(env.SALT, ip + ':' + hour)).slice(0, 12);
}
export function ensureCredits(env) {
  if (!env || !env.DB) return Promise.reject(new Error('no DB binding'));
  let p = made.get(env.DB);
  if (!p) {
    p = (async () => { await ensureTables(env); await ensureStoreTables(env); await env.DB.prepare(TABLE).run(); })().catch((e) => { made.delete(env.DB); throw e; });
    made.set(env.DB, p);
  }
  return p;
}
const json = (body, status = 200, extra) => jsonNoStore(body, status, extra || {});
async function displayName(env, userId) {
  try {
    const row = await env.DB.prepare('SELECT handle FROM void_pages WHERE user_id = ?').bind(userId).first();
    const h = row && row.handle && !/@/.test(row.handle) ? String(row.handle).slice(0, 40) : '';
    if (h) return h;
  } catch (_) { /* no published page */ }
  return 'Member';
}
async function proofOk(env, body, ip, fetchFn, now) {
  if (!body || body.website) return false;
  if (env.TURNSTILE_SECRET) {
    const t = body.turnstile;
    if (typeof t !== 'string' || !t || t.length > 2048) return false;
    const form = new FormData(); form.append('secret', env.TURNSTILE_SECRET); form.append('response', t);
    const r = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    return !!(j && j.success);
  }
  if (!env.SALT) return false;
  const ch = body.challenge, want = [await challengeFor(ip, env, now), await challengeFor(ip, env, now - 3600000)];
  return want.includes(ch) && await workOk(ch, body.work, POW_BITS);
}
async function one(env, sql, ...a) { try { const row = await env.DB.prepare(sql).bind(...a).first(); return !!(row && row.id); } catch (_) { return false; } }
async function evidenceOk(env, userId, kind, ref) {
  if (kind === 'daily') return true;
  if (kind === 'tool') { if (!/^[a-z0-9-]{1,40}$/.test(ref || '')) return false; if (env.TOOLS && env.TOOLS.has(ref)) return true; if (!env.ASSETS || !env.ASSETS.fetch) return false; try { return (await env.ASSETS.fetch('https://a-to-mind.com/skills/' + ref + '.js')).ok; } catch (_) { return false; } }
  if (kind === 'bug') return one(env, "SELECT id FROM void_support WHERE id = ? AND who = ? AND status = 'answered' AND answer IS NOT NULL AND length(answer) > 0", ref, 'acct:' + userId);
  if (kind === 'build') return one(env, "SELECT i.id AS id FROM void_member_ideas i JOIN void_queue q ON q.id = i.job WHERE i.user_id = ? AND i.id = ? AND q.state IN ('done','live')", userId, ref);
  return false;
}
const sum = async (env, sql, ...a) => { const row = await env.DB.prepare(sql).bind(...a).first(); return Number(row && (row.n ?? row.c)) || 0; };
async function snapshot(env, member, now) {
  const day = dayOf(now), gap = iso(now - IP_GAP_MS);
  const [issuedToday, issuedAll, earnedToday, caps, balance] = await Promise.all([
    sum(env, "SELECT COALESCE(SUM(CASE WHEN amount > 0 AND substr(at,1,10) = ? THEN amount ELSE 0 END),0) AS n FROM void_credits", day),
    sum(env, 'SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) AS n FROM void_credits'),
    sum(env, "SELECT COALESCE(SUM(CASE WHEN amount > 0 AND member = ? AND substr(at,1,10) = ? THEN amount ELSE 0 END),0) AS n FROM void_credits", member, day),
    sum(env, "SELECT COUNT(*) AS n FROM void_credits WHERE member = ? AND kind = 'cap'", member),
    sum(env, 'SELECT COALESCE(SUM(amount),0) AS n FROM void_credits WHERE member = ?', member),
  ]);
  let pool = 0; try { pool = Math.max(0, Math.floor((await readEarnings(env)).earned_cents || 0)); } catch (_) { pool = 0; }
  return { day, gap, issuedToday, issuedAll, earnedToday, balance, pool, left: Math.max(0, pool - issuedAll), memberCap: MEMBER_DAY + CAP_STEP * caps };
}
function grantsFrom(rows) {
  const g = { answers: 0, skills: 0, caps: 0 };
  for (const r of rows || []) { if (r.kind === 'answer') g.answers += ANSWERS_PER; else if (r.kind === 'skill') g.skills += 1; else if (r.kind === 'cap') g.caps += 1; }
  return g;
}
async function memberView(env, member, now) {
  const s = await snapshot(env, member, now);
  const rows = ((await env.DB.prepare('SELECT kind, amount FROM void_credits WHERE member = ?').bind(member).all()).results) || [];
  const daily = await env.DB.prepare('SELECT id FROM void_credits WHERE id = ?').bind(member + ':daily:' + s.day).first();
  return { balance: s.balance, nextDaily: daily ? nextDay(now) : null, earnedToday: s.earnedToday, memberCap: s.memberCap, poolLeft: s.left, issuedToday: s.issuedToday, grants: grantsFrom(rows) };
}
async function poolOf(env) { try { return Math.max(0, Math.floor((await readEarnings(env)).earned_cents || 0)); } catch (_) { return 0; } }

export async function onLatestGet({ request, env }) {
  try { await ensureCredits(env); } catch (_) { return json({ ok: false, error: 'off for now' }, 503); }
  const now = Date.now(), ip = await connId(request, env);
  const rows = ((await env.DB.prepare('SELECT at, name, kind, amount FROM void_credits ORDER BY at DESC, id DESC LIMIT 20').all()).results) || [];
  const counts = { daily: 0, tool: 0, bug: 0, build: 0 };
  const all = ((await env.DB.prepare("SELECT kind, COUNT(*) AS n, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) AS issued FROM void_credits GROUP BY kind").all()).results) || [];
  let claims = 0, issued = 0;
  for (const r of all) { claims += Number(r.n) || 0; issued += Number(r.issued) || 0; if (EARN[r.kind]) counts[r.kind] = Number(r.n) || 0; }
  const pool = await poolOf(env);
  const challenge = env.SALT ? await challengeFor(ip, env, now) : null;
  return json({
    ok: true, claims, issued, counts, odds: oddsFromCounts(counts), since: PAGE_SINCE, cap: DAILY_CAP, left: Math.max(0, pool - issued),
    bits: POW_BITS, challenge, turnstile: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null,
    feed: rows.map((r) => ({ at: r.at, name: maskName(r.name), kind: r.kind, amount: r.amount })),
  });
}
export async function onClaimGet({ request, env }) {
  try { await ensureCredits(env); } catch (_) { return json({ ok: false, error: 'off for now' }, 503); }
  const who = await session(request, env).catch(() => null);
  if (!who) return json({ ok: false, error: 'sign in to see your balance' }, 401);
  return json({ ok: true, ...(await memberView(env, who.userId, Date.now())) });
}
export async function onClaimPost({ request, env }) {
  const fetchFn = (env && env.FETCH) || fetch;
  let body; try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'bad json' }, 400); }
  if (botUa(request.headers.get('user-agent'))) return json({ ok: false, error: 'a script cannot claim' }, 403);
  try { await ensureCredits(env); } catch (_) { return json({ ok: false, error: 'off for now' }, 503); }
  const now = Date.now(), ip = await connId(request, env);
  if (!(await proofOk(env, body, ip, fetchFn, now))) return json({ ok: false, error: 'the bot check failed' }, 403);
  const who = await session(request, env).catch(() => null);
  if (!who) return json({ ok: false, error: 'sign in to claim' }, 401);
  const spend = body && SPEND[body.spend] ? body.spend : '';
  const kind = spend || (body && EARN[body.kind] ? body.kind : '');
  if (!kind) return json({ ok: false, error: 'say what you earned or what you are buying' }, 400);
  const day = dayOf(now);
  const ref = spend ? String(body.nonce || '') : kind === 'daily' ? day : String(body.ref || '');
  if (spend && !/^[a-z0-9]{6,16}$/.test(ref)) return json({ ok: false, error: 'a spend needs a short nonce' }, 400);
  if (kind === 'tool' && !/^[a-z0-9-]{1,40}$/.test(ref)) return json({ ok: false, error: 'name the tool' }, 400);
  if (kind === 'bug' && !/^S-[0-9A-F]{8}$/.test(ref)) return json({ ok: false, error: 'name the answered report' }, 400);
  if (kind === 'build' && !/^[A-Za-z0-9]{4,40}$/.test(ref)) return json({ ok: false, error: 'name the shipped idea' }, 400);
  if (!spend && !(await evidenceOk(env, who.userId, kind, ref))) return json({ ok: false, error: 'that activity is not on your account' }, 403);
  const amount = spend ? -SPEND[spend] : EARN[kind];
  const id = who.userId + ':' + kind + ':' + ref + (kind === 'tool' ? ':' + day : '');
  const s = await snapshot(env, who.userId, now);
  const issue = amount > 0 ? amount : 0;
  if (issue && s.issuedToday + issue > DAILY_CAP) return json({ ok: false, error: 'today\'s credit cap is used', next: nextDay(now) }, 429, { 'retry-after': '3600' });
  if (issue && s.issuedAll + issue > s.pool) return json({ ok: false, error: 'no credits are left to issue' }, 403);
  if (issue && s.earnedToday + issue > s.memberCap) return json({ ok: false, error: 'your cap for today is used', next: nextDay(now) }, 429);
  if (s.balance + amount < 0) return json({ ok: false, error: 'not enough credits' }, 403);
  const recent = await env.DB.prepare('SELECT at FROM void_credits WHERE (member = ? OR ip = ?) AND at > ? ORDER BY at DESC LIMIT 1').bind(who.userId, ip, s.gap).first();
  if (recent) return json({ ok: false, error: 'wait before the next claim', next: iso(Date.parse(recent.at) + IP_GAP_MS) }, 429, { 'retry-after': '60' });
  const hourN = await sum(env, 'SELECT COUNT(*) AS n FROM void_credits WHERE ip = ? AND at > ?', ip, iso(now - 3600000));
  if (hourN >= IP_HOUR_MAX) return json({ ok: false, error: 'too many claims from here this hour' }, 429, { 'retry-after': '3600' });
  const name = await displayName(env, who.userId);
  const wrote = await env.DB.prepare('INSERT INTO void_credits (id, at, member, ip, name, kind, amount, ref) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM void_credits WHERE id = ?)').bind(id, iso(now), who.userId, ip, name, kind, amount, ref, id).run();
  if (!wrote || !wrote.meta || !wrote.meta.changes) return json({ ok: false, error: 'already claimed', next: kind === 'daily' || kind === 'tool' ? nextDay(now) : null }, 429);
  const v = await memberView(env, who.userId, now);
  return json({ ok: true, amount, kind, balance: v.balance, nextDaily: v.nextDaily, grants: v.grants });
}
