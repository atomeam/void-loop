// Owner elevator numbers. Anyone else gets the same answer as a missing page.
import { ownerOk } from '../../lib/guard.js';
import { gapText, viewModel } from '../../lib/versus-floor.js';

async function readJson(env, request, path) {
  if (!env || !env.ASSETS || !env.ASSETS.fetch) return null;
  try {
    const r = await env.ASSETS.fetch(new URL(path, request.url));
    return r && r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 404, headers: { 'cache-control': 'no-store' } });
  const verdicts = await readJson(env, request, '/versus/verdicts.json');
  const nightly = await readJson(env, request, '/progress/nightly.json');
  const exam = await readJson(env, request, '/exam/latest.json');
  const self = await readJson(env, request, '/self.json');
  const gaps = gapText({ exam, nightly, wants: self && self.open });
  return Response.json(viewModel(verdicts, gaps), { headers: { 'cache-control': 'no-store' } });
}
