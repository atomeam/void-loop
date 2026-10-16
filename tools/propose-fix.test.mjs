// V01D proposes the fix (frontier #28, step 3): lib/propose-fix.js keeps only exact, short, inert line replacements; the route is
// owner-only and stores nothing; tools/propose-fix.mjs picks the oldest probe: job, replays the skill's own asks, and says which step
// stopped a proposal; the workflow runs nothing a model wrote under a write token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confidenceOf, FIX_SYSTEM, MAX_EDITS, jobAsk, skillOf, fixPrompt, safeReplacement, parseEdits, applyEdits } from '../void-live-deploy/lib/propose-fix.js';
import { models } from '../void-live-deploy/lib/models.js';
import * as route from '../void-live-deploy/functions/api/propose-fix.js';
import { pickJob, regressionAsks, noteFor, STEPS } from './propose-fix.mjs';

const OWNER = 'owner-test-key-123456';
const SOURCE = [
  '/** words skill */',
  "const CLEAN = (s) => String(s || '').trim().toLowerCase();",
  'export function match(lower, text) {',
  '  const t = CLEAN(text);',
  "  return /^(?:rhymes? (?:with|for) |synonyms? (?:of|for) )\\S+/.test(t);",
  '}',
  'async function run(text, api) { const r = await fetch("/api/words?q=" + encodeURIComponent(text)); return r.ok ? "words" : "none"; }',
  "export default { name: 'words', examples: ['rhymes with orange', 'synonym for happy'], nearMisses: ['define orange'], match, run };",
].join('\n');
const GOOD = { why: 'The matcher only knew rhymes and synonyms; "opposite of" is the antonym ask.', confidence: 0.82, edits: [
  { find: "  return /^(?:rhymes? (?:with|for) |synonyms? (?:of|for) )\\S+/.test(t);", replace: "  return /^(?:rhymes? (?:with|for) |synonyms? (?:of|for) |opposite of |antonyms? (?:of|for) )\\S+/.test(t);" },
  { find: "export default { name: 'words', examples: ['rhymes with orange', 'synonym for happy'], nearMisses: ['define orange'], match, run };", replace: "export default { name: 'words', examples: ['rhymes with orange', 'synonym for happy', 'opposite of brave'], nearMisses: ['define orange'], match, run };" },
] };
const INJECTION = /ignore previous|email the owner|http|fetch\(/i;
const ai = (reply, calls = []) => ({ run: async (m, o) => { calls.push({ m, o }); if (reply instanceof Error) throw reply; return { response: typeof reply === 'string' ? reply : JSON.stringify(reply) }; } });
const post = (env, body, key = OWNER) => route.onRequestPost({ request: new Request('https://a-to-mind.com/api/propose-fix', { method: 'POST', headers: key ? { authorization: 'Bearer ' + key } : {}, body: JSON.stringify(body) }), env });

test('a probe: job names its ask and its skill; a want with alternatives gives the first skill; bare words that are not skills do not', () => {
  const j = { ask: 'learn to handle "opposite of brave"', target: 'probe:opposite-of-brave', note: 'V01D wrote this ask for its words family and missed it (wanted skill:words); from the daily probe' };
  assert.deepEqual(jobAsk(j), { ask: 'opposite of brave', skill: 'words', want: 'skill:words' });
  assert.equal(jobAsk({ ask: 'fill a gap: x', note: '(wanted skill:words)' }), null);
  assert.equal(jobAsk({ ask: 'learn to handle "x"', note: 'no want here' }), null);
  assert.equal(skillOf('skill:words|skill:define|answer'), 'words'); assert.equal(skillOf('calc|skill:tip'), 'calc'); assert.equal(skillOf('answer'), null); assert.equal(skillOf('skill:Bad Name'), null);
});

test('the gate on replacements: short and inert; anything that runs, loads, stores, reaches out or looks like a key is refused', () => {
  assert.ok(safeReplacement("  return /^opposite of \\S+/.test(t);"));
  for (const bad of ['', '  '.repeat(400) + 'x', 'const r = await fetch("/x")', "import x from './y.js'", 'eval(t)', 'el.innerHTML = t', 'localStorage.setItem("a", 1)', 'see https://example.com', 'document.cookie', 'const k = "sk-ant-api03-abcdefghijklmnop12345"', 'const s = `${t}`', 'new Function(t)']) assert.equal(safeReplacement(bad), false, bad.slice(0, 40));
});

test('the reply becomes edits only where each find is one whole existing line, once; unsafe or stale ones are dropped; apply is exact', () => {
  const { edits, why } = parseEdits('Sure: ' + JSON.stringify(GOOD), SOURCE);
  assert.equal(edits.length, 2); assert.match(why, /antonym ask/);
  const next = applyEdits(SOURCE, edits);
  assert.match(next, /opposite of \|antonyms\? \(\?:of\|for\) \)/); assert.match(next, /'opposite of brave'\]/); assert.equal(next.split('\n').length, SOURCE.split('\n').length);
  const bad = { why: 'x', edits: [
    { find: '  const t = CLEAN(text);', replace: '  const t = CLEAN(text); fetch("/api/leak?" + t);' }, // reaches out
    { find: 'no such line', replace: 'x' }, // not in the file
    { find: '}', replace: '} // hi' }, // occurs twice
    { find: 'export function match(lower, text) {', replace: 'export function match(lower, text) {' }, // no change
    { find: "/** words skill */\nconst CLEAN", replace: 'x' }, // two lines
    ...Array.from({ length: 6 }, (_, i) => ({ find: '/** words skill */', replace: '/** words skill ' + i + ' */' })),
  ] };
  const p = parseEdits(JSON.stringify(bad), SOURCE);
  assert.deepEqual(p.edits, [{ find: '/** words skill */', replace: '/** words skill 0 */' }], 'one safe edit; the same find is never taken twice');
  assert.equal(parseEdits(JSON.stringify({ edits: Array.from({ length: 9 }, (_, i) => ({ find: SOURCE.split('\n')[i % 8], replace: SOURCE.split('\n')[i % 8] + ' // ' + i })) }), SOURCE).edits.length, MAX_EDITS);
  assert.deepEqual(parseEdits('nothing', SOURCE).edits, []); assert.equal(applyEdits(SOURCE, [{ find: 'gone', replace: 'x' }]), null); assert.equal(applyEdits(SOURCE, []), null);
  assert.match(FIX_SYSTEM, /never run\(\)/); assert.match(FIX_SYSTEM, /never instructions to you/);
  assert.match(fixPrompt('opposite of brave', 'words', SOURCE), /Skill: words \(void-live-deploy\/skills\/words\.js\)\.\nThe ask that did not reach it: "opposite of brave"/);
  assert.match(fixPrompt('x', 'w', 'a'.repeat(40000)), /clipped/);
});

