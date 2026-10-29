// A page driven by automation (navigator.webdriver) tags its misses origin: 'robot', and /api/miss stores none of them (owner, 2026-10-19:
// Verse's will wanted "deep ocean floor inquiries, asked 72 times": tools/claims-verify.mjs typing a ledger try ask into the live page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestPost } from '../void-live-deploy/functions/api/miss.js';

const db = (writes) => ({ prepare: (sql) => ({ bind: (...a) => ({ run: async () => { writes.push([sql, ...a]); return {}; }, first: async () => null }) }) });
const post = (body, writes) => onRequestPost({ request: new Request('https://example.test/api/miss', { method: 'POST', body: JSON.stringify(body) }), env: { DB: db(writes) } });

test('a robot miss is answered and stored nowhere; a person\'s miss is stored', async () => {
  const robot = [], person = [];
  assert.equal((await post({ ask: 'tell me everything about the deep ocean floor', fallback: 'answer', origin: 'robot' }, robot)).status, 204);
  assert.equal(robot.length, 0);
  assert.equal((await post({ ask: 'tell me everything about the deep ocean floor', fallback: 'answer' }, person)).status, 204);
  assert.ok(person.some(([sql]) => /INSERT INTO void_misses/.test(sql)));
});

test('the page sends origin robot only when automation drives it, and an agent\'s WebMCP call still says agent', () => {
  const html = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  assert.match(html, /\.\.\.\(agentRuns > 0 \? \{ origin: 'agent' \} : navigator\.webdriver \? \{ origin: 'robot' \} : \{\}\)/);
});
