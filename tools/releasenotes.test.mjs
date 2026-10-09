import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseNotesOf, classify, notesMarkdown } from '../void-live-deploy/skills/releasenotes.js';

test('release-notes asks open the card, with the version and any pasted lines; word asks stay words', () => {
  assert.deepEqual(releaseNotesOf('write release notes for my repo'), { version: '', lines: [] });
  assert.deepEqual(releaseNotesOf('release notes for v1.4.0'), { version: 'v1.4.0', lines: [] });
  assert.deepEqual(releaseNotesOf('write release notes for v2.0.0-beta.1 ⏎ feat: x ⏎ fix: y'), { version: 'v2.0.0-beta.1', lines: ['feat: x', 'fix: y'] });
  assert.deepEqual(releaseNotesOf('release notes: feat(api): add search ⏎ fix: crash').lines, ['feat(api): add search', 'fix: crash']);
  for (const t of ['make a changelog', 'changelog from these commits', 'draft release notes']) assert.ok(releaseNotesOf(t), t);
  for (const t of ['what are release notes', 'iphone release notes', 'read the release notes', 'what is a changelog', 'notes']) assert.equal(releaseNotesOf(t), null, t);
});

test('each line lands under its Keep a Changelog heading, from its Conventional Commits prefix or its first word', () => {
  assert.deepEqual(classify('a1b2c3d feat(api): add search endpoint (#41)'), { section: 'Added', text: 'Add search endpoint (#41)', scope: 'api', breaking: false });
  assert.equal(classify('fix: crash when list is empty').section, 'Fixed');
  assert.equal(classify('feat!: drop Node 16 support').section, 'Breaking changes');
  assert.equal(classify('refactor: x\n\nBREAKING CHANGE: y').section, 'Breaking changes');
  assert.equal(classify('Add dark mode').section, 'Added');
  assert.equal(classify('Remove the old export').section, 'Removed');
  assert.equal(classify('deprecate the v1 token endpoint').section, 'Deprecated');
  assert.equal(classify('Patch XSS in the feed').section, 'Security');
  assert.equal(classify('Update README').section, 'Changed');
  for (const l of ['Merge pull request #42 from x/y', 'Merge branch main', 'chore(release): v1.4.0', 'bump version to 1.4.0', 'v1.4.0', 'Initial commit', '']) assert.equal(classify(l), null, l);
});

test('the Markdown has the version and date, sections in Keep a Changelog order, breaking first, and nothing for empty sections', () => {
  const md = notesMarkdown(['fix: crash', 'feat: search', 'feat!: drop Node 16', 'Merge branch x'], 'v1.4.0', '2026-10-08');
  assert.equal(md, '## v1.4.0 - 2026-10-08\n\n### Breaking changes\n- Drop Node 16\n\n### Added\n- Search\n\n### Fixed\n- Crash\n');
  assert.match(notesMarkdown([], '', ''), /^## Unreleased\n\n_Paste commit messages/);
});
