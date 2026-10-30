// lib/autopilot.js and functions/api/autopilot.js: which commits are Verse's own, and the page's API reading only real records.
//   node tools/autopilot.test.mjs
import assert from 'node:assert/strict';
import { kindOf, summarize, startedByHour, incidentsIn, mergedPr } from '../void-live-deploy/lib/autopilot.js';
import { readAutopilot, fillFromSnapshot, onRequestGet } from '../void-live-deploy/functions/api/autopilot.js';
import { snapshot } from './autopilot-snapshot.mjs';

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

// the deploy's snapshot: GitHub refused Cloudflare, so the deploy's own read of the same records is used, and dated
const snap = await snapshot({ GITHUB_TOKEN: 't' }, fake([
  ['author=41898282', [c('b1', 'Better at recipes', '2026-10-30T09:00:00Z')]], ['author=verse-loop', []], ['deploy.yml/runs', { total_count: 5 }],
]), now);
assert.equal(snap.at, '2026-10-30T10:00:00.000Z'); assert.equal(snap.windows[1].ownCount, 1); assert.equal(snap.windows[7].deploys, 5); assert.equal(snap.windows[1].conductor, undefined); n++;
const filled = fillFromSnapshot(structuredClone(bad), snap, 7);
assert.equal(filled.ownCount, 1); assert.equal(filled.deploys, 5); assert.deepEqual([filled.sources.commits, filled.sources.deploys], ['snapshot', 'snapshot']); assert.equal(filled.snapshotAt, snap.at); n++;
const failedSnap = { at: snap.at, windows: { 1: { sources: { commits: 'HTTP 403', deploys: 'HTTP 403' } } } };
const kept = fillFromSnapshot(structuredClone(bad), failedSnap, 1);
assert.equal(kept.ownCount, undefined); assert.equal(kept.snapshotAt, undefined); n++; // a snapshot that did not read GitHub fills nothing in

// the endpoint: with no token and a snapshot, GitHub is not asked at all; the conductor is still read live
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
let askedGithub = false;
const assets = { fetch: async () => Response.json(snap) };
const res = await onRequestGet({ request: new Request('https://a-to-mind.com/api/autopilot?days=1'), env: { ASSETS: assets },
  fetchFn: async (url) => { if (url.startsWith('https://api.github.com')) askedGithub = true; return url.includes('conductor.json') ? Response.json({ updated: '2026-10-30T09:59:00Z', last24h: { started: 3 }, ticks: [] }) : new Response('no', { status: 403 }); } });
const body = await res.json();
assert.equal(askedGithub, false); assert.equal(body.ownCount, 1); assert.equal(body.sources.conductor, 'ok'); assert.equal(body.sources.commits, 'snapshot'); n++;
console.log('autopilot: ' + n + ' passed');
