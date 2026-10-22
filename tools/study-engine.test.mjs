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
