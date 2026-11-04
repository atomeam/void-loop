// free-router — send each job to the best free resource that is reachable and under its quota right now, and fail over when one
// runs out (owner, 2026-11-03: free-resource arbitrage). The list is resources/free.json (one legitimate account per service, its
// terms followed, never a second account to stack quotas). Usage is lib/daily-cap.js's D1 counter (one shared row per UTC day and
// resource, key "free:<id>"), so every edge location shares one count. Pure except for the counter and the adapters passed in.
//   const plan = candidates(registry, 'llm', env)                      -> reachable resources of that kind, in registry order
//   const out  = await runJob(registry, 'llm', job, { env, adapters }) -> { ok, id, result, tried:[{id, why}] }
//   const rows = await status(registry, env)                           -> each resource with { available, why, used, dailyLimit }
// An adapter is (job, resource, env) => result; it throws an error with .status 429 (or .quota) when the provider says the quota is
// out, and the router moves to the next one and records the shortfall (lib/shortfall.js). Fail closed: no D1 means no slot is taken
// and nothing is called (the caller keeps its own free fallback, the rule lib/daily-cap.js set).
import { cap, peek } from './daily-cap.js';
import { recordShortfall } from './shortfall.js';

export const KINDS = ['llm', 'image', 'video', 'compute', 'storage', 'email', 'search', 'speech', 'dataset'];
const BINDING_ALIAS = { GITHUB: ['GITHUB_TOKEN', 'GH_TOKEN'] };
const PER_DAY = { day: 1, month: 1 / 31, year: 1 / 366 };

/** the most a resource may take in one UTC day: its daily limit, or a month's/year's share; null when the limit is not a count per period */
export function dailyLimit(r) {
  const l = r && r.limit; if (!l || !(l.n > 0)) return null;
  if (l.per === 'minute') return Math.floor(l.n * 1440);
  if (l.per === 'second') return Math.floor(l.n * 86400);
  return PER_DAY[l.per] ? Math.max(1, Math.floor(l.n * PER_DAY[l.per])) : null;
}

/** can Verse reach it today with what is set up (no new account, no spend)? { ok, why } */
export function reachable(r, env = {}) {
  const a = String((r && r.access) || '');
  if (a === 'none') return { ok: true, why: 'keyless public API' };
  if (a === 'program') return { ok: false, why: 'a program to apply for or claim: Atom acts, never routed' };
  const [type, name] = a.split(':');
  if (type === 'binding') { const keys = BINDING_ALIAS[name] || [name]; return keys.some((k) => env && env[k]) ? { ok: true, why: 'bound' } : { ok: false, why: 'binding ' + name + ' not on this deploy' }; }
  if (type === 'key') return env && env[name] ? { ok: true, why: 'key set' } : { ok: false, why: 'needs ' + name + ' (one free key, added by Atom)' };
  return { ok: false, why: 'unknown access' };
}

export function candidates(registry, kind, env = {}) {
  return ((registry && registry.resources) || []).filter((r) => r.kind === kind && r.access !== 'program' && dailyLimit(r) && reachable(r, env).ok);
}

const isQuota = (e) => e && (e.status === 429 || e.quota === true || /quota|rate.?limit|too many/i.test(String(e.message || '')));

export async function runJob(registry, kind, job, { env = {}, adapters = {}, now = Date.now() } = {}) {
  const tried = [];
  for (const r of candidates(registry, kind, env)) {
    const run = adapters[r.id]; if (typeof run !== 'function') { tried.push({ id: r.id, why: 'no adapter' }); continue; }
    const slot = await cap(env, 'free:' + r.id, dailyLimit(r), now);
    if (!slot.ok) { tried.push({ id: r.id, why: 'daily share used (or no counter)' }); continue; }
    try { return { ok: true, id: r.id, result: await run(job, r, env), tried }; } catch (e) {
      tried.push({ id: r.id, why: isQuota(e) ? 'provider quota' : 'error' });
      if (isQuota(e)) await recordShortfall(env, 'free:' + r.id, 'quota').catch(() => {});
    }
  }
  return { ok: false, id: null, result: null, tried };
}

export async function status(registry, env = {}, now = Date.now()) {
  const out = [];
  for (const r of (registry && registry.resources) || []) {
    const reach = reachable(r, env); const lim = dailyLimit(r);
    const used = reach.ok && lim ? await peek(env, 'free:' + r.id, now) : null;
    out.push({ id: r.id, kind: r.kind, name: r.name, access: r.access, limit: r.limit, signup: r.signup, terms: r.terms, confirm: !!r.confirm, note: r.note || null,
      available: reach.ok && (used == null || used < lim), why: reach.why, used, dailyLimit: lim });
  }
  return out;
}
