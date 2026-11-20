// A house lane ships its one change on the branch house/<lane>. The workflow's last step (house-loops.yml) pushes onto that branch when
// it already exists, and when the branch is left over from a pull request that is long merged (or closed) the old branch cannot take the new
// patch ("the open branch could not take this patch") and the lane ships nothing. So the lane starts by making the branch fresh: when
// house/<lane> exists on origin and has no OPEN pull request, it is deleted, and the workflow's own next step then opens a new branch from
// main and a new pull request. A branch with an open pull request is never touched. This runs only in GitHub Actions (never on a person's
// machine) and never when the answer is unclear (no answer from GitHub, or no git push right): then the branch is left alone.
//   no workflow file is edited: tools/house-loops.mjs calls freshLaneBranch before it runs the lane.
import { spawnSync } from 'node:child_process';

const REPO = () => process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';
export const branchOf = (lane) => 'house/' + String(lane || '').replace(/[^a-z0-9-]/gi, '');

/** what to do with a lane branch. Pure. exists: the branch is on origin; open: the number of open pull requests from it, or null when unknown. */
export function branchPlan({ exists, open }) {
  if (!exists) return { act: 'none', why: 'no branch from an earlier run' };
  if (open == null) return { act: 'keep', why: 'could not tell whether a pull request is open' };
  if (open > 0) return { act: 'keep', why: 'a pull request is open on it' };
  return { act: 'delete', why: 'left over: no open pull request' };
}

async function openCount(branch, fetchImpl) {
  const owner = REPO().split('/')[0], tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  try {
    const r = await fetchImpl('https://api.github.com/repos/' + REPO() + '/pulls?state=open&per_page=5&head=' + encodeURIComponent(owner + ':' + branch), { signal: AbortSignal.timeout(15000), headers: { accept: 'application/vnd.github+json', 'user-agent': 'Verse-house', ...(tok ? { authorization: 'Bearer ' + tok } : {}) } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j.length : null;
  } catch { return null; }
}
const git = (args) => spawnSync('git', args, { encoding: 'utf8', timeout: 60000 });

/** the lane's branch made fresh when it is stale. Returns what it did; never throws. deps are for the test. */
export async function freshLaneBranch(lane, { env = process.env, fetchImpl = fetch, run = git, log = console.log } = {}) {
  if (env.GITHUB_ACTIONS !== 'true') return { act: 'none', why: 'not in GitHub Actions' };
  const branch = branchOf(lane);
  try {
    const ls = run(['ls-remote', '--exit-code', '--heads', 'origin', branch]);
    const plan = branchPlan({ exists: ls.status === 0, open: ls.status === 0 ? await openCount(branch, fetchImpl) : 0 });
    if (plan.act === 'delete') {
      const del = run(['push', 'origin', '--delete', branch]);
      if (del.status !== 0) { log('house: ' + branch + ' is stale but could not be deleted; the workflow will try to push onto it'); return { act: 'keep', why: 'delete failed' }; }
      log('house: ' + branch + ' was left over from an earlier run (' + plan.why + '); deleted, so this run opens a fresh branch from main');
    }
    return plan;
  } catch (e) { return { act: 'keep', why: String((e && e.message) || e).slice(0, 120) }; }
}
