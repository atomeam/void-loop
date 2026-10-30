// Paid Verse members add to Verse (lib/members.js has the why and the rules).
// GET                       -> { live, perks, buy, wall }                                   anyone: what paid Verse gives, and what members built
// GET  (Bearer session)     -> + { signedIn, tier, left, ideas }                              the member's own ideas and where each stands
// POST (Bearer session) { do: 'claim', order, email } -> { ok, tier } | 4xx with the reason   links a purchase made with no ?void= (gumroad.js claimSale)
// POST (Bearer session) { idea } -> { ok, id, left } | 401 not signed in | 402 not paid | 400 the check's sentence | 429 limit | 503 not open yet
// The tier is read from void_accounts (only /api/gumroad writes it, after Gumroad confirms the sale); the page's word is never trusted. The owner's account is always 'paid' (lib/void-me.js tierOf).
import { ensureTables, bad, good, session, tierOf, brake } from '../../lib/void-me.js';
import { LIVE, BUY, DAILY, MONTHLY, perks, checkIdea, ensureIdeas, usage, queueIdea, mine, wall } from '../../lib/members.js';
import { relinkRecorded, claimSale, linkOwnerTest } from './gumroad.js';

const QUEUE = 'CREATE TABLE IF NOT EXISTS void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)';
async function ready(env) { await ensureTables(env); await env.DB.prepare(QUEUE).run(); await ensureIdeas(env); }

export async function onRequestGet({ request, env }) {
  const base = { live: LIVE, perks: perks(LIVE), buy: BUY, limits: { daily: DAILY, monthly: MONTHLY } };
  try {
    await ready(env);
    const out = { ...base, wall: LIVE ? await wall(env) : [] };
    const me = await session(request, env);
    if (!me) return good({ ...out, signedIn: false });
    let tier = await tierOf(env, me.userId);
    if (tier !== 'paid') { try { tier = (await relinkRecorded(env, me.userId)) === 'paid' ? 'paid' : tier; } catch (_) {} } // a purchase recorded before today's rules
    if (tier !== 'paid') { try { tier = (await linkOwnerTest(env, me.userId)) === 'paid' ? 'paid' : tier; } catch (_) {} } // the owner's own purchase, made with no Verse id
    return good({ ...out, signedIn: true, tier, ...(tier === 'paid' ? { left: (await usage(env, me.userId)).left, ideas: await mine(env, me.userId) } : {}) });
  } catch (_) { return good({ ...base, wall: [], signedIn: false, note: 'members are unavailable just now' }); }
}

export async function onRequestPost({ request, env }) {
  if (brake(request, 10)) return bad(429, 'too many tries; wait a minute');
  let b; try { b = JSON.parse((await request.text()).slice(0, 8000)); } catch (_) { return bad(400, 'bad json'); }
  try {
    await ready(env);
    const me = await session(request, env);
    if (!me) return bad(401, 'sign in with your passkey first');
    if (b && b.do === 'claim') { const c = await claimSale(env, me.userId, b.order, b.email); return c.ok ? good({ ok: true, tier: c.tier }) : bad(c.status, c.why); }
    if ((await tierOf(env, me.userId)) !== 'paid') return bad(402, 'sending ideas is part of MultiVerse', { buy: BUY });
    // before go-live, the pilot: a paid member on /members/?pilot (linked from nowhere) sends a real idea through every check, so
    // the whole path is proven on the live site before the form is switched on for everyone. MEMBERS_TRY: the test suite only
    if (!LIVE && !(b && b.pilot === true) && !env.MEMBERS_TRY) return bad(503, 'members can send ideas soon');
    const c = checkIdea(b && b.idea);
    if (!c.ok) return bad(400, c.why);
    const u = await usage(env, me.userId);
    if (u.left <= 0) return bad(429, u.day >= DAILY ? 'that is ' + DAILY + ' ideas today; send more tomorrow' : 'that is ' + MONTHLY + ' ideas this month');
    const q = await queueIdea(env, me.userId, c.text);
    if (!q) return bad(429, 'that is ' + DAILY + ' ideas today; send more tomorrow'); // another send took the last one first
    return good({ ok: true, id: q.id, left: u.left - 1 });
  } catch (_) { return bad(503, 'your idea was not sent; try again'); }
}
