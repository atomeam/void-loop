// The pure part of /code/ (lib/code-hub.js): a pasted GitHub link read into a view, API addresses built only from checked parts, the tree listed and
// searched, a README made safe HTML (nothing a repo writes can run on Verse's page), diffs parsed and made, and every English sentence has its German.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../void-live-deploy/lib/code-hub.js';
import { DE } from '../void-live-deploy/lib/code-hub-de.js';

test('a pasted GitHub link becomes what to show', () => {
  assert.deepEqual(H.ghTarget('atomeam/void-loop'), { repo: 'atomeam/void-loop', view: 'code' });
  assert.deepEqual(H.ghTarget('https://github.com/atomeam/void-loop.git'), { repo: 'atomeam/void-loop', view: 'code' });
  assert.deepEqual(H.ghTarget('https://github.com/a/b/blob/main/src/x.js#L3-L9'), { repo: 'a/b', view: 'file', ref: 'main', path: 'src/x.js', lines: [3, 9] });
  assert.deepEqual(H.ghTarget('github.com/a/b/tree/dev/docs'), { repo: 'a/b', view: 'code', ref: 'dev', path: 'docs' });
  assert.deepEqual(H.ghTarget('https://github.com/a/b/pull/42/files'), { repo: 'a/b', view: 'pull', num: 42 });
  assert.deepEqual(H.ghTarget('https://github.com/a/b/issues/7'), { repo: 'a/b', view: 'issue', num: 7 });
  assert.deepEqual(H.ghTarget('https://github.com/a/b/commit/ABCDEF1'), { repo: 'a/b', view: 'commit', sha: 'abcdef1' });
  assert.deepEqual(H.ghTarget('https://raw.githubusercontent.com/a/b/main/README.md'), { repo: 'a/b', view: 'file', ref: 'main', path: 'README.md' });
  assert.deepEqual(H.ghTarget('https://github.com/a/b/actions/runs/123'), { repo: 'a/b', view: 'run', num: 123 });
  assert.deepEqual(H.runState({ status: 'completed', conclusion: 'failure' }), { word: 'Failed', cls: 'bad' }); assert.equal(H.runState({ status: 'in_progress' }).word, 'Running'); assert.equal(H.runTime('2026-01-01T00:00:00Z', '2026-01-01T00:02:05Z'), '2 min 5 s');
  assert.deepEqual(H.ghTarget('https://gist.github.com/someone/0123456789abcdef'), { gist: '0123456789abcdef' });
  for (const bad of ['', 'hello world', '../etc', 'https://github.com/a/b/blob/main/../../x', 'https://evil.com/a/b', 'a/b/c']) assert.equal(H.ghTarget(bad), null, bad);
});
test('API addresses are built from checked names only', () => {
  assert.equal(H.URLS.tree('a/b', 'main'), '/repos/a/b/git/trees/main?recursive=1');
  assert.equal(H.URLS.commits('a/b', { ref: 'dev', path: 'src/x.js', page: 2 }), '/repos/a/b/commits?sha=dev&path=src%2Fx.js&per_page=30&page=2');
  assert.equal(H.URLS.issues('a/b', { state: 'nonsense' }), '/repos/a/b/issues?state=open&per_page=30&page=1');
  assert.equal(H.URLS.pullFiles('a/b', '5x'), '/repos/a/b/pulls/0/files?per_page=100');
  assert.throws(() => H.URLS.repo('a/b/../c')); assert.throws(() => H.URLS.tree('a/b', '../x')); assert.throws(() => H.URLS.commit('a/b', 'zz')); assert.throws(() => H.URLS.gist('nothex!'));
  assert.equal(H.rawUrl('a/b', 'main', 'docs/a b.md'), 'https://raw.githubusercontent.com/a/b/main/docs/a%20b.md'); assert.equal(H.rawUrl('a/b', 'main', '../x'), '');
  assert.equal(H.webUrl('a/b', { view: 'file', ref: 'main', path: 'x.js', lines: [4, 4] }), 'https://github.com/a/b/blob/main/x.js#L4');
  assert.equal(H.webUrl('a/b', { view: 'pull', num: 3 }), 'https://github.com/a/b/pull/3');
});
test('the tree: a folder listed folders first; go to file finds by letters in order', () => {
  const tree = H.treeOf({ tree: [{ path: 'src', type: 'tree' }, { path: 'src/app.js', type: 'blob', size: 10 }, { path: 'README.md', type: 'blob', size: 5 }, { path: 'docs', type: 'tree' }, { path: 'docs/guide.md', type: 'blob', size: 3 }, { path: 'src/lib/apple.js', type: 'blob', size: 1 }, { path: '../evil', type: 'blob' }] });
  assert.deepEqual(H.listDir(tree, '').map((e) => e.name), ['docs', 'src', 'README.md']); assert.deepEqual(H.listDir(tree, 'src').map((e) => e.name), ['app.js']);
  assert.deepEqual(H.findFiles(tree, 'app').map((e) => e.path), ['src/app.js', 'src/lib/apple.js']); assert.deepEqual(H.findFiles(tree, 'zq').map((e) => e.path), []); assert.deepEqual(H.findFiles(tree, 'dgu').map((e) => e.path), ['docs/guide.md']);
  assert.equal(H.sizeOf(2048), '2.0 KB'); assert.equal(H.ago('2026-10-23T12:00:00Z', Date.parse('2026-10-26T12:00:00Z')), '3 days ago'); assert.equal(H.ago('2026-10-23T12:00:00Z', Date.parse('2026-10-26T12:00:00Z'), true), 'vor 3 Tagen');
});
test('a README is drawn as safe HTML: no script, no handler, no javascript: link, pictures from the repo', () => {
  const ctx = { repo: 'o/r', ref: 'main', dir: 'docs' };
  const html = H.mdHtml('# Title\n\n<img src="logo.png" onerror="alert(1)" width="80">\n<script>alert(1)</script>\n[x](javascript:alert(1)) [ok](../src/a.js) ![a](https://img.example/x.png)\n\n```js\nconst a = "<b>";\n```\n\n- [ ] todo\n\n> quoted', ctx);
  assert.doesNotMatch(html, /<script|onerror|javascript:/i);
  assert.match(html, /<img src="https:\/\/raw\.githubusercontent\.com\/o\/r\/main\/docs\/logo\.png" alt="" loading="lazy" referrerpolicy="no-referrer" width="80">/);
  assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/src\/a\.js"/); assert.match(html, /&lt;script&gt;/); assert.match(html, /<span class="s">&quot;&lt;b&gt;&quot;<\/span>/); assert.match(html, /☐ todo/); assert.match(html, /<blockquote><p>quoted<\/p><\/blockquote>/);
  assert.equal(H.safeUrl('data:text/html,x'), ''); assert.equal(H.safeUrl('//evil.com/x'), ''); assert.equal(H.safeUrl('http://a.com/x'), 'https://a.com/x');
});
test('diffs: parsed with line numbers, made from GitHub file patches, and made from two texts', () => {
  const d = 'diff --git a/x.js b/x.js\nindex 1..2 100644\n--- a/x.js\n+++ b/x.js\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n';
  const [f] = H.parseDiff(d); assert.equal(f.to, 'x.js'); assert.equal(f.adds, 1); assert.equal(f.dels, 1);
  assert.deepEqual(f.hunks[0].rows.map((r) => [r.t, r.o, r.n]), [['ctx', 1, 1], ['del', 2, null], ['add', null, 2], ['ctx', 3, 3]]);
  assert.deepEqual(H.addedOf(f), { code: 'B', lines: [2] });
  assert.equal(H.parseDiff(H.filesToDiff([{ filename: 'y.py', patch: '@@ -0,0 +1 @@\n+print(1)' }, { filename: 'img.png' }]))[0].to, 'y.py');
  const t = H.textDiff('a\nb\nc', 'a\nc\nd', 'n.txt'); assert.match(t, /^--- a\/n\.txt\n\+\+\+ b\/n\.txt\n@@ -1,3 \+1,3 @@\n a\n-b\n c\n\+d\n$/); assert.equal(H.textDiff('same', 'same'), '');
});
test('every sentence the code screen says in English has its German', () => {
  const src = fs.readFileSync(new URL('../void-live-deploy/lib/code-hub-ui.js', import.meta.url), 'utf8'), missing = [];
  for (const m of src.matchAll(/\bt\('((?:\\'|[^'])*)'\)/g)) { const k = m[1].replace(/\\'/g, "'"); if (!(k in DE)) missing.push(k); }
  for (const k of ['Code', 'Commits', 'Issues', 'Pull requests', 'Go to file', 'Open', 'Closed', 'All', 'Merged', 'stars', 'forks', 'watching', 'open issues and pull requests', 'Read and review a diff', 'Actions', 'Passed', 'Failed', 'Running', 'Queued', 'Cancelled', 'Skipped', 'Done', 'bug', 'risk', 'style', 'note']) if (!(k in DE)) missing.push(k);
  assert.deepEqual([...new Set(missing)], []);
});
