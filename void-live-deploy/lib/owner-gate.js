// Files that name the sites Versus is measured against are served to the owner only. A visitor gets the same answer as a missing file.
// The owner is let in with the key or an owner session in an Authorization header (the same check as /api/versus-floor, lib/guard.js ownerOk), or with the
// owner session in the verse_owner cookie, which /api/owner-cookie sets once the owner check has passed. The cookie is what lets a script import or an
// image tag reach these files, since neither can send a header. It carries an owner session (vo1...), never the key, and works for reads of these files only.
import { ownerOk, ownerSessionOk, OWNER_SESSION_PREFIX } from './guard.js';

export const COOKIE = 'verse_owner';
const EXACT = new Set(['/assimilated.json', '/lib/tower.js', '/lib/tower-weight.js', '/lib/tower-journeys.js', '/lib/versus-floor.js',
  '/versus/card.js', '/versus/compare.js', '/versus/rivals.js', '/versus/assimilated.js', '/versus/obituaries.js', '/versus/universe.js', '/lib/universe.js', '/lib/universe-seeds.js', '/parity.json']);
/** true for a path only the owner may read. Pure. */
export function ownerOnlyPath(pathname) {
  const p = String(pathname || '');
  return EXACT.has(p) || /^\/(?:tower\.[^/]+|tower-evidence|rivals)(?:\/.*)?$/.test(p) || /^\/history\/[^/]+\.json$/.test(p);
}
export function cookieOf(request) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)').exec(request.headers.get('cookie') || '');
  return m ? m[1] : '';
}
/** true when the request carries the owner's key or session in a header, or the owner's session in the cookie. */
export async function ownerGate(request, env) {
  if (await ownerOk(request, env)) return true;
  const c = cookieOf(request);
  return c.startsWith(OWNER_SESSION_PREFIX) ? ownerSessionOk(c, env) : false;
}
