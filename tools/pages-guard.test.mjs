// tools/pages-guard.mjs and its wiring (incident 2026-11-09: Pages Git builds from the repo root served empty 404s on a-to-mind.com).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probe, candidates, pausedConfig } from './pages-guard.mjs';

const res = (status, body) => ({ status, text: async () => body });
const site = (map) => async (url, init = {}) => { const path = new URL(url).pathname; const h = map[(init.method || 'GET') + ' ' + path]; return h ? h() : res(404, ''); };
const tools = JSON.stringify({ tools: Array.from({ length: 418 }, (_, i) => ({ name: 't' + i })) });

test('a whole Verse passes the check', async () => {
  const f = site({ 'GET /': () => res(200, '<title>Verse</title>'), 'GET /tools.json': () => res(200, tools), 'POST /api/answer': () => res(200, '{"answer":"4"}') });
  assert.deepEqual(await probe('https://x.pages.dev', f), []);
});
test('the empty-404 deployment (no index, no Functions, no tools.json) fails on all three', async () => {
  const fails = await probe('https://8a4eb095.a-to-mind.pages.dev', site({}));
  assert.equal(fails.length, 3);
  assert.match(fails.join(' '), /\/tools\.json HTTP 404/);
});
test('a tools.json with too few tools fails (control)', async () => {
  const f = site({ 'GET /': () => res(200, '<title>Verse</title>'), 'GET /tools.json': () => res(200, '{"tools":[1,2]}'), 'POST /api/answer': () => res(200, '{"answer":"4"}') });
  assert.equal((await probe('https://x', f)).length, 1);
});
test('rollback candidates: production only, finished, newest first, never the bad deployment', () => {
  const d = [
    { url: 'https://a.a-to-mind.pages.dev', environment: 'production', created_on: '2026-11-09T07:39:00Z', latest_stage: { status: 'success' } },
    { url: 'https://b.a-to-mind.pages.dev', environment: 'preview', created_on: '2026-11-09T08:00:00Z' },
    { url: 'https://c.a-to-mind.pages.dev', environment: 'production', created_on: '2026-11-09T08:01:00Z', latest_stage: { status: 'success' } },
    { url: 'https://d.a-to-mind.pages.dev', environment: 'production', created_on: '2026-11-09T08:02:00Z', latest_stage: { status: 'failure' } },
  ];
  assert.deepEqual(candidates(d, 'https://c.a-to-mind.pages.dev/').map((x) => x.url), ['https://a.a-to-mind.pages.dev']);
});
test('Git builds are turned off for production and previews, other settings kept', () => {
  const c = pausedConfig({ owner: 'o', repo_name: 'r', production_branch: 'main' });
  assert.equal(c.deployments_enabled, false); assert.equal(c.production_deployments_enabled, false); assert.equal(c.preview_deployment_setting, 'none');
  assert.equal(c.production_branch, 'main');
});
test('deploy.yml pauses Git builds, smoke checks tools.json and /api/answer, and rolls back on failure', () => {
  const y = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.ok(y.indexOf('pages-guard.mjs pause-git') > -1 && y.indexOf('pages-guard.mjs pause-git') < y.indexOf('id: deploy'));
  assert.match(y, /pages-guard\.mjs check "\$URL"/);
  assert.match(y, /pages-guard\.mjs check https:\/\/a-to-mind\.com/);
  assert.match(y, /if: failure\(\) && steps\.deploy\.outcome == 'success'[^\n]*\n[\s\S]{0,400}pages-guard\.mjs heal --bad "\$BAD"/);
});
test('pages-guard.yml runs after every push to main and on a schedule, with no person in the loop', () => {
  const y = readFileSync(new URL('../.github/workflows/pages-guard.yml', import.meta.url), 'utf8');
  assert.match(y, /branches: \[main\]/); assert.match(y, /cron:/); assert.match(y, /pages-guard\.mjs guard/);
  assert.doesNotMatch(y, /environment:|workflow_dispatch:\s*\n\s+inputs:\s*\n\s+approve/);
});
