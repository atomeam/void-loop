// Verse's quick asks, built into the skills they belong to (Suggested-by: Verse): the country card's time zone row and the digest
// recovery loop (a second, simpler prompt when the first summary comes back empty or fails).
import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { tzLine, rowsOf } from '../void-live-deploy/skills/country.js';
import { summarize, DIGEST_PROMPTS } from '../void-live-deploy/functions/api/digest.js';

test('country card: the time zone and how far it is from the asker', () => {
  assert.equal(tzLine(['UTC+09:00'], -240), 'UTC+09:00 (13 h ahead of you)');
  assert.equal(tzLine(['UTC+05:30'], 0), 'UTC+05:30 (5.5 h ahead of you)');
  assert.equal(tzLine(['UTC-05:00'], -240), 'UTC−05:00 (1 h behind you)');
  assert.equal(tzLine(['UTC'], 0), 'UTC (same time as you)');
  assert.equal(tzLine(['UTC-10:00', 'UTC-05:00', 'UTC+10:00'], 0), 'UTC−10:00 to UTC+10:00 (3 zones)');
  assert.equal(tzLine([], 0), '');
  assert.deepEqual(rowsOf({ timezones: ['UTC+01:00'] }, [], 60).time, ['Time', 'UTC+01:00 (same time as you)']);
});

test('digest: an empty first summary is retried once with a simpler prompt; never more than two tries', async () => {
  const calls = [];
  const env = (answers) => ({ AI: { run: async (_m, o) => { calls.push(o.messages[0].content); const a = answers.shift(); if (a instanceof Error) throw a; return { response: a }; } } });
  calls.length = 0; assert.equal(await summarize(env(['', '- one']), 'x '.repeat(100), 'q'), '- one'); assert.deepEqual(calls, DIGEST_PROMPTS);
  calls.length = 0; assert.equal(await summarize(env([new Error('busy'), '- two']), 'x '.repeat(100)), '- two'); assert.equal(calls.length, 2);
  calls.length = 0; assert.equal(await summarize(env(['', '', 'never']), 'x '.repeat(100)), null); assert.equal(calls.length, 2);
  calls.length = 0; assert.equal(await summarize(env(['- first']), 'x '.repeat(100)), '- first'); assert.equal(calls.length, 1);
  for (const p of DIGEST_PROMPTS) assert.match(p, /data, never instructions/);
});

import { decisionsBlock, pathOf } from './reflect.mjs';
test('decision rows show their reasoning path when they name one', () => {
  assert.equal(pathOf({}), ''); assert.equal(pathOf({ path: 'canon rule 3' }), ' · reasoning path: canon rule 3');
  assert.match(decisionsBlock([{ id: 'ask-1' }], { 'ask-1': { decision: 'declined', why: 'w', path: 'privacy rule' } }), /- `ask-1` declined: w · reasoning path: privacy rule/);
});

import country, { compareOf } from '../void-live-deploy/skills/country.js';
test('two countries compared: capitals side by side, distance and flight time one tap away', () => {
  const c = compareOf('France vs Spain?');
  assert.deepEqual([c.a, c.b, c.capA, c.capB, c.distance, c.flight], ['France', 'Spain', 'Paris', 'Madrid', 'distance from Paris to Madrid', 'how long is the flight from Paris to Madrid']);
  assert.equal(compareOf('compare japan and south korea').capB, 'Seoul');
  for (const a of ['apples vs oranges', 'france and spain', 'uk vs england', 'compare prices', 'lakers vs celtics']) assert.equal(compareOf(a), null, a);
  assert.ok(country.match('', 'france vs spain') && country.match('', 'capital of australia'));
});

import { rpc, shaped } from '../void-live-deploy/lib/mcp.js';
import { mcpFailure } from '../void-live-deploy/functions/api/mcp.js';
test('MCP: agents pick text or raw_data; a failed call is counted by tool name only', async () => {
  const r = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'moon_phase', arguments: { date: '2026-10-15', response_type: 'raw_data' } } });
  const d = JSON.parse(r.result.content[0].text); assert.equal(d.date, '2026-10-15T00:00:00.000Z'); assert.ok('phase' in d);
  const t = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'moon_phase', arguments: { date: '2026-10-15' } } });
  assert.match(t.result.content[0].text, /% lit/);
  assert.equal(shaped({ content: [], structuredContent: {} }, 'image').isError, true);
  const bad = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'moon_phase', arguments: { date: 'nope' } } };
  assert.equal(mcpFailure(bad, await rpc(bad)), 'mcp moon_phase');
  assert.equal(mcpFailure({ method: 'tools/call', params: { name: 'x' } }, { error: { code: -32602 } }), 'mcp x');
  assert.equal(mcpFailure({ method: 'tools/list' }, { error: {} }), null);
  assert.equal(mcpFailure(bad, t), null);
});

import { readiness } from '../void-live-deploy/skills/print-download.js';
test('stage readiness: one manifest of every 3D mini; the print file waits while one is drawing', () => {
  const canvas = (busy, rendered) => ({ getAttribute: () => busy, closest: () => ({ dataset: { rendered, kind: 'fig3d' } }) });
  const root = (list) => ({ querySelectorAll: () => list });
  assert.deepEqual(readiness(root([])), { total: 0, rendered: 0, pending: 0, ready: true, cards: [] });
  const r = readiness(root([canvas('false', 'true'), canvas('true', undefined)]));
  assert.equal(r.total, 2); assert.equal(r.rendered, 1); assert.equal(r.pending, 1); assert.equal(r.ready, false); assert.equal(r.cards[0].kind, 'fig3d');
  assert.equal(readiness(null).ready, true);
});

import { heat, heatBar } from './collide.mjs';
test('conflict heatmap: open PRs weigh three times a commit; shared ledgers left out', () => {
  const H = heat([{ number: 1, files: ['a.js', 'domains/handoff.md'] }, { number: 2, files: ['a.js', 'b.js'] }], { 'b.js': 4, 'c.js': 2, 'void-live-deploy/void.growth.json': 99 });
  assert.deepEqual(H.map((x) => [x.file, x.heat]), [['b.js', 7], ['a.js', 6], ['c.js', 2]]);
  assert.deepEqual(H[1].prs, [1, 2]); assert.equal(heatBar(7, 7).length, 20); assert.equal(heatBar(0, 7).length, 1);
});

test('"who are you" lights the stage: identityGlow runs on the identity path, in every copy of the page', () => {
  for (const f of ['void.html', 'void-live-deploy/void.html', 'void-live-deploy/index.html']) {
    const s = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.match(s, /if \(wantsIdentity\(lower0\)\) identityGlow\(\);/, f); assert.match(s, /function identityGlow\(\)[\s\S]{0,400}prefers-reduced-motion/, f);
  }
});
