// The done gate for team jobs (coordinator, 2026-10-30: Beam closed three versus jobs with pull requests that added a target note and
// no page, and the queue called them done). An agent hands a job in with its pull request (functions/api/team.js `done`), which leaves
// the job `building` with the note "review by team:<name> · PR: <link>". This script checks each one after its merge:
//   - the pull request merged (closed without merging: back on the queue);
//   - it changes the page or the code itself, not only notes (domains/, docs/, *.md);
//   - a versus job changes a page (void-live-deploy/<page>/index.html) or a page's engine (void-live-deploy/lib/);
//   - it takes nothing away from main: no file removed, and not more lines taken away than added past a small edit (a branch
//     built on an old copy of main carries those deletions);
//   - the deploy holds its merge, and the page it changed answers on a-to-mind.com.
// Pass: the job goes live ("live: <pr> · checked <page>"). Fail: back on the queue with why and one more try. Open, or not deployed
// yet: it waits for the next run. Runs in .github/workflows/team-gate.yml; the repository is public, so it prints job ids, pull
// request numbers and verdicts, never a job's text.
//   node tools/team-gate.mjs [--dry]
// Needs VOID_OWNER_TOKEN (the Pages READ_TOKEN) and gh with a token; without the owner token it says so and exits 0.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backNote, kindOf } from '../void-live-deploy/lib/team.js';

export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const REPO = 'atomeam/void-loop';
const PR_RE = /^review by team:([^·]+?) · PR: (https:\/\/github\.com\/atomeam\/void-loop\/pull\/(\d+))\b/;
const NOTES = /^(domains\/|docs\/)|\.md$/i;
const PAGE = /^void-live-deploy\/([a-z0-9][a-z0-9-]*)\/index\.html$/;
const ENGINE = /^void-live-deploy\/lib\/[^/]+\.js$/;
export const SMALL = 40; // lines a fix may take away without question

/** the handed-in job a queue row is: { agent, url, number } or null. Pure. */
export function handedIn(job) {
  const m = PR_RE.exec(String((job && job.note) || ''));
  return job && job.state === 'building' && m ? { agent: m[1].trim(), url: m[2], number: Number(m[3]) } : null;
}

/** the pages a pull request changes: ['/slug/']. Pure. */
export const pagesOf = (files) => (files || []).map((f) => PAGE.exec(f.filename)).filter(Boolean).map((m) => '/' + m[1] + '/');

/** the verdict on one handed-in job from its pull request and files, before the deploy and the live page are read:
 * { wait } | { back } | { pages } (pages to check live). Pure. */
export function judge(job, pr, files) {
  if (!pr) return { wait: 'pull request not read' };
  if (pr.state === 'open') return { wait: 'pull request still open' };
  if (!pr.merged_at) return { back: 'its pull request closed without merging' };
  const fs = files || [], removed = fs.filter((f) => f.status === 'removed').length;
  if (removed) return { back: 'its pull request removes ' + removed + ' file' + (removed > 1 ? 's' : '') + ': built on an old copy of main?' };
  const adds = fs.reduce((n, f) => n + (f.additions || 0), 0), dels = fs.reduce((n, f) => n + (f.deletions || 0), 0);
  if (dels > SMALL && dels > adds) return { back: 'its pull request takes away more than it adds (' + dels + ' lines out, ' + adds + ' in): built on an old copy of main?' };
  if (!fs.some((f) => !NOTES.test(f.filename))) return { back: 'its pull request changes only notes, not the page or the code' };
  const pages = pagesOf(fs);
  if (kindOf(job.target) === 'versus' && !pages.length && !fs.some((f) => ENGINE.test(f.filename))) return { back: 'a versus job needs the page itself; its pull request changes no page' };
  return { pages };
}

/** what a live page answered says it works: 200 and an HTML page with a body. Pure. */
export const pageOk = (status, text) => status === 200 && /<html[\s>]/i.test(String(text || '')) && String(text).length > 500;

const owner = () => process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN || '';
const headers = (json) => ({ authorization: 'Bearer ' + owner(), 'user-agent': 'a2m-team-gate/1.0', ...(json ? { 'content-type': 'application/json' } : {}) });
const gh = (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60e3 }) || 'null');

/** the newest successful deploy holds this merge commit (the compare from the merge to the deploy is ahead or identical) */
function deployed(sha) {
  const runs = gh(`repos/${REPO}/actions/workflows/deploy.yml/runs?status=success&per_page=1`);
  const head = runs && runs.workflow_runs && runs.workflow_runs[0] && runs.workflow_runs[0].head_sha;
  if (!head) return false;
  const c = gh(`repos/${REPO}/compare/${sha}...${head}`);
  return c && (c.status === 'ahead' || c.status === 'identical');
}

async function move(id, state, note, dry) {
  if (dry) return 'would move to ' + state;
  const res = await fetch(SITE + '/api/queue', { method: 'PATCH', headers: headers(true), body: JSON.stringify({ id, state, note: note.slice(0, 300) }) });
  return res.ok ? '-> ' + state : 'not moved: HTTP ' + res.status;
}

async function main() {
  const dry = process.argv.includes('--dry');
  if (!owner()) { console.log('team gate: no VOID_OWNER_TOKEN, nothing checked'); return 0; }
  const res = await fetch(SITE + '/api/queue?state=building&limit=500', { headers: headers() });
  if (!res.ok) { console.log('team gate: GET /api/queue answered HTTP ' + res.status); return 1; }
  const jobs = ((await res.json()).items || []).map((j) => ({ j, h: handedIn(j) })).filter((x) => x.h);
  console.log('team gate: ' + jobs.length + ' handed-in job' + (jobs.length === 1 ? '' : 's') + ' to check');
  for (const { j, h } of jobs) {
    let v;
    try {
      const pr = gh(`repos/${REPO}/pulls/${h.number}`);
      v = judge(j, pr, pr && pr.merged_at ? gh(`repos/${REPO}/pulls/${h.number}/files?per_page=100`) : []);
      if (v.pages) {
        if (!deployed(pr.merge_commit_sha)) v = { wait: 'its merge is not deployed yet' };
        else {
          const read = (p) => fetch(SITE + p, { redirect: 'follow', signal: AbortSignal.timeout(30e3) })
            .then(async (r) => ({ p, status: r.status, text: await r.text().catch(() => '') }), () => ({ p, status: 0, text: '' }));
          const bad = (await Promise.all(v.pages.map(read))).find((r) => !pageOk(r.status, r.text));
          v = bad ? { back: 'the live page ' + bad.p + ' answered ' + (bad.status ? 'HTTP ' + bad.status : 'nothing') }
            : { live: 'live: ' + h.url + (v.pages.length ? ' · checked ' + v.pages.join(' ') : '') };
        }
      }
    } catch (e) { v = { wait: 'not read: ' + String((e && e.message) || e).slice(0, 80) }; }
    const line = j.id + ' (#' + h.number + ', ' + kindOf(j.target) + '): ';
    if (v.wait) console.log(line + 'waits, ' + v.wait);
    else if (v.back) console.log(line + 'back, ' + v.back + ' ' + await move(j.id, 'queued', backNote(j.note.replace(/^review by team:[^·]*·\s*PR: \S+\s*·?\s*/, ''), v.back + ' (' + h.url + ')', true), dry));
    else console.log(line + 'done ' + await move(j.id, 'live', v.live, dry));
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c), (e) => { console.error('team gate: ' + ((e && e.message) || e)); process.exit(1); });
