// The rival feature files (/rivals/index.json, /rivals/<site>.json) name the sites Versus is measured against, so they answer only the owner (the key,
// an owner session or the owner's signed-in account), as the Versus view reads them. Anyone else gets the same answer as a missing file.
import { ownerOk } from '../../lib/guard.js';

export async function onRequest({ request, env }) {
  if (!/^(GET|HEAD)$/.test(request.method) || !(await ownerOk(request, env)) || !env || !env.ASSETS) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  const res = await env.ASSETS.fetch(request);
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'private, no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
