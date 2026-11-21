// The Searches log's API (lib/searches.js). POST { ask, kind } from the page logs one ask and says whether this visitor is slowed, locked or banned.
// GET (owner only, server-verified; anyone else gets 404) lists the asks: ?who= one visitor, ?q= words. POST { ban, state } (owner only) bans
// ('banned'), locks ('locked') or lifts ('') a visitor. Nothing leaves Verse's own D1; rows older than 90 days are dropped.
import { record, report, view, d1Store, memoryStore, visitorId, RETAIN_DAYS, DAY } from '../../lib/searches.js';
import { session } from '../../lib/void-me.js';
import { ownerGate } from '../../lib/owner-gate.js';

const H = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
const json = (o, status = 200) => Response.json(o, { status, headers: H });
const missing = () => new Response('Not found', { status: 404, headers: H });
let mem = null;
export const storeOf = (env) => (env && env.DB ? d1Store(env.DB) : (mem = mem || memoryStore()));
export const resetMem = () => { mem = null; };

export async function onRequestGet({ request, env }) {
  if (!(await ownerGate(request, env).catch(() => false))) return missing();
  const u = new URL(request.url), s = storeOf(env);
  if (u.searchParams.get('reports')) return json({ reports: await s.listReports(100) });
  return json({ rows: await view(s, { who: (u.searchParams.get('who') || '').slice(0, 20), q: (u.searchParams.get('q') || '').slice(0, 80) }) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) { return json({ ok: false }, 400); }
  const s = storeOf(env);
  if (b && typeof b.ban === 'string') {
    if (!(await ownerGate(request, env).catch(() => false))) return missing();
    const state = ['banned', 'locked'].includes(b.state) ? b.state : '';
    await s.setBan(b.ban.slice(0, 20), state, state ? 'owner' : '');
    return json({ ok: true, who: b.ban.slice(0, 20), state });
  }
  const acct = await accountOf(request, env);
  if (b && typeof b.report === 'string') { try { await report(s, { who: await visitorId(request, env), acct, ask: b.ask, title: b.title, reason: b.report, note: b.note, pic: b.pic }); return json({ ok: true }); } catch (_) { return json({ ok: false }); } }
  try {
    const out = await record(s, { ask: b.ask, who: await visitorId(request, env), kind: b.kind, acct });
    if (Math.random() < 0.02) { const p = s.prune(Date.now() - RETAIN_DAYS * DAY).catch(() => {}); if (waitUntil) waitUntil(p); }
    return json({ ok: true, state: out.state });
  } catch (_) { return json({ ok: false, state: '' }); }
}

/** the signed-in account behind a request, from its server-checked session: 'owner', 'a-' + the account's id, or ''. Never read from the body. */
export async function accountOf(request, env) {
  try { if (await ownerGate(request, env)) return 'owner'; } catch (_) {}
  try { const m = env && env.DB ? await session(request, env) : null; return m && m.userId ? 'a-' + String(m.userId).slice(0, 22) : ''; } catch (_) { return ''; }
}
/** for the answer route: true when this visitor is banned or locked (a read error is false). */
export async function stopped(request, env) {
  try { const st = storeOf(env), acct = await accountOf(request, env); if (acct === 'owner') return false; const b = (await st.ban(await visitorId(request, env))) || (acct ? await st.ban(acct) : null); return !!(b && (b.state === 'banned' || b.state === 'locked')); } catch (_) { return false; }
}
