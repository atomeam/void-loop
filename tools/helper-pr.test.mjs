import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, inboxJobs } from './helper-pr.mjs';

test('a pushed helper branch with work main lacks gets a pull request and the automerge label', () => {
  const p = plan({ branch: 'helper/grok-idea', ahead: 2, behind: 0, hasPr: false });
  assert.equal(p.open, true);
  assert.equal(p.label, 'automerge');
  assert.equal(p.rebase, false);
  assert.equal(p.heal, null);
});

test('a branch behind main is rebased, and a failed check still opens the pull request and files a heal job', () => {
  const p = plan({ branch: 'helper/grok-idea', ahead: 1, behind: 4, hasPr: false, skillsFail: 'skills-check failed' });
  assert.equal(p.rebase, true);
  assert.equal(p.open, true);
  assert.equal(p.label, 'automerge');
  assert.match(p.heal.ask, /until it lands/);
  assert.equal(p.heal.target, 'heal:helper-grok-idea');
});

test('an open pull request is not opened again, and a branch with nothing new is left alone', () => {
  assert.equal(plan({ branch: 'helper/grok-idea', ahead: 2, behind: 1, hasPr: true }).open, false);
  assert.equal(plan({ branch: 'helper/grok-idea', ahead: 0, behind: 3 }).open, false);
  assert.equal(plan({ branch: 'cursor/other', ahead: 2 }).open, false);
});

test('a committed or pasted Growth inbox item becomes a build job, and a private one does not', () => {
  const text = [
    'Growth inbox item',
    'ask: build a tide card for any harbour',
    'private: no',
    '',
    'Growth inbox item',
    'ask: the owner weekly review stays private',
    'private: yes',
  ].join('\n');
  const jobs = inboxJobs(text + '\n' + text);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].ask, 'build a tide card for any harbour');
  assert.match(jobs[0].target, /^feature:inbox-/);
  assert.ok(jobs[0].target.length <= 40);
});
