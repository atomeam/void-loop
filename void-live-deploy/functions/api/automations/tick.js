// The clock for Void's automations: POST /api/automations/tick (owner token) runs every scheduled rule that is due.
// Called every 15 minutes by .github/workflows/void-tick.yml today; a Cloudflare cron Worker can call the same route later.
import { ownerOk } from '../../../lib/guard.js';
import { tick } from '../../../lib/automations-run.js';

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  try { return Response.json(await tick(env)); } catch (_) { return new Response('tick error', { status: 500 }); }
}
