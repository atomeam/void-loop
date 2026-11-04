// When a review fails, say why on the pull request and file one fix job (Atom, 2026-11-04). A missing token
// prints the reason and exits 0: the comment is the record, the job is a courtesy.
//   node tools/review-fix-job.mjs --pr 12 --why "the merge gate failed"
import { execFileSync } from 'node:child_process';

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : ''; };

/** the queue body for one failed review. Pure. */
export function fixJob(pr, why) {
  const reason = String(why || 'the review failed').replace(/\s+/g, ' ').trim().slice(0, 240);
  return { ask: 'Fix the review on pull request #' + pr + ': ' + reason, target: 'review:' + pr };
}

export const MARK = '<!-- void-verdict -->';

export function verdictComment(action, why) {
  return MARK + '\nVerdict: ' + action + '. ' + why;
}

async function main() {
  const pr = arg('--pr'), why = arg('--why') || 'the review failed', action = arg('--action') === 'merge' ? 'merge' : 'fix';
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';
  const job = fixJob(pr || '0', why);
  const line = action === 'fix' ? job.ask : why;
  console.log(verdictComment(action, line));
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  if (token && pr && /^\d+$/.test(pr)) {
    try {
      execFileSync('gh', ['api', '-X', 'POST', 'repos/' + repo + '/issues/' + pr + '/comments', '--input', '-'], { input: JSON.stringify({ body: verdictComment(action, line) }), encoding: 'utf8' });
    } catch (e) { console.log('verdict comment: ' + String(e.message || e).slice(0, 200)); }
  }
  if (action !== 'fix') return;
  const owner = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN || '';
  if (!owner) { console.log('fix job not filed: no VOID_OWNER_TOKEN'); return; }
  try {
    const r = await fetch((process.env.VOID_SITE || 'https://a-to-mind.com') + '/api/queue', {
      method: 'POST', headers: { authorization: 'Bearer ' + owner, 'content-type': 'application/json' }, body: JSON.stringify(job),
    });
    console.log('fix job ' + r.status);
  } catch (e) { console.log('fix job: ' + e.message); }
}

if (process.argv[1] && process.argv[1].endsWith('review-fix-job.mjs')) await main();
