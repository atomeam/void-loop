// node --test tools/rea-study.test.mjs: the REA study tool (tools/rea-study.mjs). Public pages only, passive REA commands only,
// a study fits Verse's private memory, and the digest keeps the evidence (script and line) for each finding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, studyRecord, digestOf, ALLOWED, MAX_DIGEST, REA } from './rea-study.mjs';
import { cleanRecord } from '../void-live-deploy/lib/memory-core.js';

test('rea-study: only public http(s) pages; this machine and private networks are refused', () => {
  assert.equal(safeUrl('https://example.org/app'), 'https://example.org/app');
  for (const u of ['http://localhost:8080/', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.20.0.1/', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'javascript:alert(1)', 'https://user:pw@example.org/', 'http://printer.local/', 'not a url', ''])
    assert.equal(safeUrl(u), null, u);
  assert.equal(safeUrl('http://127.0.0.1:8765/', true), 'http://127.0.0.1:8765/');
});

test('rea-study: REA runs pinned, with its passive web commands only', () => {
  assert.match(REA, /^rea-agents@\d+\.\d+\.\d+$/);
  assert.deepEqual([...ALLOWED].sort(), ['analyze-web-bundle', 'capture-web-screenshot', 'compare-web-screenshots', 'export-web-scripts', 'list-browser-targets', 'trace-web-source-location']);
  for (const c of ['observe-web-execution', 'observe-web-session', 'capture-browser-scenario', 'instrument-with-frida', 'debug-with-gdb']) assert.equal(ALLOWED.has(c), false, c);
});

test('rea-study: a pending and a finished study both fit Verse\'s memory (owner-only), the request kept out of the public summary', () => {
  const p = cleanRecord(studyRecord({ url: 'https://example.org/value', question: 'how does it value a coin from a photo' }));
  assert.ok(p); assert.equal(p.kind, 'study'); assert.match(p.summary, /^pending example\.org$/); assert.match(p.body, /how does it value a coin/);
  const d = cleanRecord(studyRecord({ url: 'https://example.org/value', question: 'q', digest: '# Study', counts: { scripts: 3, endpoints: 2, modules: 3 } }));
  assert.ok(d); assert.equal(d.id, cleanRecord(studyRecord({ url: 'https://example.org/value', question: 'q' })).id); assert.match(d.summary, /^studied example\.org: 3 scripts/);
});

test('rea-study: the digest keeps each finding\'s evidence and says what REA could not tell; it fits the memory body', () => {
  const result = { normalized_result: {
    capture: { scripts_observed: 2, scripts_analyzed: 2 }, completeness: { status: 'complete' },
    observations: { chunks: { nodes: [{ script_key: 'k1', url: 'https://example.org/app.js', bytes: 40960 }, { script_key: 'k2', url: 'https://example.org/vision.js?v=3', bytes: 2048 }], edges: [{}] },
      endpoints: [{ value: '/api/grade', mechanism: 'call:fetch', location: { script_key: 'k2', line: 88 } }], routes: [], webmcp_declarations: [{ name: 'grade_coin' }] },
    inferences: [{ kind: 'endpoint_candidate', value: 'upload', confidence: 'low', basis: [{ script_key: 'k1', line: 12 }] }],
    unknowns: [], limitations: ['String-built routes may remain unknown.'] } };
  const { digest, counts } = digestOf({ url: 'https://example.org/', question: 'how does it grade', at: '2026-10-15T00:00:00Z', result });
  assert.deepEqual(counts, { scripts: 2, endpoints: 1, modules: 2 });
  assert.match(digest, /Strongest evidence first[\s\S]*`\/api\/grade` high/);
  assert.match(digest, /`\/api\/grade` via call:fetch at \/vision\.js\?…:88/);
  assert.match(digest, /\/app\.js \(40 KB\)/); assert.match(digest, /grade_coin/); assert.match(digest, /upload.*low.*\/app\.js:12/);
  assert.match(digest, /could not tell[\s\S]*String-built routes/); assert.match(digest, /Never copy/);
  const big = { normalized_result: { ...result.normalized_result, observations: { ...result.normalized_result.observations, endpoints: Array.from({ length: 5000 }, (_, i) => ({ value: '/api/x' + i + 'y'.repeat(100), mechanism: 'call:fetch', location: { script_key: 'k1', line: i } })) } } };
  assert.ok(digestOf({ url: 'https://example.org/', question: 'q', at: 'now', result: big }).digest.length <= MAX_DIGEST);
});

import { studyScripts } from './study-engine.mjs';
test('rea-study: Verse\'s own read adds the feature trace, RPC operations and its own unknowns to the digest', () => {
  const own = { ...studyScripts([{ name: '/a.js', text: "async function gradeCoin(){\n fetch('/api/trpc/coin.grade')\n}" }], { word: 'grade' }), word: 'grade' };
  const { digest } = digestOf({ url: 'https://example.org/', question: 'how does it grade', at: 'now', result: { normalized_result: {} }, own });
  assert.match(digest, /Where "grade" lives[\s\S]*\/a\.js:1 in gradeCoin\(\)/); assert.match(digest, /RPC and GraphQL[\s\S]*\/api\/trpc\/coin\.grade/); assert.match(digest, /own read could not tell/);
});
