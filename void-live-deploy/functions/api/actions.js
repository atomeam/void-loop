// The execution record (lib/actions.js): GET -> { actions } newest first, owner token only. ?limit=N (up to 500),
// ?owner=... to filter by who an action was for. Nothing here takes an action; it only shows what Void did.
import { ownerOk } from '../../lib/guard.js';
import { recent } from '../../lib/actions.js';

export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  if (!env.DB) return new Response('no database', { status: 503 });
  const u = new URL(request.url);
  try { return Response.json({ actions: await recent(env, { limit: u.searchParams.get('limit'), owner: u.searchParams.get('owner') || undefined }) }); }
  catch (_) { return new Response('actions error', { status: 500 }); }
}
