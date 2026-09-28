// The router's decisions (lib/router.js), owner-only: what each ask was sorted into (skill / simple / hard / fallback),
// which model answered, what would have escalated, and how long the answer waited for the router. tools/will.py reads it:
// skill near-misses become "learn to handle ..." wants, "would escalate" is evidence for the stronger-model upgrade.
import { ownerOk } from '../../lib/guard.js';
import { readRoutes } from '../../lib/router.js';
export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  try { return Response.json(await readRoutes(env)); } catch (_) { return Response.json({ total: 0, note: 'no routing log yet' }, { status: 503 }); }
}