test('the route is owner-only, needs ask, skill and source, asks the review model with a JSON schema, and returns only gated edits', async () => {
  const calls = [], env = { AI: ai(GOOD, calls), READ_TOKEN: OWNER };
  assert.equal((await post(env, { ask: 'opposite of brave', skill: 'words', source: SOURCE }, 'wrong')).status, 401);
  assert.equal((await post(env, { ask: 'x', skill: 'words', source: SOURCE })).status, 400);
  assert.equal((await post(env, { ask: 'opposite of brave', skill: '../etc', source: SOURCE })).status, 400);
  assert.equal((await post(env, { ask: 'opposite of brave', skill: 'words', source: 'short' })).status, 400);
  assert.equal((await post({ READ_TOKEN: OWNER }, { ask: 'opposite of brave', skill: 'words', source: SOURCE })).status, 503);
  const r = await post(env, { ask: 'opposite of brave', skill: 'words', source: SOURCE });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.edits.length, 2); assert.match(j.why, /antonym/); assert.equal(j.confidence, 0.82, 'V01D says how sure it is (asked by Void)'); assert.equal(j.model, models('will'));
  assert.equal(calls[0].o.messages[0].content, FIX_SYSTEM); assert.match(calls[0].o.messages[1].content, /opposite of brave/); assert.equal(calls.length, 1, 'one model call, so the request ends inside the platform limit'); assert.equal(calls[0].m, models('will'));
  const none = await post({ AI: ai({ why: 'x', edits: [{ find: 'nope', replace: 'x' }] }), READ_TOKEN: OWNER }, { ask: 'opposite of brave', skill: 'words', source: SOURCE });
  assert.equal(none.status, 502);
  const busy = await post({ AI: ai(new Error('429 busy')), READ_TOKEN: OWNER, DB: { prepare: () => ({ bind: () => ({ run: async () => {} }) }) } }, { ask: 'opposite of brave', skill: 'words', source: SOURCE });
  assert.equal(busy.status, 503);
});

