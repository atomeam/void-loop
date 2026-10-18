// The automerge bot's safety-check (asked by Void: "a 'safety-check' step to the automerge bot that runs node --test on the specific
// affected skill files before finalizing the merge"). Before a ready PR is merged, the unit tests of the skills and libs it changed
// run on the PR's own head: node --test on those test files only (never the suite). A failure holds the merge and says so once
// on the PR; it adds to the gates (Verse's review, the checks), it replaces none. If the check itself cannot run (no fetch, no
// worktree) the merge goes on as before, so a broken bot never blocks the repository: the suite on main still reverts.
//   safety(run, gh, { repo, pr, sha }) -> { state: 'pass' | 'fail' | 'skip', files, why }
import { readdirSync, readFileSync } from 'node:fs';

export const MARK = '<!-- void-automerge: safety-check -->', BOT = 'github-actions[bot]', MAX_TESTS = 8, TIMEOUT_MS = 150000;

/** the unit tests that import one of the changed files: pure over a list of [testFile, text]. */
export function testsFor(changed, tests) {
  const names = [...new Set((changed || []).map((f) => (/^void-live-deploy\/(?:skills|lib)\/([\w-]+)\.js$/.exec(f) || [])[1]).filter(Boolean))];
  const own = (changed || []).filter((f) => /^tools\/[\w.-]+\.test\.mjs$/.test(f)); // a test the PR itself changed
  const hit = new Set(own.map((f) => f.slice(6)));
  // browser scripts need Chrome and node_modules, which the bot's checkout lacks: verify.yml runs them (owner, 2026-10-17)
  for (const [file, text] of tests || []) if (!/from 'playwright-core'/.test(text)) for (const n of names) if (new RegExp('(?:skills|lib)/' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.js[\'"`]').test(text)) hit.add(file);
  return { names, files: [...hit].sort().slice(0, MAX_TESTS).map((f) => 'tools/' + f), more: Math.max(0, hit.size - MAX_TESTS) };
}
export const readTests = (dir) => readdirSync(dir + '/tools').filter((f) => f.endsWith('.test.mjs')).map((f) => [f, readFileSync(dir + '/tools/' + f, 'utf8')]);
export const note = (files, out) => MARK + '\nVoid automerge safety-check: `node --test ' + files.join(' ') + '` failed on this head, so the merge is held. Last lines:\n```\n' + String(out).split('\n').slice(-25).join('\n').replace(/```/g, "'''").slice(0, 1800) + '\n```\nFix it and push; the bot looks again when the head changes.';

export function safety(run, gh, { repo, pr, sha, dir, tests = readTests }) {
  let changed;
  try { changed = (gh(`repos/${repo}/pulls/${pr}/files?per_page=100`) || []).map((f) => f.filename); } catch (e) { return { state: 'skip', why: 'could not list the PR files' }; }
  dir = dir || `${process.env.RUNNER_TEMP || '/tmp'}/void-safety-${pr}`;
  const git = (args, o) => run('git', args, o || {}), drop = () => { try { git(['worktree', 'remove', '--force', dir]); } catch (_) {} };
  try {
    git(['fetch', '-q', 'origin', `pull/${pr}/head`]);
    drop();
    git(['worktree', 'add', '--detach', dir, sha ? sha : 'FETCH_HEAD']);
    const pick = testsFor(changed, tests(dir));
    if (!pick.files.length) return { state: 'pass', files: [], why: 'no unit test imports what changed' };
    try { run('node', ['--test', ...pick.files], { cwd: dir, timeout: TIMEOUT_MS }); return { state: 'pass', files: pick.files, why: pick.files.length + ' test file(s) passed' }; }
    catch (e) {
      const out = String(e.stdout || '') + String(e.stderr || '') || e.message;
      const body = note(pick.files, out);
      try {
        const mine = (gh(`repos/${repo}/issues/${pr}/comments?per_page=100`) || []).find((c) => c.user && c.user.login === BOT && String(c.body || '').startsWith(MARK));
        if (!mine) run('gh', ['api', '-X', 'POST', `repos/${repo}/issues/${pr}/comments`, '-f', 'body=' + body]);
        else if (mine.body !== body) run('gh', ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${mine.id}`, '-f', 'body=' + body]);
      } catch (_) {}
      return { state: 'fail', files: pick.files, why: 'node --test failed' };
    }
  } catch (e) { return { state: 'skip', why: 'could not set up the check: ' + String(e.stderr || e.message).slice(0, 200) }; }
  finally { drop(); }
}
