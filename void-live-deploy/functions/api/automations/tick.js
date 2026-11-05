// The clock for Verse's automations: POST /api/automations/tick (owner token) runs every scheduled rule that is due.
// Called every 15 minutes by .github/workflows/void-tick.yml today; a Cloudflare cron Worker can call the same route later.
// After the rules, the same knock runs Verse's crew and its wants (lib/team-crew-run.js) once the answer is sent, so a slow crew run
// never holds up or breaks the automations.
import { ownerOk } from '../../../lib/guard.js';
import { tick } from '../../../lib/automations-run.js';
import { crewTick } from '../../../lib/team-crew-run.js';
import { dueReport } from '../../../lib/verse-runs.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  const crew = () => crewTick(env).catch(() => null);
  if (typeof waitUntil === 'function') waitUntil(crew());
  try {
    const body = await tick(env);
    return Response.json({ ...body, verseRuns: dueReport(new Date()) });
  } catch (_) { return new Response('tick error', { status: 500 }); }
}
