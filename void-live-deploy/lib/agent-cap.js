// The agent's allowance (functions/api/agent.js), in one place. Atom's rule (2026-11-20): Verse is not capped by a number it made up. Capacity is real
// capacity: Workers AI, then every free provider with a key, rotated until each is out (lib/agent-providers.js). What stays here is one per-visitor abuse limit,
// generous for a real person, and the pot as the last resort: when every free provider is out and Verse's own pot (the infrastructure bucket of the
// treasury) holds money, the task is paid from it like the coder's paid path (#3009), inside a daily paid ceiling that protects the money. When nothing can answer,
// the visitor is told so kindly, with what happens next and the UniVerse page, never an alert or a blank. The house lane that tests the agent is let past the
// visitor limit with the owner's key (a signed Authorization header, lib/guard.js ownerOk), so a test run never eats a visitor's tasks.
// Tests: tools/agent-cap.test.mjs.
import { cap, uncap, dayOf } from './daily-cap.js';
import { exhausted } from './agent-providers.js';
import { balances } from './treasury.js';
import { ownerOk } from './guard.js';

export const LIMITS = Object.freeze({ perIp: 100, paidAll: 100, minPotCents: 2 });
export const OFFER = Object.freeze({ label: 'See UniVerse', url: '/gate' });
const TREASURY = 'CREATE TABLE IF NOT EXISTS void_treasury (id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, bucket TEXT, cents INTEGER NOT NULL, purpose TEXT, expected TEXT, actual TEXT, status TEXT, needs TEXT, ref TEXT, data TEXT)';

/** cents in the infrastructure pot, or 0 when the ledger cannot be read. */
export async function potCents(env) {
  try {
    if (!env || !env.DB) return 0;
    await env.DB.prepare(TREASURY).run();
    const rows = (await env.DB.prepare('SELECT kind, bucket, cents FROM void_treasury').all()).results || [];
    return balances(rows).pots.infrastructure || 0;
  } catch (_) { return 0; }
}
/** one paid agent answer, already made, taken from the infrastructure pot (at least one cent). Returns the cents taken. */
export async function billPot(env, cents, model) {
  const n = Math.max(1, Math.ceil(Number(cents) || 0));
  await env.DB.prepare(TREASURY).run();
  await env.DB.prepare('INSERT INTO void_treasury (id, at, kind, bucket, cents, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('agent-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), new Date().toISOString(), 'spend', 'infrastructure', n, 'agent task past the free tasks (' + String(model).slice(0, 60) + ')', 'executed').run();
  return n;
}
/** the next UTC midnight, when the free tasks come back. Pure. */
export const resetsAt = (now = Date.now()) => new Date(Date.parse(dayOf(now) + 'T00:00:00Z') + 864e5).toISOString();
/** what a visitor gets when nothing can take their task: a clear, kind message and where to go. reason 'visitor' = this visitor's own day limit; 'exhausted' = every free provider and the pot are out. Pure. */
export function capReply(reason = 'exhausted', now = Date.now()) {
  const say = reason === 'visitor'
    ? 'You have sent ' + LIMITS.perIp + ' tasks today, which is the most one visitor can ask in a day so everyone gets a turn. It resets at midnight UTC (7 PM Eastern).'
    : 'Every free model Verse can reach is used up for today, and Verse\'s own pot cannot cover more right now. Nothing is lost: it resets at midnight UTC (7 PM Eastern), and UniVerse is what funds more.';
  return { ok: false, capped: true, reason, say, offer: OFFER, resets: resetsAt(now) };
}
/** may this request take a task? { ok, owner } for the lane's key; { ok } when a provider can answer or the pot can pay; { ok: false, reason } when the visitor is over their own limit or everything is out. */
export async function admit(env, request, h, now = Date.now()) {
  if (await ownerOk(request, env)) return { ok: true, owner: true };
  if (!(await cap(env, 'agent:' + h, LIMITS.perIp, now)).ok) return { ok: false, reason: 'visitor' };
  if (await exhausted(env, { now }) && (await potCents(env)) < LIMITS.minPotCents) { await uncap(env, 'agent:' + h, now); return { ok: false, reason: 'exhausted' }; }
  return { ok: true };
}
