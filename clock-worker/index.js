// void-clock: the backstop for Verse's clock, outside GitHub (docs/systems.md, "The clock"). GitHub's scheduler starts this repo's crons
// hours late, so the conductor (grow-clock.yml) keeps time by dispatching its own next tick. If that chain ever breaks, only GitHub's late
// cron would restart it. Every 10 minutes this Worker:
//   1. reads the conductor's last tick from the conductor-state branch, and only when it is older than STALE_MIN dispatches grow-clock.yml
//      (needs the Worker secret CLOCK_GITHUB_TOKEN: a fine-grained token for atomeam/void-loop with Actions read and write, nothing else);
//   2. knocks POST /api/automations/tick on a-to-mind.com, the job void-tick.yml does now (needs VOID_OWNER_TOKEN, the Pages READ_TOKEN).
// A missing secret skips that step. It never prints a secret. Workers Free includes 5 cron triggers per account; this uses 1 and about
// 300 requests a day, so it costs $0. Deployed by .github/workflows/deploy-workers.yml when CLOUDFLARE_WORKERS_TOKEN is set.

export const REPO = 'atomeam/void-loop';
export const RECORD = 'https://raw.githubusercontent.com/' + REPO + '/conductor-state/domains/conductor.json';
export const SITE = 'https://a-to-mind.com';
export const STALE_MIN = 30;

/** the time of the conductor's newest tick in its record, or 0. Pure. */
export function lastTick(record) {
  const r = record && typeof record === 'object' ? record : {};
  const ticks = Array.isArray(r.ticks) ? r.ticks : [];
  const times = [r.updated, ...ticks.map((t) => t && t.at)].map((x) => Date.parse(x)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : 0;
}
/** should the backstop restart the conductor's chain: its newest tick is older than STALE_MIN (or cannot be read). Pure. */
export function restartDue(record, now) {
  const t = lastTick(record);
  return !t || now - t > STALE_MIN * 60000;
}

async function readRecord(fetchFn) {
  try { const r = await fetchFn(RECORD + '?t=' + Date.now(), { cf: { cacheTtl: 0 } }); return r.ok ? await r.json() : null; } catch (_) { return null; }
}
/** one beat of the clock. Returns what it did, in plain words (no secret, no token). */
export async function beat(env, now = Date.now(), fetchFn = fetch) {
  const out = { at: new Date(now).toISOString(), conductor: 'fresh', automations: 'skipped: no VOID_OWNER_TOKEN' };
  const record = await readRecord(fetchFn);
  if (restartDue(record, now)) {
    if (!env.CLOCK_GITHUB_TOKEN) out.conductor = 'stale, not restarted: no CLOCK_GITHUB_TOKEN';
    else {
      const r = await fetchFn('https://api.github.com/repos/' + REPO + '/actions/workflows/grow-clock.yml/dispatches', {
        method: 'POST', body: JSON.stringify({ ref: 'main' }),
        headers: { authorization: 'Bearer ' + env.CLOCK_GITHUB_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'void-clock', 'content-type': 'application/json' },
      }).catch(() => null);
      out.conductor = r && r.status === 204 ? 'stale: restarted grow-clock.yml' : 'stale: restart refused (' + (r ? r.status : 'no answer') + ')';
    }
  }
  if (env.VOID_OWNER_TOKEN) {
    const r = await fetchFn(SITE + '/api/automations/tick', { method: 'POST', headers: { authorization: 'Bearer ' + env.VOID_OWNER_TOKEN, 'user-agent': 'void-clock' } }).catch(() => null);
    out.automations = r && r.ok ? 'knocked' : 'refused (' + (r ? r.status : 'no answer') + ')';
  }
  return out;
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(beat(env).then((o) => console.log(JSON.stringify(o)))); },
  async fetch() { return new Response('void-clock: the backstop for Verse\'s clock (docs/systems.md). Nothing to see here.\n', { headers: { 'content-type': 'text/plain' } }); },
};
