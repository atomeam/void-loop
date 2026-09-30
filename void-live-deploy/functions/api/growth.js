// Void's growth (lib/growth.js): Void's level, its mass, and everything it has absorbed. Public.
// With the owner key it also lists every link (connected or not) and the one step that connects each missing one.
// A wrong key is a 401 (not the public view), so guessing keys still counts toward the lockout in the /api middleware.
import { ownerOk } from '../../lib/guard.js';
import { growth } from '../../lib/growth.js';
export async function onRequestGet({ request, env }) {
  const asked = !!request.headers.get('authorization');
  if (asked && !(await ownerOk(request, env))) return new Response('no', { status: 401 });
  return Response.json(growth(env, { owner: asked }), { headers: { 'cache-control': asked ? 'no-store' : 'public, max-age=300' } });
}
