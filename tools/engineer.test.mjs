// Verse's engineer: who authored a merged pull, what a stuck pull needs, which new pages to probe, what to work on next.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authorOf, shareOf } from '../void-live-deploy/lib/loop-share.js';
import { planFor, pickOne, NEVER } from './pr-doctor.mjs';
import { pagesIn, checkPages } from './live-verify.mjs';
import { salvageRows, pickNext, nightly } from './priority-pick.mjs';

const pull = (over) => ({ number: 1, merged_at: '2026-11-04T00:00:00Z', login: 'atomeam', ref: 'helper/x', title: 'a change', ...over });

test('the loop share counts loop branches and loop titles, and leaves closed pulls out', () => {
  assert.equal(authorOf(pull({ ref: 'loop/20261104', login: 'github-actions[bot]' })), 'loop');
  assert.equal(authorOf(pull({ ref: 'verse/harden-1', title: 'Better at coin' })), 'loop');
  assert.equal(authorOf(pull({ ref: 'helper/efficiency', title: 'Verse loop: one open PR per task' })), 'loop');
  assert.equal(authorOf(pull({ ref: 'helper/shorts', login: 'github-actions[bot]', title: 'Shorts: a bed' })), 'verse-bot');
  assert.equal(authorOf(pull({ ref: 'cursor/x-aed8', login: 'atomeam' })), 'outside');
  const rows = [
    pull({ number: 1, ref: 'loop/a' }),
    pull({ number: 2, ref: 'cursor/b' }),
    pull({ number: 3, login: 'github-actions[bot]', ref: 'helper/c', title: 'Site test' }),
    { number: 4, ref: 'loop/d', title: 'Verse loop: dropped', state: 'closed' },
  ];
  const s = shareOf(rows);
  assert.deepEqual({ loop: s.loop, outside: s.outside, bot: s.bot, share: s.share }, { loop: 1, outside: 1, bot: 1, share: 50 });
  assert.equal(shareOf(rows, { since: Date.parse('2026-12-01T00:00:00Z') }).share, null);
});

test('the doctor updates, regenerates or fixes, and never closes or skips', () => {
  const plan = planFor({ number: 9, ref: 'loop/a', behind: true, generatedStale: true, failing: ['sitemap'] });
  assert.deepEqual(plan.steps.map((s) => s.do), ['update', 'regenerate', 'fix']);
  assert.deepEqual(plan.never, NEVER);
  assert.ok(plan.steps.every((s) => !NEVER.includes(s.do)));
  const one = pickOne([
    { number: 2, state: 'open', updated: '2026-11-02', behind: true, ref: 'loop/new' },
    { number: 1, state: 'open', updated: '2026-11-01', behind: true, ref: 'helper/old' },
    { number: 3, state: 'closed', updated: '2026-10-01', behind: true },
  ]);
  assert.equal(one.number, 1, 'the oldest open pull, and a closed one stays');
  assert.equal(pickOne([{ number: 4, state: 'open', title: 'fine' }]), null);
});

test('the live check lists changed pages and records status', async () => {
  assert.deepEqual(pagesIn(['tools/x.mjs', 'void-live-deploy/scoreboard/index.html', 'void-live-deploy/progress/app.js']), ['/scoreboard/']);
  const seen = [];
  const out = await checkPages('https://a-to-mind.com/', ['/progress/', '/missing/'], async (url) => { seen.push(url); return { status: url.endsWith('/progress/') ? 200 : 404 }; });
  assert.deepEqual(seen, ['https://a-to-mind.com/progress/', 'https://a-to-mind.com/missing/']);
  assert.deepEqual(out.map((r) => r.ok), [true, false]);
});

test('the picker reads the exam, then crew jobs, then the smallest salvage piece', () => {
  const shelf = '| `jobs.mjs` | old | none |\n| `next-growth.mjs` | alias | none |\n| `indexnow_submit.py` | ping | S |\n| `archive/victus/` | ingest | M |\n';
  assert.deepEqual(salvageRows(shelf).map((r) => r.name), ['indexnow_submit.py', 'archive/victus/']);
  assert.equal(pickNext({ exam: { lowest: { domain: 'images', score: 73.9 } }, jobs: [{ id: 'q', state: 'queued', at: '2026-01-01' }], salvage: shelf }).kind, 'exam');
  assert.equal(pickNext({ exam: { lowest: { domain: 'images', score: 100 } }, jobs: [{ id: 'later', state: 'open', at: '2026-11-02' }, { id: 'sooner', state: 'queued', at: '2026-11-01' }] }).id, 'sooner');
  assert.equal(pickNext({ salvage: shelf }).id, 'indexnow_submit.py');
  const note = nightly({ at: '2026-11-04T07:00:00Z', pulls: [pull({ ref: 'loop/a' })], exam: { lowest: { domain: 'images', score: 73.9 } }, salvage: shelf });
  assert.equal(note.share.share, 100);
  assert.equal(note.pick.id, 'images');
  assert.equal(pickNext({}).kind, 'none');
});
