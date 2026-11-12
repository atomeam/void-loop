// Two fix attempts per pull request, for the copy rewriter and the conflict fixer. The count is one hidden
// comment (an HTML comment, so GitHub does not show it). The third attempt does not push another commit.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CAP = 2;
export const MARK = '<!-- fix-cap';
const KINDS = ['copy', 'conflict'];

export function readCap(comments) {
  const hit = (comments || []).find((c) => String(c && c.body || '').startsWith(MARK));
  const counts = { copy: 0, conflict: 0 };
  const m = hit && String(hit.body).match(/copy=(\d+)\s+conflict=(\d+)/);
  if (m) { counts.copy = +m[1]; counts.conflict = +m[2]; }
  return { id: hit && hit.id, counts };
}

/** The next attempt. allowed is false once this kind has already been used CAP times. Pure. */
export function claim(comments, kind) {
  if (!KINDS.includes(kind)) return { allowed: false, count: 0, body: '' };
  const cur = readCap(comments);
  const count = cur.counts[kind];
  if (count >= CAP) return { allowed: false, count, id: cur.id, body: format(cur.counts) };
  const next = { ...cur.counts, [kind]: count + 1 };
  return { allowed: true, count: next[kind], id: cur.id, body: format(next) };
}

const format = (counts) => MARK + ' copy=' + counts.copy + ' conflict=' + counts.conflict + ' -->';

/** Run write() only when this kind still has an attempt. The copy rewriter and the conflict fixer both use this. */
export function guarded(comments, kind, write) {
  const cap = claim(comments, kind);
  if (!cap.allowed) return { ...cap, wrote: false };
  return { ...cap, wrote: write() !== false };
}

function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : ''; }

function cli(argv) {
  const kind = arg('--kind', argv), pr = arg('--pr', argv), repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
  if (argv[0] !== 'claim' || !/^\d+$/.test(pr) || !repo || (kind !== 'copy' && kind !== 'conflict')) { console.error('usage: node tools/fix-cap.mjs claim --pr <n> --kind copy|conflict'); return 2; }
  const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input });
  let comments = [];
  try { comments = JSON.parse(gh(['api', '--paginate', `repos/${repo}/issues/${pr}/comments?per_page=100`])); } catch (_) { comments = []; }
  const cap = claim(Array.isArray(comments) ? comments : [], kind);
  if (!cap.allowed) { console.log('fix-cap: ' + kind + ' already tried ' + cap.count + ' times'); return 1; }
  const args = cap.id ? ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${cap.id}`, '--input', '-'] : ['api', '-X', 'POST', `repos/${repo}/issues/${pr}/comments`, '--input', '-'];
  try { gh(args, JSON.stringify({ body: cap.body })); } catch (_) { console.log('fix-cap: the count was not saved'); return 1; }
  console.log('fix-cap: ' + kind + ' attempt ' + cap.count);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(cli(process.argv.slice(2)));
