// What a push to helper/* does (owner, 2026-11-05: a helper branch, Grok's included, opens its own automerge
// pull request, rebases when it is behind main, and a failed review or test becomes a heal job instead of
// dropping the idea). The workflow .github/workflows/helper-pr.yml acts on this plan. Pure: no git, no network.
import { blocksOf, publicBlocks } from '../void-live-deploy/lib/inbox-blocks.js';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'branch';
const hash = (s) => { let h = 2166136261; for (const c of String(s).toLowerCase()) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/**
 * The plan for one helper push.
 * branch, ahead (commits main lacks), behind (commits the branch lacks), hasPr, skillsFail ('' or why).
 * { rebase, open, label, skip, heal, wake }
 * wake: this push should start automerge. A pull request opened by the workflow token leaves its
 * checks approval-required, and automerge is what starts them (tools/loop-checks.mjs). A later push
 * of a fix has to wake it again, or the repair never gets a review.
 */
export function plan({ branch = '', ahead = 0, behind = 0, hasPr = false, skillsFail = '' } = {}) {
  const helper = String(branch).startsWith('helper/');
  const out = { rebase: helper && behind > 0, open: false, label: 'automerge', skip: '', heal: null, wake: false };
  if (!helper) { out.rebase = false; out.skip = 'not a helper branch'; return out; }
  if (!(ahead > 0)) { out.skip = 'nothing main lacks'; return out; }
  out.wake = true;
  out.open = !hasPr;
  if (hasPr) out.skip = 'already has an open pull request';
  if (skillsFail) {
    out.heal = {
      ask: ('Repair ' + branch + ' until it lands: ' + String(skillsFail).replace(/\s+/g, ' ').trim()).slice(0, 200),
      target: ('heal:' + slug(branch)).slice(0, 40),
    };
  }
  return out;
}

/** public Growth inbox item blocks in committed or pasted text become build jobs. A private block does not. Pure. */
export function inboxJobs(text) {
  const seen = new Set();
  const jobs = [];
  for (const b of publicBlocks(blocksOf(text))) {
    const ask = b.ask.replace(/\s+/g, ' ').trim().slice(0, 200);
    const target = ('feature:inbox-' + hash(ask)).slice(0, 40);
    if (!ask || seen.has(target)) continue;
    seen.add(target);
    jobs.push({ ask, target });
  }
  return jobs;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}

async function readIn() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  if (process.argv.includes('--inbox')) {
    process.stdout.write(JSON.stringify(inboxJobs(await readIn())) + '\n');
    return;
  }
  const p = plan({
    branch: arg('--branch'),
    ahead: Number(arg('--ahead') || 0),
    behind: Number(arg('--behind') || 0),
    hasPr: arg('--pr') === '1',
    skillsFail: arg('--fail'),
  });
  process.stdout.write(JSON.stringify(p) + '\n');
}

if (process.argv[1] && process.argv[1].endsWith('helper-pr.mjs')) await main();