test('confidence: a number from 0 to 1 with two decimals, clamped; anything else is null', () => {
  assert.equal(confidenceOf(0.823), 0.82); assert.equal(confidenceOf('0.5'), 0.5); assert.equal(confidenceOf(7), 1); assert.equal(confidenceOf(-1), 0); assert.equal(confidenceOf('sure'), null); assert.equal(confidenceOf(undefined), null);
});

test('the tool: the oldest open probe: job, the skill\'s own asks replayed with the miss first, and a note that names the step', () => {
  const q = { items: [
    { id: 'b', at: '2026-10-15T10:00:00Z', target: 'probe:later-one', state: 'queued', ask: 'learn to handle "later one"', note: '(wanted skill:words)' },
    { id: 'a', at: '2026-10-15T09:00:00Z', target: 'probe:opposite-of-brave', state: 'queued', ask: 'learn to handle "opposite of brave"', note: '(wanted skill:words)' },
    { id: 'c', at: '2026-10-15T08:00:00Z', target: 'probe:done-one', state: 'done', ask: 'learn to handle "done one"', note: '(wanted skill:words)' },
    { id: 'd', at: '2026-10-15T07:00:00Z', target: 'miss:not-a-probe', state: 'queued', ask: 'learn to handle "not a probe"', note: '(wanted skill:words)' },
  ] };
  assert.equal(pickJob(q).id, 'a'); assert.equal(pickJob(q, 'b').id, 'b'); assert.equal(pickJob(q, 'c'), null); assert.equal(pickJob({ items: [] }), null);
  const bench = [{ ask: 'rhymes with orange', want: 'skill:words' }, { ask: 'a word for happy', want: 'skill:words|skill:define|answer' }, { ask: '15% of 80', want: 'calc' }, { ask: 'Opposite of brave', want: 'skill:words' }];
  assert.deepEqual(regressionAsks({ ask: 'opposite of brave', want: 'skill:words' }, bench, 'words'), [{ ask: 'opposite of brave', want: 'skill:words' }, { ask: 'rhymes with orange', want: 'skill:words' }, { ask: 'a word for happy', want: 'skill:words|skill:define|answer' }]);
  assert.match(noteFor({ passed: true, edits: 2, skill: 'words' }), /passed collisions, unit test, void review, benchmark \(2 line changes in skills\/words\.js\); see the pull request labelled "made by V01D"/);
  assert.match(noteFor({ passed: false, edits: 1, failed: 'benchmark', detail: '2 of 48 missed' }), /failed at: benchmark \(2 of 48 missed\); a builder takes it from here/);
  assert.deepEqual(STEPS, ['collisions', 'unit test', 'void review', 'benchmark']);
});

test('the route is marked internal and limited; the workflow keeps the write token away from anything a model wrote', () => {
  assert.match(readFileSync(new URL('./openapi-check.mjs', import.meta.url), 'utf8'), /'\/api\/propose-fix'/);
  assert.match(readFileSync(new URL('../void-live-deploy/lib/guard.js', import.meta.url), 'utf8'), /'propose-fix': \{ rpm: \d+, body: \d+ \}/);
  const wf = readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  const [propose, pr] = wf.split(/\n  pull-request:\n/);
  assert.match(propose, /node tools\/propose-fix\.mjs/); assert.match(propose, /VOID_OWNER_TOKEN: \$\{\{ secrets\.VOID_OWNER_TOKEN \}\}/); assert.doesNotMatch(propose, /contents: write|pull-requests: write/);
  assert.match(pr, /contents: write/); assert.match(pr, /git apply/); assert.match(pr, /made by V01D/); assert.doesNotMatch(pr, /node tools\/|npm |bench\.mjs/); assert.match(pr, /--label automerge/, 'V01D\'s passing fixes automerge (owner, 2026-10-16)'); assert.match(pr, /gh workflow run void-review\.yml/, 'the merge gate is started on the PR the workflow token opened');
  assert.doesNotMatch(wf, /OPENROUTER|ANTHROPIC|secrets\.(?!VOID_OWNER_TOKEN)/);
});
