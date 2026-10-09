// Void's own automations (lib/automations.js, lib/automations-run.js): the owner's "when this happens, do that" rules.
// GET -> { rules, runs, templates, repos } · POST { rule, rotate? } makes or replaces one (a webhook rule's secret is
// returned once) · POST { id, run: true, event? } runs one now · PATCH { id, enabled } · DELETE { id } — all owner token.
import { ownerOk } from '../../lib/guard.js';
import { TEMPLATES, repoList } from '../../lib/automations.js';
import * as A from '../../lib/automations-run.js';

const body = async (req) => { try { return JSON.parse(await req.text()); } catch (_) { return {}; } };
const guard = (fn) => async (ctx) => {
  if (!(await ownerOk(ctx.request, ctx.env))) return new Response('no', { status: 401 });
  try { return await fn(ctx); } catch (e) { return new Response('automations error', { status: 500 }); }
};
const view = async (env) => ({ ...(await A.list(env)), templates: TEMPLATES, repos: repoList(env), github: !!env.GITHUB_TOKEN });

export const onRequestGet = guard(async ({ env }) => Response.json(await view(env)));

export const onRequestPost = guard(async ({ request, env }) => {
  const b = await body(request);
  if (b.run) {
    const r = await A.get(env, b.id);
    if (!r) return Response.json({ error: 'no such rule' }, { status: 404 });
    const out = await A.run(env, r.rule, b.event && typeof b.event === 'object' ? b.event : { manual: true, at: new Date().toISOString() }, 'manual'); // Run now carries the time, like a tick
    return Response.json({ run: out, ...(await view(env)) });
  }
  const saved = await A.save(env, b.rule, { rotate: !!b.rotate });
  if (!saved.ok) return Response.json({ errors: saved.errors }, { status: 400 });
  return Response.json({ saved, ...(await view(env)) });
});

export const onRequestPatch = guard(async ({ request, env }) => {
  const b = await body(request);
  if (!(await A.setEnabled(env, b.id, !!b.enabled))) return Response.json({ error: 'no such rule' }, { status: 404 });
  return Response.json(await view(env));
});

export const onRequestDelete = guard(async ({ request, env }) => {
  const b = await body(request);
  if (!(await A.remove(env, b.id))) return Response.json({ error: 'no such rule' }, { status: 404 });
  return Response.json(await view(env));
});
