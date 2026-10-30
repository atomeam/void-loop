// tools/team-gate.mjs: a team job is done only when its merged pull request did the job (coordinator, 2026-10-30: Beam's #1786 to
// #1788 added a target note and no page, and the queue called the three versus jobs done).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handedIn, judge, pagesOf, pageOk } from './team-gate.mjs';
import { reviewNote } from '../void-live-deploy/lib/team.js';

const URL1 = 'https://github.com/atomeam/void-loop/pull/1786';
const job = (target, extra = {}) => ({ id: 'mvqvg46r', target, state: 'building', note: reviewNote('Beam', URL1, 'notes for diffuse.tools'), ...extra });
const merged = { state: 'closed', merged_at: '2026-10-30T06:35:07Z', merge_commit_sha: 'abc' };
const f = (filename, additions = 10, deletions = 0, status = 'modified') => ({ filename, additions, deletions, status });

test('the queue rows it checks: building, handed in by a team agent with its pull request', () => {
  assert.deepEqual(handedIn(job('versus:diffuse.tools')), { agent: 'Beam', url: URL1, number: 1786 });
  assert.equal(handedIn(job('versus:diffuse.tools', { state: 'done' })), null, 'only building jobs');
  assert.equal(handedIn({ state: 'building', note: 'claimed by team:Beam · tries 1' }), null, 'a job still being worked is not handed in');
  assert.equal(handedIn({ state: 'building', note: 'review by team:Beam · PR: https://github.com/someone/else/pull/3' }), null, 'only this repository');
});

test('Beam\'s three pull requests (a target note, no page) send the versus jobs back', () => {
  const v = judge(job('versus:diffuse.tools'), merged, [f('domains/targets/diffuse-tools.json', 16, 0, 'added')]);
  assert.match(v.back, /only notes/);
  const docs = judge(job('versus:hexo'), merged, [f('domains/targets/hexo.json', 16, 0, 'added'), f('docs/MAP.md', 1)]);
  assert.match(docs.back, /only notes/);
  const test = judge(job('versus:hexo'), merged, [f('tools/hexo.test.mjs', 30, 0, 'added')]);
  assert.match(test.back, /needs the page itself/, 'code, but no page and no engine');
});

test('a branch built on an old copy of main goes back, whatever else it adds', () => {
  const old = judge(job('versus:hexo'), merged, [f('void-live-deploy/blog/index.html', 200, 0, 'added'), f('void-live-deploy/memory/index.html', 0, 120, 'removed')]);
  assert.match(old.back, /removes 1 file/);
  const strip = judge(job('feature:x'), merged, [f('void-live-deploy/lib/x.js', 20, 331)]);
  assert.match(strip.back, /takes away more than it adds \(331 lines out, 20 in\)/);
  assert.ok(judge(job('flake:y'), merged, [f('tools/y.test.mjs', 3, 12)]).pages, 'a small fix may take a few lines away');
});

test('open waits, closed without a merge goes back, a page goes to the live check', () => {
  assert.match(judge(job('versus:hexo'), { state: 'open' }, []).wait, /still open/);
  assert.match(judge(job('versus:hexo'), { state: 'closed', merged_at: null }, []).back, /closed without merging/);
  assert.deepEqual(judge(job('versus:hexo'), merged, [f('void-live-deploy/blog/index.html', 300, 0, 'added'), f('void-live-deploy/lib/blog.js', 120, 0, 'added'), f('domains/targets/hexo.json', 2, 1)]),
    { pages: ['/blog/'] });
  assert.deepEqual(judge(job('versus:hexo:speed'), merged, [f('void-live-deploy/lib/blog.js', 12, 4)]), { pages: [] }, 'an aspect fix in the engine only');
  assert.deepEqual(pagesOf([f('void-live-deploy/a/b/index.html'), f('void-live-deploy/tide/index.html')]), ['/tide/'], 'a page is a folder of the site');
});

test('a live page works when it answers 200 with a real HTML page', () => {
  const page = '<!doctype html><html lang="en"><head></head><body>' + 'x'.repeat(600) + '</body></html>';
  assert.equal(pageOk(200, page), true);
  assert.equal(pageOk(404, page), false);
  assert.equal(pageOk(200, '<html></html>'), false, 'an empty shell');
  assert.equal(pageOk(200, '{"error":"x"}'.repeat(100)), false, 'not a page');
});
