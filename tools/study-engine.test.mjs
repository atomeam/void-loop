// node --test tools/study-engine.test.mjs: Verse's own study engine (tools/study-engine.mjs), the parts beyond REA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScript, rankFindings, unknownsOf, cacheFresh, diffStudies, combineStudies, relatedStudies, buildBrief, studyScripts } from './study-engine.mjs';

const A = "const r = await fetch('/api/grade', {method:'POST'});\nconst ws = new WebSocket(`wss://x.example/live/${id}`);\naxios.get('/api/coins');\nconst q = 'query CoinValue { coin { id } }';\nconst p = '/api/coins';\n//# sourceMappingURL=app.js.map";
test('study-engine: reads endpoints, GraphQL and source maps with line evidence', () => {
  const a = analyzeScript(A, 'app.js');
  const by = (v) => a.findings.find((f) => f.value === v);
  assert.equal(by('/api/grade').mechanism, 'call:fetch'); assert.equal(by('/api/grade').line, 1);
  assert.equal(by('wss://x.example/live/{…}').built, true);
  assert.equal(by('/api/coins').mechanism, 'call:http-client');
  assert.ok(a.findings.some((f) => f.kind === 'graphql' && f.value === 'query CoinValue'));
  assert.equal(a.sourceMap, 'app.js.map'); assert.equal(a.minified, false);
  assert.equal(analyzeScript('var a=1;'.repeat(600), 'm.js').minified, true);
});
test('study-engine: evidence ranks direct calls over guesses and more sightings higher', () => {
  const r = rankFindings([analyzeScript(A, 'app.js'), analyzeScript("fetch('/api/grade')", 'b.js')]);
  assert.equal(r[0].value, '/api/grade'); assert.equal(r[0].scripts, 2); assert.ok(['exact', 'high'].includes(r[0].confidence));
  const coins = r.find((f) => f.value === '/api/coins'); assert.deepEqual(coins.mechanisms, ['call:http-client', 'string:path']);
  assert.equal(rankFindings([analyzeScript("x='/api/maybe'", 'c.js')])[0].confidence, 'low');
});
test('study-engine: says what it could not tell', () => {
  assert.match(unknownsOf([]).join(' '), /No scripts/);
  const u = unknownsOf([analyzeScript('var a=1;'.repeat(600), 'm.js'), analyzeScript(A, 'app.js')]).join(' ');
  assert.match(u, /minified script\(s\) had no source map/); assert.match(u, /built at run time/); assert.match(u, /server-side/);
});
test('study-engine: cache, diff over time, combine sites, retrieval, build brief with nothing studied named', () => {
  assert.equal(cacheFresh({ studiedAt: '2026-10-20T00:00:00Z' }, Date.parse('2026-10-21T00:00:00Z')), true);
  assert.equal(cacheFresh({ studiedAt: '2026-09-01T00:00:00Z' }, Date.parse('2026-10-21T00:00:00Z')), false);
  assert.equal(cacheFresh({}), false);
  const s1 = studyScripts([{ name: 'app.js', text: A }]), s2 = studyScripts([{ name: 'app2.js', text: "fetch('/api/grade');fetch('/api/v2/price')" }]);
  const d = diffStudies(s1, s2); assert.ok(d.added.includes('endpoint /api/v2/price')); assert.ok(d.gone.includes('endpoint /api/coins')); assert.deepEqual(d.modulesAdded, ['app2.js']);
  const c = combineStudies([s1, s2]); assert.equal(c[0].sites, 2); assert.equal(c[0].shared, true);
  const rel = relatedStudies('how does it value a coin', [{ id: 'a', question: 'how does it value a coin from a photo' }, { id: 'b', question: 'map tiles' }]);
  assert.deepEqual(rel.map((x) => x.id), ['a']);
  const b = buildBrief({ ...s1, id: 'study-1' }, 'coin grader at https://x.example/p');
  assert.equal(b.kind, 'want'); assert.doesNotMatch(b.text, /https?:|x\.example/); assert.match(b.text, /copy nothing/);
});

