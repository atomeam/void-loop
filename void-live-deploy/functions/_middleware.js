// Full pages (a trailing slash or an html file) answer with Uni unless the visitor is the owner, on Multi, or holds a Uni pass.
// Home, APIs, assets, legal pages, checkout and health checks are not gated. A Stripe key Stripe will not accept leaves every page open.
import { gatedPath, liveState, passage, screen, gateHeaders, parseRedirects, redirectTo } from '../lib/uni.js';

let redirects = null;
async function table(env, request) {
  if (redirects) return redirects;
  if (!env || !env.ASSETS) return new Map();
  try {
    const res = await env.ASSETS.fetch(new Request(new URL('/_redirects', request.url)));
    if (res && res.ok) redirects = parseRedirects(await res.text());
  } catch (_) { redirects = new Map(); }
  return redirects;
}
function opened(res) {
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-verse-gate', 'open');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  if (!/^(GET|HEAD)$/.test(request.method) || !gatedPath(url.pathname)) return next();
  const hop = redirectTo(await table(env, request), url.pathname, url.search);
  if (hop) return new Response(null, { status: hop.status, headers: { location: new URL(hop.to, url.origin).href } });
  const live = await liveState(env);
  if (!live.on) return next();
  if (await passage(request, env)) return opened(await next());
  const probed = await next();
  if (probed.status === 404 || (probed.status >= 300 && probed.status < 400)) return probed;
  try { if (probed.body && probed.body.cancel) await probed.body.cancel(); } catch (_) {}
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers: gateHeaders() });
  return new Response(screen(live, url.pathname + url.search), { status: 200, headers: gateHeaders() });
}
