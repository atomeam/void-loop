// node tools/review-post.mjs <comments.json> --repo owner/name --pr N --sha HEAD_SHA
// Posts Void's inline review (the JSON from `review-pr.mjs --inline`) as one GitHub review of kind COMMENT on the PR's
// head commit. A line that already has Void's comment for the same checks is skipped, so a re-run on every push adds
// only what is new. Needs GH_TOKEN (pull-requests: write); uses the gh CLI. Never fails the build: errors are printed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const repo = arg('--repo'), pr = arg('--pr'), sha = arg('--sha');
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 << 20 });

// which (path, line, checks) already carry Void's comment: the marker holds the check names
export function postedKeys(existing) {
  const keys = new Set();
  for (const c of existing || []) { const m = String(c.body || '').match(/<!-- void-review-inline ([\w -]+) -->/); if (m && c.path) keys.add(c.path + ':' + (c.line || c.original_line) + ':' + m[1].trim()); }
  return keys;
}
export function fresh(comments, keys) { return comments.filter((c) => !keys.has(c.path + ':' + c.line + ':' + (c.rules || []).join(' '))); }

if (process.argv[1] && process.argv[1].endsWith('review-post.mjs')) {
  try {
    const comments = JSON.parse(readFileSync(process.argv[2], 'utf8') || '[]');
    if (!comments.length || !repo || !pr || !sha) { console.log('void review: no inline comments to post'); process.exit(0); }
    const existing = JSON.parse(gh(['api', '--paginate', '--slurp', 'repos/' + repo + '/pulls/' + pr + '/comments?per_page=100'])).flat();
    const todo = fresh(comments, postedKeys(existing.filter((c) => /<!-- void-review-inline /.test(c.body || ''))));
    if (!todo.length) { console.log('void review: every finding already has its comment'); process.exit(0); }
    const review = { commit_id: sha, event: 'COMMENT', body: '', comments: todo.map(({ path, line, side, body }) => ({ path, line, side, body })) };
    gh(['api', '-X', 'POST', 'repos/' + repo + '/pulls/' + pr + '/reviews', '--input', '-'], JSON.stringify(review));
    console.log('void review: posted ' + todo.length + ' inline comment' + (todo.length > 1 ? 's' : ''));
  } catch (e) { console.log('void review: could not post inline comments: ' + String(e.message || e).slice(0, 300)); }
}
