import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, nextReset, readySources, note, rankJobs, pasteOf, chunkOk, stitchJob, workJob } from '../void-live-deploy/lib/recruit.js';
import { fill } from './recruit.mjs';

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
  const job = workJob();
  assert.equal(chunkOk('Animal Hospital is a video game about caring for animals.', job.parts[0]), true);
  assert.equal(chunkOk('It is Theme Hospital from 1997.', job.parts[0]), false);
  const page = stitchJob(job, [{ id: 'what', text: 'Animal Hospital is a video game about caring for animals.' }]);
  assert.match(page, /caring for animals/);
  assert.doesNotMatch(page, /<script/);
});

test('a no-key run publishes only the sentences the source returned', async () => {
  const job = workJob();
  let n = 0;
  const replies = ['Animal Hospital is a video game about caring for animals.', 'In Animal Hospital the player looks after sick animals.'];
  const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => '' }, text: async () => JSON.stringify({ choices: [{ message: { content: replies[n++] } }] }) });
  const source = { id: 'pollinations', endpoint: 'https://text.pollinations.ai/openai' };
  const done = await fill(source, job, {}, fetchImpl, { sleep: async () => {}, gapMs: 0 });
  assert.equal(done.ok, true);
  assert.match(done.html, /caring for animals/);
  assert.match(done.html, /looks after sick animals/);
  assert.equal(done.replies.length, 2);
});
