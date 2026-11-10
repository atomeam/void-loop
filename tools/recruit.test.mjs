import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, nextReset, readySources, note, rankJobs, pasteOf, keepPatch } from '../void-live-deploy/lib/recruit.js';
import { once } from './recruit.mjs';

const NOW = Date.UTC(2026, 10, 10, 15, 30); // 2026-11-10 15:30 UTC, 07:30 PST
const key = { GROQ_API_KEY: 'set' };

test('the clock parks at the cap, wakes at the reset, and drops three misses', () => {
  assert.equal(nextReset(SOURCES.find((s) => s.id === 'gemini'), NOW), Date.UTC(2026, 10, 11, 8));
  assert.equal(nextReset(SOURCES.find((s) => s.id === 'groq'), NOW), Date.UTC(2026, 10, 11));
  assert.equal(readySources({}, {}, NOW)[0].id, 'pollinations');
  assert.equal(readySources(key, {}, NOW)[0].id, 'groq');
  let state = note({ sources: {} }, 'groq', NOW, { shipped: true });
  for (let i = 0; i < 999; i++) state = note(state, 'groq', NOW, {});
  assert.equal(state.sources.groq.dropped, false);
  assert.equal(readySources(key, state, NOW).some((s) => s.id === 'groq'), false);
  assert.equal(readySources(key, state, state.sources.groq.parkedUntil)[0].id, 'groq');
  state = note({ sources: {} }, 'pollinations', NOW, { limited: true, retryAfter: 30 });
  assert.equal(state.sources.pollinations.parkedUntil, NOW + 30000);
  assert.equal(state.sources.pollinations.tried, 0);
  state = note(note(note(state, 'pollinations', NOW + 40000, {}), 'pollinations', NOW + 80000, {}), 'pollinations', NOW + 120000, {});
  assert.equal(state.sources.pollinations.dropped, true);
  assert.equal(note(state, 'pollinations', NOW + 160000, { shipped: true }).sources.pollinations.dropped, false);
});

test('visitor work comes first, and the page is safe to publish', () => {
  const ranked = rankJobs([{ id: 'a', ask: 'Repair helper/team-chat-card until it lands' }, { id: 'b', ask: 'Publish /team/recruit.html so a visitor sees the free agents' }]);
  assert.equal(ranked[0].id, 'b');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.doesNotMatch(pasteOf(SOURCES.find((s) => s.id === 'openhands-cloud')), /vj1-[0-9a-f]{32}/);
  assert.match(pasteOf(), /next job/);
  const prose = '<!doctype html><h1>Animal Hospital</h1><p>The player solves mysteries.</p>';
  assert.equal(keepPatch({ kind: 'test', file: 'a.html', test: 'node --test x' }, prose, 0), false);
  assert.equal(keepPatch({ kind: 'gap', file: 'a.js', test: 'node --test x' }, 'function f(){return 1}', 0), false);
  assert.equal(keepPatch({ kind: 'test', file: 'a.js', test: 'node --test x' }, 'function f(){return 1}', 1), false);
  assert.equal(keepPatch({ kind: 'test', file: 'a.js', test: 'node --test x' }, 'function f(){return 1}', 0), true);
});

test('the clock writes nothing when it has no passing test', async () => {
  const out = await once({ env: {}, log: () => {} });
  assert.equal(out.html, '');
  assert.equal(out.skipped, true);
});
