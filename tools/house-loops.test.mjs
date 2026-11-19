import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOOPS, dueLanes, backoff, noteResult, redirectAdds, withRedirects, plainPatch, healthOf, langPatch, speedLine, twinGroups, staleSets, seoPatch, nextGap, topHandoff, directPatch, advisoryCount, payTier, sameFinding, blankLog, workerLane, FAIL_STREAK } from '../void-live-deploy/lib/house-loops.js';

const now = Date.UTC(2026, 10, 14, 1, 10);

test('eleven lanes, staggered, due only after their hour', () => {
  assert.equal(new Set(LOOPS.map((l) => l.id)).size, 11);
  assert.deepEqual(dueLanes(LOOPS, now, {}).map((l) => l.id), ['links']);
  assert.deepEqual(dueLanes(LOOPS, now, { links: now }), []);
  assert.deepEqual(dueLanes(LOOPS, Date.UTC(2026, 10, 14, 0, 30), {}), []);
});

test('three failures pause for six hours', () => {
  let s = { fails: 0, pauseUntil: 0 };
  s = noteResult(noteResult(noteResult(s, false, now), false, now), false, now);
  assert.equal(s.fails, FAIL_STREAK);
  assert.equal(backoff(s, now + 1000).run, false);
  assert.equal(backoff(s, now + 7 * 3600e3).run, true);
  assert.deepEqual(noteResult(s, true, now), { fails: 0, pauseUntil: 0 });
});

test('a reading-list 404 becomes one redirect, and a live page does not', () => {
  const lines = redirectAdds('', { '/reading-list/': 404, '/reading-list': 200 });
  assert.deepEqual(lines, ['/reading-list/ /echo-vault/?entry=paper-notes 301']);
  assert.equal(redirectAdds('x', { '/reading-list/': 404 }, undefined, false).length, 0);
  assert.deepEqual(redirectAdds(withRedirects('', lines, 'why'), { '/reading-list/': 404 }), []);
});

test('pages, gaps, money', () => {
  const bare = '<html><head><meta name="description" content="A short page that tells you the time where you are, with nothing to install."></head><body><h1>Time</h1><h2>Next</h2></body></html>';
  assert.match(plainPatch(bare), /<p class="note">A short page/);
  assert.equal(plainPatch(plainPatch(bare)), '');
  assert.deepEqual(healthOf('<html><img src="a.png"><img alt="" src="b.png"></html>', { get: (k) => k === 'content-security-policy' ? 'x' : '' }), { lang: false, missingAlt: 1, csp: true });
  assert.match(langPatch('<html class="x">'), /lang="en"/);
  assert.match(speedLine([{ path: '/', status: 200, ms: 400, bytes: 2048 }]), /under 2 seconds/);
  assert.equal(twinGroups([{ path: '/a/', h1: 'Same long heading' }, { path: '/b/', h1: 'Same long heading' }]).length, 1);
  assert.equal(staleSets([{ id: 'btc', asOf: '2026-11-13', everyDays: 2 }], '2026-11-14').length, 0);
  assert.match(seoPatch('<html><head></head><h1>Ring chart</h1></html>'), /<title>Ring chart/);
  assert.deepEqual(nextGap('| 18 | ring size chart | x | y | open |\n'), { n: 18, ask: 'ring size chart' });
  assert.equal(topHandoff([{ from: '/arcade/', to: '/a/' }, { from: '/bpm/', to: '/metronome/' }]).from, '/bpm/');
  const audit = { vulnerabilities: { right: { severity: 'high', isDirect: true, fixAvailable: { name: 'right', version: '1.2.4', isSemVerMajor: false } }, big: { severity: 'critical', isDirect: true, fixAvailable: { isSemVerMajor: true } } } };
  assert.equal(advisoryCount(audit), 2);
  assert.deepEqual(directPatch(audit), { name: 'right', version: '1.2.4' });
  assert.equal(payTier({ freeFailed: false }).use, 'free');
  assert.equal(payTier({ freeFailed: true, infraCents: 499 }).use, 'held');
  assert.equal(payTier({ freeFailed: true, infraCents: 500 }).paidCents, null);
  const log = blankLog();
  assert.equal(log.loops.length, 11);
  assert.equal(log.estimate.actionsMinutesMonth, LOOPS.reduce((n, l) => n + l.minutes, 0) * 30);
  assert.equal(sameFinding({ last: 'a', status: 'Ran.' }, { last: 'a', status: 'Ran.' }), true);
  assert.equal(workerLane(1), 'links');
  const page = readFileSync(fileURLToPath(new URL('../void-live-deploy/progress/app.js', import.meta.url)), 'utf8');
  assert.match(page, /What Verse is doing/);
  for (const l of LOOPS) assert.match(page, new RegExp("'" + l.id + "'"));
});
