// What Void has earned (plan item 12), for the owner and the will engine only. Never shown on the page.
// GET (Bearer READ_TOKEN) -> { gross_cents, refunded_cents, earned_cents, budget_cents, sales, milestones: [{ id, at, earned_cents, note }] }
import { ownerOk } from '../../lib/guard.js';
import { ensureStoreTables } from '../../lib/store-db.js';
import { readEarnings, recordMilestones, listMilestones } from '../../lib/earnings.js';

export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  try {
    await ensureStoreTables(env);
    const t = await readEarnings(env);
    await recordMilestones(env, t);
    return Response.json({ ...t, milestones: await listMilestones(env) }, { headers: { 'cache-control': 'no-store' } });
  } catch (_) { return Response.json({ error: 'earnings unavailable' }, { status: 503 }); }
}
