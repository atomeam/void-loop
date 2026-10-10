// A webhook into one of Void's automations: POST /api/hook/<rule id> with the rule's secret in the x-void-hook header
// (or ?key= for senders that cannot set headers); the JSON body is the event. Wrong or missing secret = 403, the same
// answer as a rule that does not exist, so the endpoint never says which rules are there. A rule that has run its
// RUN_CAP_DAY times a day from webhooks answers 429 with the reason, so a looping sender knows to stop knocking.
import { get, hookOk, run } from '../../../lib/automations-run.js';

export async function onRequestPost({ request, env, params }) {
  const r = await get(env, params.id).catch(() => null);
  const given = request.headers.get('x-void-hook') || new URL(request.url).searchParams.get('key') || '';
  if (!r || r.rule.when.on !== 'webhook' || !(await hookOk(r.hook, given))) return new Response('no', { status: 403 });
  let event = {};
  try { event = JSON.parse(await request.text() || '{}'); } catch (_) { return new Response('the body is not JSON', { status: 400 }); }
  const out = await run(env, r.rule, event, 'webhook');
  if (out.skipped && /times a day from webhooks/.test(out.skipped)) return Response.json({ ok: false, skipped: out.skipped }, { status: 429 });
  return Response.json({ ok: out.ok, ...(out.skipped ? { skipped: out.skipped } : { steps: out.log.map((l) => ({ action: l.action, ok: l.ok })) }) });
}
