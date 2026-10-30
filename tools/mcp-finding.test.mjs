// tools/mcp-finding.mjs: the artifact of one live MCP client run, its ledger line, its occasion number and the once-a-day rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { artifactOf, artifactName, ledgerWhat, nextOccasion, keptToday, TEXT_MAX } from './mcp-finding.mjs';
import { entryProblem } from './grow.mjs';

const AT = '2026-10-30T18:21:07.512Z';
const req = (name, args) => ({ jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args } });
const RUN = {
  at: AT, url: 'https://a-to-mind.com/api/mcp', client: 'void-mcp-probe 1.0.0 (@modelcontextprotocol/sdk)', server: { name: 'void', version: '1.3.0' },
  tools: ['review_code', 'moon_phase', 'skill_country'], ok: true, error: '',
  calls: [
    { request: req('moon_phase', { date: '2026-10-11T00:00:00Z' }), response: { isError: false, content: [{ type: 'text', text: 'Waxing crescent, 3% lit' }], structuredContent: { phase: 'waxing crescent', illuminated: 0.03 } }, ms: 211.4, ok: true },
    { request: req('skill_country', { ask: 'capital of australia' }), response: { isError: false, content: [{ type: 'text', text: 'Australia\nCapital: Canberra' }] }, ms: 640, ok: true },
    { request: req('skill_country', { ask: 'define serendipity' }), response: { isError: true, content: [{ type: 'text', text: 'not this skill' }] }, ms: 12, ok: true, expect: 'refused' },
  ],
};

test('mcp-finding: a passing run keeps every request and response, and its ledger line is a valid finding', () => {
  const a = artifactOf(RUN, 1);
  assert.equal(a.attempt, 'live'); assert.equal(a.ok, true); assert.equal(a.error, ''); assert.equal(a.occasion, 1);
  assert.deepEqual(a.server, { name: 'void', version: '1.3.0' }); assert.equal(a.tools.length, 3); assert.equal(a.calls.length, 3);
  assert.deepEqual(a.calls[1].request, req('skill_country', { ask: 'capital of australia' }));
  assert.equal(a.calls[1].response.content[0].text, 'Australia\nCapital: Canberra');
  assert.deepEqual(a.calls[0].response.structuredContent, { phase: 'waxing crescent', illuminated: 0.03 });
  assert.equal(a.calls[0].ms, 211); assert.equal(a.calls[2].expect, 'refused');
  assert.equal(artifactName(a), '2026-10-30T1821.json');
  const what = ledgerWhat(a);
  assert.match(what, /for the first time/); assert.match(what, /void 1\.3\.0/); assert.match(what, /listed 3 tools and called 2 of them/);
  assert.match(what, /1 of them Verse's own skills run by their own code \(skill_country\)/); assert.match(what, /refused an ask that is not its own/);
  assert.match(what, /findings\/mcp\/2026-10-30T1821\.json/); assert.doesNotMatch(what, new RegExp('[\\u2014\\u2015]'));
  assert.equal(entryProblem({ at: '2026-10-30T18:21:07Z', by: 'mcp-live', kind: 'finding', what, ref: 'https://github.com/atomeam/void-loop/blob/main/findings/mcp/2026-10-30T1821.json' }), null);
  assert.match(ledgerWhat(artifactOf(RUN, 4)), /occasion 4/);
});

test('mcp-finding: a run that failed, stopped early or made no call is never ok, and says why', () => {
  assert.equal(artifactOf({ ...RUN, ok: false, error: 'skill_define: no answer' }).ok, false);
  assert.equal(artifactOf({ ...RUN, ok: false, error: 'skill_define: no answer' }).error, 'skill_define: no answer');
  assert.equal(artifactOf({ ...RUN, calls: [] }).ok, false, 'no call is no proof');
  assert.equal(artifactOf({ ...RUN, server: null }).ok, false);
  assert.equal(artifactOf({ ...RUN, calls: [{ ...RUN.calls[0], ok: false }] }).ok, false, 'one failed call fails the run');
  assert.match(ledgerWhat(artifactOf({ ...RUN, ok: false, error: 'connect/initialize: fetch failed' }, 2)), /did not pass \(connect\/initialize: fetch failed\)/);
  assert.equal(artifactOf(null).ok, false);
});

test('mcp-finding: a long response text is kept up to the limit and says how much was left out', () => {
  const long = 'x'.repeat(TEXT_MAX + 25);
  const a = artifactOf({ ...RUN, calls: [{ ...RUN.calls[0], response: { isError: false, content: [{ type: 'text', text: long }] } }] });
  assert.equal(a.calls[0].response.content[0].text, 'x'.repeat(TEXT_MAX) + ' [25 more characters not kept]');
  assert.equal(RUN.calls[0].response.content[0].text, 'Waxing crescent, 3% lit', 'the record is not changed');
});

test('mcp-finding: the occasion counts the kept artifacts, and one a UTC day is enough', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'mcp-finding-'));
  assert.equal(nextOccasion(dir), 1); assert.equal(keptToday(AT, dir), false);
  writeFileSync(join(dir, '2026-10-29T0915.json'), '{}'); writeFileSync(join(dir, 'notes.txt'), '');
  assert.equal(nextOccasion(dir), 2); assert.equal(keptToday(AT, dir), false);
  writeFileSync(join(dir, '2026-10-30T0102.json'), '{}');
  assert.equal(nextOccasion(dir), 3); assert.equal(keptToday(AT, dir), true);
  assert.equal(nextOccasion(join(dir, 'none')), 1);
});
