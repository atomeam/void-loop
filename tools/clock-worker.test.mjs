// void-clock, the backstop for Verse's clock (clock-worker/index.js, docs/systems.md). Run: node --test tools/clock-worker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastTick, restartDue, beat, STALE_MIN } from '../clock-worker/index.js';

const NOW = Date.parse('2026-11-20T23:00:00Z'), MIN = 60000;
const rec = (minAgo) => ({ updated: new Date(NOW - minAgo * MIN).toISOString(), ticks: [{ at: new Date(NOW - (minAgo + 10) * MIN).toISOString() }] });

test('the chain is restarted only when the conductor\'s newest tick is stale or unreadable', () => {
  assert.equal(lastTick(rec(5)), NOW - 5 * MIN);
  assert.equal(restartDue(rec(5), NOW), false);
  assert.equal(restartDue(rec(STALE_MIN + 1), NOW), true);
  assert.equal(restartDue(null, NOW), true);
  assert.equal(restartDue({ ticks: [{ at: 'nonsense' }] }, NOW), true);
});

test('a beat dispatches grow-clock only when stale and a token exists, knocks the automations, and never shows a token', async () => {
  const calls = [];
  const fake = (record) => async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', auth: !!(opts.headers && opts.headers.authorization) });
    if (url.startsWith('https://raw.githubusercontent.com/')) return new Response(JSON.stringify(record));
    if (url.includes('/dispatches')) return new Response(null, { status: 204 });
    return new Response('{}', { status: 200 });
  };
  const fresh = await beat({ CLOCK_GITHUB_TOKEN: 'test-not-a-token', VOID_OWNER_TOKEN: 'test-not-a-token' }, NOW, fake(rec(5))); // secret-scan: ok
  assert.equal(fresh.conductor, 'fresh');
  assert.equal(fresh.automations, 'knocked');
  assert.ok(!calls.some((c) => c.url.includes('/dispatches')));
  calls.length = 0;
  const stale = await beat({ CLOCK_GITHUB_TOKEN: 'test-not-a-token' }, NOW, fake(rec(90))); // secret-scan: ok
  assert.equal(stale.conductor, 'stale: restarted grow-clock.yml');
  assert.match(stale.automations, /skipped/);
  assert.ok(calls.some((c) => c.url.endsWith('/grow-clock.yml/dispatches') && c.method === 'POST' && c.auth));
  const none = await beat({}, NOW, fake(rec(90)));
  assert.match(none.conductor, /no CLOCK_GITHUB_TOKEN/);
  assert.ok(!JSON.stringify([fresh, stale, none]).includes('test-not-a-token'));
});
