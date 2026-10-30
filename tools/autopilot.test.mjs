// lib/autopilot.js and functions/api/autopilot.js: which commits are Verse's own, and the page's API reading only real records.
//   node tools/autopilot.test.mjs
import assert from 'node:assert/strict';
import { kindOf, summarize, startedByHour, incidentsIn, mergedPr } from '../void-live-deploy/lib/autopilot.js';
import { readAutopilot } from '../void-live-deploy/functions/api/autopilot.js';

let n = 0; const t = (name, f) => { f(); n++; };
const BOT = '41898282+github-actions[bot]@users.noreply.github.com';
const c = (sha, msg, at, email = BOT) => ({ sha: sha.padEnd(40, '0'), commit: { message: msg, author: { email, date: at }, committer: { date: at } } });

t('housekeeping is not counted, work is', () => {
  assert.equal(kindOf('Merge pull request #1 from x/y'), null);
  assert.equal(kindOf('Regenerate the generated files after the merge'), null);
  assert.equal(kindOf('Conductor: the last 24 hours of Verse running itself'), null);
  assert.equal(kindOf('Verse fixes its sky skill: learn to handle "current sky"'), 'fix');
  assert.equal(kindOf('Revert "Tower: x"'), 'revert');
  assert.equal(kindOf('Tower gate: Versus by itself'), 'assimilate');
  assert.equal(kindOf('Site test: new ground passed'), 'measure');
  assert.equal(kindOf('Incident: the browser suite failed on e89cf175'), 'watch');
  assert.equal(mergedPr('Merge pull request #1846 from a/b'), 1846);
});

t('only Verse\'s own authors, inside the window, newest first, each sha once', () => {
  const now = Date.parse('2026-10-30T10:00:00Z'), since = now - 86400e3;
  const s = summarize([
    c('a1', 'Verse fixes its sky skill', '2026-10-30T08:00:00Z'),
    c('a1', 'Verse fixes its sky skill', '2026-10-30T08:00:00Z'),
    c('b2', 'Better at emoji', '2026-10-30T09:00:00Z', 'verse-loop@users.noreply.github.com'),
    c('c3', 'Something a person wrote', '2026-10-30T09:30:00Z', 'noreply@anthropic.com'),
    c('d4', 'Old work', '2026-10-28T09:30:00Z'),
    c('e5', 'Merge pull request #12 from a/b', '2026-10-30T09:40:00Z'),
  ], since);
  assert.deepEqual(s.own.map((x) => x.title), ['Better at emoji', 'Verse fixes its sky skill']);
  assert.equal(s.merged, 1);
  assert.match(s.own[0].url, /^https:\/\/github\.com\/atomeam\/void-loop\/commit\/b2/);
});

t('jobs per hour come from the conductor\'s own ticks', () => {
  const now = Date.parse('2026-10-30T10:00:00Z');
  const h = startedByHour([{ at: '2026-10-30T09:50:00Z', started: [1, 2] }, { at: '2026-10-30T07:10:00Z', started: [1] }, { at: '2026-10-28T07:10:00Z', started: [1] }], now);
  assert.equal(h.length, 24); assert.equal(h[23], 2); assert.equal(h[21], 1); assert.equal(h.reduce((a, b) => a + b), 3);
});

t('open and healed incidents', () => {
  const i = incidentsIn([{ at: 'x' }, { closedAt: '2026-10-30T09:00:00Z', minutes: 30 }, { closedAt: '2026-10-30T08:00:00Z', minutes: 10 }, { closedAt: '2026-10-20T08:00:00Z', minutes: 99 }], Date.parse('2026-10-29T10:00:00Z'));
  assert.deepEqual(i, { open: 1, healed: 2, medianMinutes: 30 });
});

// the API: a dead source says so; nothing is filled in
const now = Date.parse('2026-10-30T10:00:00Z');
const fake = (map) => async (url) => { for (const [k, v] of map) if (url.includes(k)) return v === 500 ? new Response('no', { status: 500 }) : Response.json(v); return new Response('?', { status: 404 }); };
const ok = await readAutopilot({}, 1, fake([
  ['author=41898282', [c('a1', 'Verse fixes its sky skill', '2026-10-30T08:00:00Z')]],
  ['author=verse-loop', []],
  ['deploy.yml/runs', { total_count: 7 }],
  ['conductor.json', { updated: '2026-10-30T09:59:00Z', last24h: { started: 130 }, ticks: [{ at: '2026-10-30T09:50:00Z', started: [1] }], held: [{ id: 'x', why: 'coder used up' }], broken: [] }],
]), now);
assert.equal(ok.ownCount, 1); assert.equal(ok.deploys, 7); assert.equal(ok.conductor.last24h.started, 130); assert.equal(ok.conductor.byHour[23], 1);
assert.deepEqual(ok.conductor.heldWhy, ['coder used up']); assert.deepEqual(ok.sources, { commits: 'ok', deploys: 'ok', conductor: 'ok' }); n++;
const bad = await readAutopilot({}, 7, fake([['deploy.yml/runs', 500]]), now);
assert.equal(bad.ownCount, undefined); assert.equal(bad.deploys, undefined); assert.match(bad.sources.commits, /HTTP 404/); assert.match(bad.sources.deploys, /HTTP 500/); n++;
console.log('autopilot: ' + n + ' passed');
