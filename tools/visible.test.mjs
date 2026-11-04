// Visible progress (Atom, 2026-11-03). node --test tools/visible.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankAdjust, adjustWeights, isFacingPath, parseFacingLog, shippedVisible, visibleLine, VISIBLE_BOOST, INTERNAL_CUT } from '../void-live-deploy/lib/visible.js';
import { score } from './conductor-core.mjs';

const NOW = Date.parse('2026-11-03T18:00:00Z');

test('visible work ranks above internal work, and a plain item is unchanged', () => {
  assert.equal(rankAdjust('the clock card is blank'), VISIBLE_BOOST);
  assert.equal(rankAdjust('fix the broken card on the stage'), VISIBLE_BOOST);
  assert.equal(rankAdjust('wrong answer on the define card'), VISIBLE_BOOST);
  assert.equal(rankAdjust('a refusal shown on a card'), VISIBLE_BOOST);
  assert.equal(rankAdjust('laggy render of the stage'), VISIBLE_BOOST);
  assert.equal(rankAdjust('missing link on the tools page'), VISIBLE_BOOST);
  assert.equal(rankAdjust('regenerate families.json'), -INTERNAL_CUT);
  assert.equal(rankAdjust('groom docs and the conductor record'), -INTERNAL_CUT);
  assert.equal(rankAdjust('Perform a git diff and list the failing checks'), -INTERNAL_CUT);
  assert.equal(rankAdjust('a drawing card on the stage'), 0);
  assert.equal(rankAdjust('the broken card showed up in the incident log'), VISIBLE_BOOST, 'a visible fix stays visible');
});

test('adjustWeights lifts a visible candidate over an internal one and never goes below 1', () => {
  const [vis, inn, plain] = adjustWeights([
    { title: 'fix the broken card', why: 'it draws nothing', weight: 20 },
    { title: 'regenerate the book', why: 'the generated files', weight: 40 },
    { title: 'absorb a repo', why: 'on the frontier', weight: 30 },
  ]);
  assert.ok(vis > inn, vis + ' > ' + inn);
  assert.equal(plain, 30);
  assert.equal(adjustWeights([{ title: 'incident log', weight: 1 }])[0], 1);
});

test('a facing path is a page or a skill; a workflow, a tool and a generated file are not', () => {
  assert.equal(isFacingPath('void-live-deploy/skills/wants.js'), true);
  assert.equal(isFacingPath('void-live-deploy/fringe/attention-7.html'), true);
  assert.equal(isFacingPath('void.html'), true);
  assert.equal(isFacingPath('.github/workflows/verify.yml'), false);
  assert.equal(isFacingPath('tools/visible.test.mjs'), false);
  assert.equal(isFacingPath('void-live-deploy/skills/index.json'), false);
  assert.equal(isFacingPath('void-live-deploy/self.json'), false);
  assert.equal(isFacingPath('domains/void.agents.log.md'), false);
});

test('shippedVisible counts a commit once, today and across the last 7 UTC days', () => {
  const log = [
    '2026-11-03T12:00:00Z',
    'void-live-deploy/skills/wants.js',
    'tools/wants.test.mjs',
    '',
    '2026-11-02T12:00:00Z',
    'docs/MAP.md',
    '',
    '2026-11-01T08:00:00Z',
    'void-live-deploy/stopwatch/index.html',
    '',
    '2026-10-20T08:00:00Z',
    'void.html',
  ].join('\n');
  const n = shippedVisible(parseFacingLog(log), NOW);
  assert.deepEqual(n, { day: 1, week: 2 });
  assert.match(visibleLine(n), /1 today, 2 this week/);
  assert.equal(visibleLine(null), '');
});

test('the conductor scores a visible job above an internal one of the same kind', () => {
  const job = (target, note) => ({ id: 'j', target, state: 'queued', note, at: '2026-11-03T18:00:00Z' });
  const vis = score(job('voice:card', 'the clock card is blank'), NOW);
  const inn = score(job('voice:diff', 'git diff the failing checks'), NOW);
  assert.ok(vis > inn, vis + ' > ' + inn);
});
