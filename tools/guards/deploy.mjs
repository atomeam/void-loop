// Deploy self-check: a main deploy (or the checks around it) went red or rolled back. The Actions failure reader (actions-failures.yml) already writes one
// file per red run to void-live-deploy/incidents/actions/. This reads the new ones, says why, and acts on the cause on its own:
//   a generated inventory out of date  -> run its generator on a helper branch (the pull request opens by itself)
//   a live check fetching an owner-only file -> take that check out of deploy.yml on a helper branch (needs a token that may change workflows; if refused, the exact change goes to the coder)
//   anything else -> a heal job for the coder with the failed step and its first error line
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownerOnlyPath } from '../../void-live-deploy/lib/owner-gate.js';

export const WORKFLOWS = ['Verse deploy', 'Pages guard', 'MCP live', 'deploy workers'];
export const FRESH_MS = 24 * 3600e3, KEEP_HANDLED = 60;
// generators that are safe to run for a stale-inventory failure (never the skill index: it is not committed by hand or by a bot)
export const REGEN = Object.freeze({ parity: ['tools/parity.mjs', '--write'], 'similar-index': ['tools/similar-index.mjs'] });

const lines = (inc) => (inc.jobs || []).flatMap((j) => [...(j.fails || []), ...(j.tail || [])]).map(String);
/** why one red run failed, and what to do. Pure. */
export function diagnose(inc) {
  const all = lines(inc), step = ((inc.jobs || []).find((j) => j.step) || {}).step || {}, first = (all.find((l) => /FAIL|error|Error|::error/.test(l)) || all[0] || '').replace(/\s+/g, ' ').slice(0, 160);
  for (const l of all) {
    const m = /out of date, run node (tools\/[\w-]+\.mjs)(?: (--write))?/.exec(l) || /(tools\/[\w-]+\.mjs) --write/.exec(l);
    const id = m && Object.keys(REGEN).find((k) => m[1].includes(k));
    if (id) return { cause: 'a generated inventory is out of date (' + id + ')', fix: { kind: 'regen', id }, step: step.name || '', first };
  }
  for (const l of all) {
    const m = /a-to-mind\.com(\/[^\s:]*) (?:is not serving this deploy|HTTP (?:403|404)|does not carry)/.exec(l);
    if (m && ownerOnlyPath(m[1])) return { cause: 'the live check fetched ' + m[1] + ', which answers only the owner', fix: { kind: 'workflow-line', path: m[1] }, step: step.name || '', first };
  }
  return { cause: 'a failed step: ' + (step.name || 'unnamed'), fix: { kind: 'heal' }, step: step.name || '', first };
}
/** the red runs on main in the last day that the guard has not handled yet. Pure. */
export function freshRuns(incidents, handled, now) {
  return incidents.filter((i) => i && WORKFLOWS.includes(i.workflow) && i.branch === 'main' && /failure|timed_out/.test(i.conclusion || '') && now - Date.parse(i.at || 0) < FRESH_MS && !handled.includes(String(i.runId)));
}
/** deploy.yml without the live-check lines that fetch one owner-only path. Pure. */
export function withoutCheck(yml, path) {
  const out = String(yml).split('\n').filter((l) => !(/^\s*check\s+\S+\s+\S+/.test(l) && l.trim().split(/\s+/)[1] === path));
  return out.join('\n');
}
export const healTarget = (runId) => ('heal:deploy-' + String(runId).slice(-8));

export async function run(ctx) {
  const dir = join(ctx.root, 'void-live-deploy/incidents/actions');
  const incidents = (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().slice(-60) : []).map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; } }).filter(Boolean);
  const prev = ctx.prev && ctx.prev.state && ctx.prev.state.handled ? ctx.prev.state.handled : [];
  const fresh = freshRuns(incidents, prev, ctx.now);
  const note = 'No model call. Reads the failure files already in the repo.';
  if (!fresh.length) return { last: 'No main deploy or live check has failed in the last day that this guard has not already looked at.', ok: true, note, state: { handled: prev.slice(-KEEP_HANDLED) } };
  const said = [], handled = [...prev];
  for (const inc of fresh.slice(0, 3)) {
    const d = diagnose(inc);
    let did = '';
    if (d.fix.kind === 'regen') {
      const [tool, ...args] = REGEN[d.fix.id];
      const r = ctx.dry ? { pushed: false, why: 'dry run' } : ctx.editOnBranch('helper/regen-' + d.fix.id + '-' + String(inc.runId).slice(-6), 'Regenerate the ' + d.fix.id + ' inventory (a main check failed because it was out of date)', (wt) => { const x = ctx.spawn('node', [tool, ...args], wt); const st = ctx.spawn('git', ['status', '--porcelain'], wt).stdout || ''; return x.status === 0 && st.trim() && !/skills\/index\.json/.test(st); });
      did = r.pushed ? 'Regenerated it on ' + r.branch + ' (its pull request opens by itself).' : 'Tried to regenerate it: ' + r.why + '.';
    } else if (d.fix.kind === 'workflow-line') {
      const r = ctx.dry ? { pushed: false, why: 'dry run' } : ctx.editOnBranch('helper/deploy-check-' + String(inc.runId).slice(-6), 'Deploy check: stop fetching ' + d.fix.path + ', which answers only the owner', (wt) => { const f = join(wt, '.github/workflows/deploy.yml'); const a = readFileSync(f, 'utf8'), b = withoutCheck(a, d.fix.path); if (a === b) return false; writeFileSync(f, b); return true; });
      if (r.pushed) did = 'Took the check out of deploy.yml on ' + r.branch + ' (its pull request opens by itself).';
      else { const q = await ctx.queueJob('Deploy check fetches ' + d.fix.path + ', which answers only the owner. Remove that check line from .github/workflows/deploy.yml (or skip owner-only paths with ownerOnlyPath).', healTarget(inc.runId)); did = 'Could not push the change (' + r.why + '). Handed it to the coder (' + (q.queued ? 'queued' : q.why) + ').'; }
    } else {
      const q = await ctx.queueJob('A main run failed in "' + d.step + '": ' + d.first + ' (run ' + inc.runId + ').', healTarget(inc.runId));
      did = 'Handed it to the coder (' + (q.queued ? 'queued' : q.why) + ').';
    }
    handled.push(String(inc.runId));
    said.push(inc.workflow + ' run ' + String(inc.runId).slice(-6) + ' failed because ' + d.cause + '. ' + did);
  }
  return { last: said.join(' '), ok: true, note, state: { handled: handled.slice(-KEEP_HANDLED) } };
}
