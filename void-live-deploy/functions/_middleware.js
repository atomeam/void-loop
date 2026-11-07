// The members-only gate for the nav's pages (lib/member-gate.js has the list and the cookie).
// A member is a paid team member (a $1 Join the Team trial, or any store product), a paid Verse account, or the owner.
// No cookie, an expired cookie, a removed membership or a finished trial: the visitor gets the public /join/ offer, with the
// page they wanted in ?next= so joining returns them there. The API is not gated here (each route has its own key or session);
// /team/join/, /team/mcp and /team/agents.txt stay open so agents can still join and work.
import { gatedPath, cookieValue, readSession, memberOk } from '../lib/member-gate.js';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  if (!gatedPath(url.pathname)) return next();
  const secret = env.SESSION_KEY || env.SALT;
  let ok = false;
  if (secret) {
    const token = cookieValue(request);
    const payload = token ? await readSession(token, secret).catch(() => null) : null;
    ok = payload ? await memberOk(payload, env) : false;
  }
  if (ok) return next();
  const to = new URL('/join/', url);
  to.searchParams.set('next', url.pathname + url.search);
  return new Response(null, { status: 302, headers: { location: to.toString(), 'cache-control': 'no-store' } });
}