import { vlq, decodeSourceMap, originalPosition, readable, rpcOf, traceFeature, visualDiff, studyBoosts } from './study-engine.mjs';
test('study-engine: decodes source maps (VLQ) and finds the original line and name', () => {
  assert.deepEqual(vlq('AAAA'), [0, 0, 0, 0]); assert.deepEqual(vlq('gB'), [16]); assert.deepEqual(vlq('D'), [-1]); assert.equal(vlq('g'), null);
  // generated line 1: col 0 -> src0 line0 col0 name0; col 9 -> src0 line1 col2 name1
  const d = decodeSourceMap({ version: 3, sources: ['src/grade.ts'], names: ['gradeCoin', 'price'], mappings: 'AAAAA,SACEC' });
  assert.deepEqual(originalPosition(d, 1, 12), { source: 'src/grade.ts', line: 2, column: 2, name: 'price' });
  assert.deepEqual(originalPosition(d, 1, 0), { source: 'src/grade.ts', line: 1, column: 0, name: 'gradeCoin' });
  assert.equal(decodeSourceMap('{"version":2}'), null); assert.equal(originalPosition(d, 9, 0), null);
});
test('study-engine: makes minified code readable without breaking strings or regexes, names restored from the map', () => {
  const r = readable('function a(b){if(b){return "x;{y}"}var c=/[;{]/g;return c}a(1);', { names: { a: 'gradeCoin' } });
  assert.match(r, /function gradeCoin\(b\) \{\n  if\(b\) \{\n    return "x;\{y\}"\n  \}/); assert.match(r, /\/\[;\{\]\/g;/); assert.match(r, /gradeCoin\(1\);/);
  assert.match(readable('for(i=0;i<3;i++){x()}'), /for\(i=0;i<3;i\+\+\) \{/);
});
test('study-engine: finds tRPC, JSON-RPC and gRPC-web calls', () => {
  const r = rpcOf("fetch('/api/trpc/coin.grade');\nsend({jsonrpc:'2.0',id:1,method:'eth_getBalance'});\nc.unary('/shop.v1.Cart/AddItem')", 'r.js');
  assert.deepEqual(r.map((x) => [x.mechanism, x.value, x.line]), [['rpc:trpc', '/api/trpc/coin.grade', 1], ['rpc:json-rpc', 'eth_getBalance', 2], ['rpc:grpc-web', '/shop.v1.Cart/AddItem', 3]]);
});
test('study-engine: traces a feature from one word to its function and nearby calls', () => {
  const t = traceFeature([{ name: 'a.js', text: "const x = 1;\nasync function gradeCoin(img) {\n  // grade the coin\n  const r = await fetch('/api/grade');\n}\nconst label = 'grade';" }], 'grade');
  assert.equal(t[0].fn, 'gradeCoin'); assert.ok(t[0].nearCalls[0].startsWith('/api/grade (call:fetch'));
  assert.deepEqual(traceFeature([], 'ab'), []);
});
test('study-engine: compares two captures pixel by pixel; strong studies raise their want', () => {
  const px = (v) => ({ width: 2, height: 2, data: Uint8Array.from({ length: 16 }, (_, i) => (i === 4 ? v : 0)) });
  assert.deepEqual(visualDiff(px(0), px(9)), { comparable: true, changed: 1, share: 0.25, box: { x: 1, y: 0, w: 1, h: 1 } });
  assert.equal(visualDiff(px(0), px(9), 10).changed, 0); assert.equal(visualDiff(px(0), { width: 1, height: 1, data: [] }).comparable, false);
  const b = studyBoosts([{ skill: 'coin', ranked: [{ confidence: 'high' }, { confidence: 'exact' }, { confidence: 'low' }] }, { skill: 'map', ranked: [] }]);
  assert.deepEqual(b, { coin: 1.2, map: 1 });
});
