// The agent's daily allowance (functions/api/agent.js), in one place. Atom's standing rule: a free cap is not a stop. Past the free tasks a
// visitor still gets an answer when Verse's own pot (the infrastructure bucket of the treasury) can pay for it, billed there like the coder's
// paid path (functions/api/coder.js, #3009), inside a smaller paid overflow of its own so a stranger cannot drain the pot. When the pot cannot pay,
// the visitor is told so kindly, with what happens next and the UniVerse page, never an alert or a blank. The house lane that tests the agent
// is let past every count with the owner's key (a signed Authorization header, lib/guard.js ownerOk), so a test run never eats a visitor's tasks.
// Tests: tools/agent-cap.test.mjs.
import { cap, capAll, dayOf } from './daily-cap.js';
import { balances } from './treasury.js';
import { ownerOk } from './guard.js';

export const LIMITS = Object.freeze({ perIp: 20, all: 400, paidPerIp: 10, paidAll: 100, minPotCents: 2 });
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
/** what a visitor gets when nothing can pay for their task: a clear, kind message and where to go. Pure. */
export function capReply(now = Date.now()) {
  return { ok: false, capped: true, say: 'You have used today\'s free tasks, and Verse\'s own pot cannot cover more right now. Nothing is lost: your task is still in the box, the free tasks come back at midnight UTC (7 PM Eastern), and UniVerse is what funds more.', offer: OFFER, resets: resetsAt(now) };
}
/** may this request take a task? { ok, owner } for the lane's signed key, { ok, paid: false } inside the free tasks, { ok, paid: true } when the pot pays, { ok: false } when nothing can. */
export async function admit(env, request, h, now = Date.now()) {
  if (await ownerOk(request, env)) return { ok: true, owner: true, paid: false };
  if ((await capAll(env, [['agent:' + h, LIMITS.perIp], ['agent-all', LIMITS.all]], now)).ok) return { ok: true, paid: false };
  if ((await potCents(env)) < LIMITS.minPotCents) return { ok: false };
  if ((await capAll(env, [['agent-paid:' + h, LIMITS.paidPerIp], ['agent-paid-all', LIMITS.paidAll]], now)).ok) return { ok: true, paid: true };
  return { ok: false };
}
