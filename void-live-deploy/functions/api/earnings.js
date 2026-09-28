// What Void has earned (plan item 12), for the owner and the will engine only. Never shown on the page.
// GET (Bearer READ_TOKEN) -> { gross_cents, refunded_cents, earned_cents, budget_cents, sales, milestones: [{ id, at, earned_cents, note }],
//                              shortfalls_7d: { total, by: [{ place, reason, n }] } }  (times the free model fell short: the case for a paid one)
import { ensureStoreTables } from '../../lib/store-db.js';
import { readEarnings, recordMilestones, listMilestones } from '../../lib/earnings.js';
import { readShortfalls } from '../../lib/shortfall.js';

export async function onRequestGet({ request, env }) {
  if (!env.READ_TOKEN || request.headers.get('authorization') !== 'Bearer ' + env.READ_TOKEN) return new Response('no', { status: 401 });
  try {
    await ensureStoreTables(env);
    const t = await readEarnings(env);
    await recordMilestones(env, t);
    return Response.json({ ...t, milestones: await listMilestones(env), shortfalls_7d: await readShortfalls(env, 7) }, { headers: { 'cache-control': 'no-store' } });
  } catch (_) { return Response.json({ error: 'earnings unavailable' }, { status: 503 }); }
}
