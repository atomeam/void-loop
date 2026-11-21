import test from 'node:test';
import assert from 'node:assert/strict';
import { rpc, TOOLS, TEST_FILES } from '../void-live-deploy/lib/workshop.js';
import { onRequestPost } from '../void-live-deploy/functions/api/workshop.js';

const ctx = {
  search: async (q) => 'found ' + q,
  fetchPage: async (u) => 'got ' + u,
  page: async (p) => 'page ' + p,
  tests: async (f) => 'queued ' + f,
  propose: async (files) => 'files ' + files.length,
  searches: async () => '2 skill timer',
  growth: async () => 'building 1',
  picture: async (t) => 'photo ' + t,
  paint: async () => 'Painted.',
  deploy: async () => 'up',
  rollback: async (sha) => 'rollback ' + sha,
  cost: async () => '0 cents',
};

test('the workshop lists its tools and calls the handler it was given', async () => {
  const list = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, ctx);
  assert.deepEqual(list.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  const hit = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'web_search', arguments: { q: 'tides' } } }, ctx);
  assert.equal(hit.result.content[0].text, 'found tides');
  const no = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'run_tests', arguments: { file: 'tools/secret-scan.mjs' } } }, ctx);
  assert.equal(no.result.isError, true);
  assert.ok(TEST_FILES.includes('tools/workshop.test.mjs'));
});

test('a stranger gets 401 and the tools do not run', async () => {
  const res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/workshop', { method: 'POST', body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' }), env: {} });
  assert.equal(res.status, 401);
});
