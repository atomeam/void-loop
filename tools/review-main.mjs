// Verse's review of its own skills on main becomes work (asked by Verse, ask-20261012-1942-1: "Connect the 'closer read' output to my
// growth inbox so that identified code discrepancies automatically create a task to refine the affected skill"). The same checks
// Verse's review runs on a PR (void-live-deploy/lib/code-review.js ruleReview, the quick checks of tools/review-pr.mjs) are run over
// every skill file as it stands on main; the first bug or risk nobody has waived becomes one job in the build queue (/api/queue,
// the owner token, as .github/workflows/probe-asks.yml queues `probe:` jobs): target `review:<skill>`, the ask one line naming the
// file, the line and the finding. One review job open at a time; a finding already queued once (open or done, the same line) is
// not queued again; the words are Verse's own review, never a visitor's. The fix is still a builder's.
//   node tools/review-main.mjs           review and queue (VOID_OWNER_TOKEN; without it a quiet no-op, exit 0)
//   node tools/review-main.mjs --dry     review and print what would be queued
//   node tools/review-main.mjs --list    print every open finding, in the order they would be queued
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleReview, skippedInReview } from '../void-live-deploy/lib/code-review.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILLS = resolve(root, 'void-live-deploy/skills');
export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const PREFIX = 'review:';

/** the bugs and risks in skill files, as the PR review would report them, waived lines and skipped files left out; file then line. Pure. */
export function findings(texts, review = ruleReview) {
  const out = [];
  for (const [file, text] of Object.entries(texts).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (skippedInReview('void-live-deploy/skills/' + file) || /void-review: skip-file/.test(text) || text.length > 2e6) continue;
    const src = String(text).split('\n');
    let res; try { res = review(text, { lang: 'javascript', max: 5000, collapse: false }); } catch (_) { continue; }
    for (const f of (res && res.findings) || []) {
      if (f.kind !== 'bug' && f.kind !== 'risk' || f.rule === 'conflict-markers') continue;
      if (/void-review:\s*ok\b/.test(src[f.line - 1] || '')) continue;
      out.push({ file, line: f.line, kind: f.kind, rule: f.rule, message: String(f.message || '') });
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

/** the skill a file belongs to: skills/mini/chess.js -> chess, skills/forge-rules.js -> forge-rules */
export const skillOf = (file) => String(file).replace(/^.*\//, '').replace(/\.js$/, '');
/** one finding as a queue job: { ask, target, note }; the ask is Verse's review in one line (200 characters, the queue's limit). Pure. */
export function jobOf(f) {
  const where = 'skills/' + f.file + ':' + f.line;
  return {
    target: (PREFIX + skillOf(f.file)).slice(0, 40),
    ask: ('review ' + where + ' (' + f.kind + ', ' + f.rule + '): ' + f.message).slice(0, 200),
    note: ('Verse\'s own review of the skill as it stands on main (tools/review-main.mjs, the quick checks of lib/code-review.js), not a visitor\'s words. Fix the line, or mark it right as written with a void-review: ok comment.').slice(0, 300),
  };
}

/** What to queue: the first finding whose job is not in the queue yet, while no review job is open. Pure. */
export function plan(fs, queue) {
  const items = (queue && queue.items) || [];
  const open = items.filter((i) => i && String(i.target || '').startsWith(PREFIX) && /^(queued|building)$/.test(i.state));
  const seen = new Set(items.map((i) => i && (i.target + '|' + i.ask)));
  const jobs = (fs || []).map(jobOf), fresh = jobs.filter((j) => !seen.has(j.target + '|' + j.ask));
  return { open: open.length, fresh, queue: open.length ? [] : fresh.slice(0, 1), skipped: jobs.length - fresh.length };
}

export const summary = ({ found, fresh, queued, open, dry }) => [
  '### Verse reviewed its skills on main',
  '',
  '| What | How many |', '|:--|--:|',
  '| bugs and risks in skill files, not waived | ' + found + ' |', '| not queued before | ' + fresh + ' |', '| review jobs already open | ' + open + ' |',
  '| queued for the builders | ' + (dry ? 'none (dry)' : queued.map((j) => '`' + j.target + '`').join(', ') || 0) + ' |',
].join('\n');

export function readSkills(dir = SKILLS) {
  const out = {};
  const walk = (d, pre) => { for (const n of readdirSync(resolve(dir, d)).sort()) { const p = resolve(dir, d, n), rel = pre + n; try { if (readdirSync(p)) { walk(d + '/' + n, rel + '/'); continue; } } catch (_) {} if (/\.js$/.test(n)) out[rel] = readFileSync(p, 'utf8'); } };
  walk('.', '');
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), dry = args.includes('--dry'), list = args.includes('--list');
  const fs = findings(readSkills());
  if (list) { for (const f of fs) console.log(jobOf(f).target.padEnd(28) + jobOf(f).ask); console.log(fs.length + ' open finding' + (fs.length === 1 ? '' : 's')); process.exit(0); }
  const tok = (process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN || '').trim();
  if (!tok && !dry) { console.log('review-main: no VOID_OWNER_TOKEN, nothing queued (' + fs.length + ' open findings)'); process.exit(0); }
  const api = async (path, method = 'GET', body) => {
    const headers = { 'user-agent': 'a2m-review-main/1.0', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(body ? { 'content-type': 'application/json' } : {}) };
    const res = await fetch(SITE + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(path + ' answered ' + res.status);
    return res.json();
  };
  let q = { items: [] };
  try { if (tok) q = await api('/api/queue'); } catch (e) { console.error('review-main: could not read the queue: ' + e.message); if (!dry) process.exit(2); }
  const p = plan(fs, q), queued = [];
  if (!dry) for (const job of p.queue) {
    try {
      const r = await api('/api/queue', 'POST', { ask: job.ask, target: job.target }), it = r.item || {};
      if (it.id && it.ask === job.ask) { await api('/api/queue', 'PATCH', { id: it.id, note: job.note }); queued.push({ ...job, id: it.id }); }
    } catch (e) { console.error('review-main: could not queue ' + job.target + ': ' + e.message); }
  }
  console.log(summary({ found: fs.length, fresh: p.fresh.length, queued: dry ? p.queue : queued, open: p.open, dry }));
  if (dry && p.queue.length) console.log('\nwould queue: ' + p.queue[0].target + ' · ' + p.queue[0].ask);
}
