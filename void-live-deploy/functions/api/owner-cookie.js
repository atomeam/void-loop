// POST with the owner's key, session or account session: sets the verse_owner cookie (a fresh owner session, 30 days) that opens the owner-only files
// (lib/owner-gate.js). Anyone else gets the same answer as a missing page.
import { ownerOk, mintOwnerSession, OWNER_SESSION_TTL_MS } from '../../lib/guard.js';
import { COOKIE } from '../../lib/owner-gate.js';

export async function onRequestPost({ request, env }) {
  const no = () => new Response('no', { status: 404, headers: { 'cache-control': 'no-store' } });
  if (!(await ownerOk(request, env))) return no();
  const s = await mintOwnerSession(env, 'cookie');
  if (!s) return no();
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'set-cookie': COOKIE + '=' + s.token + '; Path=/; Max-Age=' + Math.floor(OWNER_SESSION_TTL_MS / 1000) + '; Secure; HttpOnly; SameSite=Strict' } });
}
