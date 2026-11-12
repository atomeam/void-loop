// lib/bridge.js, the local analyzer behind every Bridge card (lists run 22: the second-biggest untested file in tools/untested.mjs).
// It names fields that are the same under two spellings, flags deltas, writes an adapter, and stays within its limits.
// Run: node --test tools/bridge-analyzer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBridge } from '../void-live-deploy/lib/bridge.js';

const api = { id: 'a', title: 'Server reply', content: 'GET /v1/users/42\n{ "user_id": 42, "display_name": "Ada" }' };
const page = { id: 'b', title: 'Page code', content: 'const r = await fetch("/v1/users/" + id); const u = await r.json(); show(u.userId, u.displayName);' };

test('snake_case and camelCase spellings of one field are connected, with an adapter to copy', () => {
  const c = analyzeBridge([api, page], 'bridge these');
  assert.equal(c.kind, 'bridge');
  const maps = c.connections.filter((x) => x.type === 'field-map').map((x) => [x.refs.a, x.refs.b].sort().join('~'));
  assert.ok(maps.includes('userId~user_id'), JSON.stringify(maps));
  assert.ok(maps.includes('displayName~display_name'), JSON.stringify(maps));
  const adapter = c.nextActions.find((a) => a.id === 'act_adapter');
  assert.ok(adapter && adapter.kind === 'copy' && /function adapt\(input\)/.test(adapter.payload.code));
  assert.match(adapter.payload.code, /"user_id": input\.userId/);
  assert.ok(c.nextActions.some((a) => a.kind === 'ask'), 'a follow-up ask is always offered');
  assert.match(c.summary, /^Found 2 connections/);
});
test('inputs with nothing in common still get a card: a comparison to copy, no invented links', () => {
  const c = analyzeBridge([{ title: 'Poem', content: 'roses are red' }, { title: 'List', content: 'eggs milk bread' }]);
  assert.equal(c.connections.length, 0);
  assert.ok(c.nextActions.some((a) => a.id === 'act_compare'));
  assert.match(c.summary, /^Compared 2 inputs/);
});
test('at most three inputs, ids and titles filled in, empty and very long inputs named in the limits', () => {
  const c = analyzeBridge([{ content: '' }, { content: 'x'.repeat(7000) }, { content: 'a' }, { content: 'b' }]);
  assert.equal(c.inputs.length, 3);
  assert.deepEqual(c.inputs.map((i) => i.id), ['in_1', 'in_2', 'in_3']);
  assert.equal(c.inputs[0].title, 'Input 1');
  assert.ok(c.limitations.some((l) => /No content captured for Input 1/.test(l)));
  assert.ok(c.limitations.some((l) => /truncated/.test(l)));
  assert.deepEqual(analyzeBridge(null).inputs, []);
});
