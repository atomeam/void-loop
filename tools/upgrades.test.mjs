// tools/upgrades.mjs: Verse's own architectural upgrades, from measured friction to a component and a change, ranked.
import assert from 'node:assert/strict';
import { largestFunction, propose } from './upgrades.mjs';

// sizing: braces inside strings, comments and regex literals do not count
const src = "const tiny = (b) => { const r = /[{]/; return '}' + `{`; };\n// { not code\nfunction big(x) {\n  if (x) {\n    return /}/.test(x);\n  }\n  return 1;\n}\n";
assert.deepEqual(largestFunction(src), { name: 'big', lines: 6, at: 3 });
assert.equal(largestFunction('no functions here'), null);

const body = (n) => 'function wordMath(t) {\n' + '  t = t + 1;\n'.repeat(n) + '}\n';
const ps = propose({
  churn: { 'void.html': 200, 'void-live-deploy/lib/small.js': 2, 'void-live-deploy/lib/flat.js': 30 },
  files: { 'void.html': body(300), 'void-live-deploy/lib/small.js': 'x', 'void-live-deploy/lib/flat.js': 'const a = 1;\n'.repeat(400) },
  flakes: [{ check: 'router: x', at: '2026-10-13T10:00:00Z' }, { check: 'router: y', at: '2026-10-13T11:00:00Z' }, { check: 'once: z' }, { check: 'suite ran to the end', at: 'x' }, { check: 'suite ran to the end', at: 'y' }],
  families: { families: [{ skills: [{ name: 'weather', failing: ['rain later'] }, { name: 'clock' }] }] },
});
const by = (k) => ps.filter((p) => p.kind === k);
assert.deepEqual(by('hotspot').map((p) => p.component), ['void.html · wordMath()', 'void-live-deploy/lib/flat.js'], 'little churn is no hotspot; a big function is named');
assert.match(by('hotspot')[0].evidence, /changed in 200 commits in the last 30 days; its largest function, wordMath, is about 302 lines/);
assert.deepEqual(by('flaky').map((p) => p.component), ['the "router" checks'], 'red twice or more; once is not a pattern; the suite\'s own crash check is no area');
assert.deepEqual(by('failing').map((p) => p.component), ['skills/weather.js']);
assert.match(by('failing')[0].action, /widen weather's match to those wordings/);
assert.ok(ps.every((p, i) => i === 0 || ps[i - 1].score >= p.score), 'ranked by impact over cost');
assert.deepEqual(propose({}), []);
console.log('upgrades: ok');
