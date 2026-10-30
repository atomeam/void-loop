// Verse proposes the fix (frontier #28, step 3): lib/propose-fix.js keeps only exact, short, inert line replacements; the route is
// owner-only and stores nothing; tools/propose-fix.mjs picks the oldest probe: job, replays the skill's own asks, and says which step
// stopped a proposal; the workflow runs nothing a model wrote under a write token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { confidenceOf, FIX_SYSTEM, MAX_EDITS, MAX_TRIED, jobAsk, skillOf, fixPrompt, safeReplacement, parseEdits, applyEdits, evidenceOf, whereOf, settleNote } from '../void-live-deploy/lib/propose-fix.js';
import { models } from '../void-live-deploy/lib/models.js';
import * as route from '../void-live-deploy/functions/api/propose-fix.js';
import { pickJob, regressionAsks, noteFor, STEPS, letsGo, answers, titleFor, collisionLines, landing, letGoJob, SETTLE_TRIES } from './propose-fix.mjs';

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
  const j = { ask: 'learn to handle "opposite of brave"', target: 'probe:opposite-of-brave', note: 'Verse wrote this ask for its words family and missed it (wanted skill:words); from the daily probe' };
  assert.deepEqual(jobAsk(j), { ask: 'opposite of brave', skill: 'words', want: 'skill:words', mode: 'learn' });
  // a routing correction (owner, 2026-10-16): the skill that wrongly answered is the one to change
  assert.deepEqual(jobAsk({ ask: 'stop answering "quoting a chat about your memory"', target: 'route:quoting', note: 'My owner said a card was not its job (wrong skill:automation-fix) (wanted answer)' }),
    { ask: 'quoting a chat about your memory', skill: 'automation-fix', want: 'answer', mode: 'narrow' });
  assert.equal(jobAsk({ ask: 'stop answering "x y z"', note: 'no wrong skill named' }), null);
  // the exact note functions/api/voice-reply.js writes for a misrouted card
  assert.deepEqual(jobAsk({ ask: 'stop answering "he said your memory resets like a zapier webhook"', target: 'route:automation-fix-he-said', note: 'My owner said this card was not its job (wrong skill:automation-fix) (wanted answer): "I am quoting a conversation about your memory, not fixing a webhook."' }),
    { ask: 'he said your memory resets like a zapier webhook', skill: 'automation-fix', want: 'answer', mode: 'narrow' });
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
  assert.equal(j.edits.length, 2); assert.match(j.why, /antonym/); assert.equal(j.confidence, 0.82, 'Verse says how sure it is (asked by Verse)'); assert.deepEqual(j.evidence.map((e) => [e.file, e.line]), [['void-live-deploy/skills/words.js', 5], ['void-live-deploy/skills/words.js', 8]], 'each edit cites its file and line (asked by Verse)'); assert.equal(j.model, models('will'));
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
  assert.match(noteFor({ passed: true, edits: 2, skill: 'words' }), /passed collisions, unit test, void review, benchmark, answers \(2 line changes in skills\/words\.js\); it went onto main when Verse was sure/);
  assert.match(noteFor({ passed: false, edits: 1, failed: 'benchmark', detail: '2 of 48 missed' }), /failed at: benchmark \(2 of 48 missed\)$/);
  assert.deepEqual(STEPS, ['collisions', 'lets go', 'unit test', 'void review', 'benchmark', 'answers']);
  assert.match(noteFor({ passed: true, edits: 1, skill: 'automation-fix', mode: 'narrow' }), /passed collisions, lets go, unit test, void review, benchmark/);
  // a routing correction: the oldest route: job is picked like a probe, and the bench replays only what the skill should keep
  const r = { items: [{ id: 'r', at: '2026-10-15T06:00:00Z', target: 'route:quoting', state: 'queued', ask: 'stop answering "quoting a chat about memory"', note: '(wrong skill:words) (wanted answer)' }, ...q.items] };
  assert.equal(pickJob(r).id, 'r', 'words has a skill file: its route job comes first, being the oldest');
  const inline = { items: [{ id: 'f', at: '2026-10-15T05:00:00Z', target: 'route:automation-fix-x', state: 'queued', ask: 'stop answering "quoting a chat"', note: '(wrong skill:automation-fix) (wanted answer)' }, ...q.items] };
  assert.equal(pickJob(inline).id, 'a', 'the automation fix is routed inside the page, not a skill file: its job is a builder\'s and never blocks the probes');
  assert.equal(pickJob(inline, '', () => true).id, 'f');
  assert.deepEqual(regressionAsks({ ask: 'rhymes with orange', want: 'answer', mode: 'narrow' }, bench, 'words').map((b) => b.ask), ['a word for happy', 'Opposite of brave']);
});

test('the route is marked internal and limited; the workflow keeps the write token away from anything a model wrote', () => {
  assert.match(readFileSync(new URL('./openapi-check.mjs', import.meta.url), 'utf8'), /'\/api\/propose-fix'/);
  assert.match(readFileSync(new URL('../void-live-deploy/lib/guard.js', import.meta.url), 'utf8'), /'propose-fix': \{ rpm: \d+, body: \d+ \}/);
  const wf = readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  const [propose, pr] = wf.split(/\n  pull-request:\n/);
  assert.match(propose, /node tools\/propose-fix\.mjs/); assert.match(propose, /VOID_OWNER_TOKEN: \$\{\{ secrets\.VOID_OWNER_TOKEN \}\}/); assert.doesNotMatch(propose, /contents: write|pull-requests: write/);
  assert.match(pr, /contents: write/); assert.match(pr, /git apply/); assert.doesNotMatch(pr, /node tools\/|npm |bench\.mjs/); assert.match(pr, /\[ "\$gate" = "automerge" \]/, 'Verse\'s passing fixes go by the confidence gate (owner, 2026-10-16)'); assert.match(pr, /git push -q origin HEAD:main/, 'a sure fix goes onto main: its review ran in the propose job (2026-10-19: Actions may not open pull requests here)');
  // the one outside key (owner, 2026-10-16: Claude as the builder brain): the propose job only, and only on a run that picked Claude;
  // the job that holds the write token never sees it
  assert.doesNotMatch(wf, /OPENROUTER|secrets\.(?!VOID_OWNER_TOKEN|ANTHROPIC_API_KEY\b)/);
  assert.equal(propose.match(/secrets\.ANTHROPIC_API_KEY/g).length, 1);
  assert.match(propose, /ANTHROPIC_API_KEY: \$\{\{ inputs\.brain == 'claude' && secrets\.ANTHROPIC_API_KEY \|\| '' \}\}/);
  assert.doesNotMatch(pr, /ANTHROPIC/);
});

test('evidence (asked by Verse): each edit names its file, its line number and the line as it stood; a stale edit has none', () => {
  const ev = evidenceOf(SOURCE, GOOD.edits, 'words');
  assert.deepEqual(ev.map((e) => e.line), [5, 8]); assert.equal(ev[0].file, 'void-live-deploy/skills/words.js'); assert.match(ev[0].was, /^return \/\^\(\?:rhymes/);
  assert.equal(whereOf(ev), 'void-live-deploy/skills/words.js lines 5, 8'); assert.equal(whereOf(ev.slice(0, 1)), 'void-live-deploy/skills/words.js line 5'); assert.equal(whereOf([]), '');
  assert.deepEqual(evidenceOf(SOURCE, [{ find: 'not in the file', replace: 'x' }], 'words'), []);
  const wf = readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  assert.match(wf, /Verse's confidence: \$CONFIDENCE\. Where: \$WHERE\./, 'the pull request Verse opens says how sure it was and where');
});

test('lets go: a routing correction passes only when the edited skill, loaded fresh, no longer takes the ask', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs'); const { join } = await import('node:path'); const os = await import('node:os');
  const dir = mkdtempSync(join(os.tmpdir(), 'letsgo-')), file = join(dir, 'fixy.js');
  writeFileSync(file, "export default { name: 'fixy', match(lower) { return /webhook|zapier|memory/.test(lower); } };");
  assert.equal(await letsGo(file, 'I am quoting a chat about your memory'), 'the skill still takes the ask');
  writeFileSync(file, "export default { name: 'fixy', match(lower) { return /webhook|zapier/.test(lower) && !/quoting/.test(lower); } };");
  assert.equal(await letsGo(file, 'I am quoting a chat about your memory'), '', 'loaded fresh: the edit is what is checked');
  writeFileSync(file, 'export default {');
  assert.match(await letsGo(file, 'x'), /did not load/);
});

test('the confidence gate (owner, 2026-10-16): 0.8 and up is labelled automerge, anything less or none waits for the owner', () => {
  const wf = readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  const m = /gate=\$\(node -e '([^']+)' "\$CONFIDENCE"\)/.exec(wf); assert.ok(m, 'the gate is computed from the confidence');
  const gate = (c) => { let out = ''; const log = console.log; console.log = (x) => { out = x; }; try { new Function('process', m[1])({ argv: ['node', c] }); } finally { console.log = log; } return out; };
  assert.equal(gate('0.8'), 'automerge'); assert.equal(gate('0.93'), 'automerge'); assert.equal(gate('0.79'), 'waits for owner'); assert.equal(gate('none given'), 'waits for owner'); assert.equal(gate(''), 'waits for owner');
  // no pull request can be opened from Actions here (2026-10-19): sure enough goes onto main, anything less waits on its branch
  assert.match(wf, /if \[ "\$gate" = "automerge" \]; then[\s\S]*git push -q origin HEAD:main[\s\S]*else[\s\S]*git push -q origin "\$branch"/); assert.doesNotMatch(wf, /gh pr create/);
});

test('the workflow installs packages before its checks (the Claude brain test imports the SDK; the daily fix run failed at this step until 2026-10-16)', async () => {
  const wf = (await import('node:fs')).readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  assert.ok(wf.indexOf('npm ci --no-audit') > 0 && wf.indexOf('npm ci --no-audit') < wf.indexOf('node --test tools/propose-fix.test.mjs'));
});

test('a missed ask the router says a skill should have caught is a propose-fix job (lane), one with no skill near is a builder\'s (asked by Verse)', () => {
  const q = { items: [
    { id: 'm1', at: '2026-10-16T09:00:00Z', target: 'miss:cab-to-oakland', state: 'queued', ask: 'learn to handle "cab to oakland"', note: 'asked 3× (1 phrasing), last 2026-10-15; router skill:rides 0.71; lane: propose-fix; from the miss board' },
    { id: 'm2', at: '2026-10-16T08:00:00Z', target: 'miss:sunset-on-mars', state: 'queued', ask: 'learn to handle "sunset on mars"', note: 'asked 3× (1 phrasing), last 2026-10-15; router simple 0.30; lane: new skill; from the miss board' },
  ] };
  assert.deepEqual(jobAsk(q.items[0]), { ask: 'cab to oakland', skill: 'rides', want: 'skill:rides', mode: 'learn' });
  assert.equal(jobAsk(q.items[1]), null);
  assert.equal(pickJob(q, '', () => true).id, 'm1'); assert.equal(pickJob({ items: [q.items[1]] }, '', () => true), null);
});

test('a job leaves the open list after an attempt: done when its fix passed, failed (with the step) when it did not, so the next one gets its turn (2026-10-19)', async () => {
  const { stateFor, noteFor } = await import('./propose-fix.mjs');
  assert.equal(stateFor({ passed: true }), 'done'); assert.equal(stateFor({ passed: false, failed: 'benchmark' }), 'failed');
  assert.match(noteFor({ passed: false, failed: 'benchmark', edits: 1, detail: '1 of 1 missed' }), /failed at: benchmark \(1 of 1 missed\)$/);
});

test('a gateway error (502, 503, 504) gets one more try; an answer (2xx, 4xx, 500) does not (2026-10-19)', async () => {
  const { retryable } = await import('./propose-fix.mjs');
  for (const s of [502, 503, 504]) assert.equal(retryable(s), true, String(s));
  for (const s of [200, 400, 401, 404, 409, 429, 500]) assert.equal(retryable(s), false, String(s));
});

test('the source window: a small file whole, a big one as its head and its tail (where match() lives) within the model\'s limit and the route\'s body cap', async () => {
  const { sourceWindow } = await import('./propose-fix.mjs');
  const { MAX_SOURCE } = await import('../void-live-deploy/lib/propose-fix.js');
  assert.equal(sourceWindow('export default { match() {} }'), 'export default { match() {} }');
  const big = 'const css = "' + 'x'.repeat(60000) + '";\nexport default { name: "big", match(lower) { return /big/.test(lower); } };\n';
  const w = sourceWindow(big);
  assert.ok(w.length <= MAX_SOURCE, 'fits the model: ' + w.length);
  assert.ok(Buffer.byteLength(JSON.stringify({ ask: 'x'.repeat(160), skill: 'big', source: w })) < 40000, 'fits the route\'s 40,000-byte guard');
  assert.ok(w.startsWith('const css = "'), 'the head is there');
  assert.ok(w.endsWith('match(lower) { return /big/.test(lower); } };\n'), 'the tail with match() is there');
  assert.match(w, /clipped/);
});

// 2026-10-30: a fix for "how far is nyc to london" passed every step and went out as "Verse fixes its distance skill" while the live card said
// "I couldn't find “is nyc”": the benchmark checks the route, not the answer. The answers step runs the edited skill and reads its card.
test('answers: the card must answer the ask before a fix is called a fix; "fixes" in the title only then', async () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'pf-answers-'));
  const skill = (name, body) => { const f = join(dir, name + '.js'); writeFileSync(f, 'export default { name: "' + name + '", match: () => true, async run(text, api) { ' + body + ' } };'); return f; };
  assert.deepEqual(await answers(skill('found', 'api.showPage((p) => { p.innerHTML = "<h2>New York → London</h2><div>5,570 km</div>"; }); return "found";'), 'is nyc → london'), { outcome: 'answered', why: '' });
  const no = await answers(skill('lost', 'api.showPage((p) => { p.innerHTML = "<h2>is nyc → London</h2><p>I couldn\'t find “is nyc”. Try a city name.</p>"; }); return "none";'), 'is nyc → london');
  assert.equal(no.outcome, 'no answer'); assert.match(no.why, /couldn't find “is nyc”/);
  assert.equal((await answers(skill('blank', 'return "none";'), 'x')).outcome, 'no answer', 'nothing drawn is no answer');
  assert.equal((await answers(skill('dom', 'document.body.append("x"); return "dom";'), 'x')).outcome, 'not run', 'a skill that needs the real page cannot be checked here');
  assert.equal((await answers(skill('slow', 'await new Promise(() => {});'), 'x', { timeoutMs: 50 })).outcome, 'not run');
  const miss = { skill: 'distance', ask: 'how far is nyc to london' };
  assert.equal(titleFor(miss, 'answered'), 'Verse fixes its distance skill: learn to handle "how far is nyc to london"');
  assert.equal(titleFor(miss, 'not run'), 'Verse routes "how far is nyc to london" to its distance skill (the answer is not checked)');
  assert.ok(!/fixes/.test(titleFor(miss, '')), 'no title says "fixes" before the answer is read');
  assert.match(titleFor({ ...miss, mode: 'narrow' }, ''), /lets go of/);
  assert.match(noteFor({ passed: false, edits: 1, failed: 'answers', detail: 'the card says: I couldn\'t find “is nyc”' }), /failed at: answers/);
});

test('settling an overlap: a try that does not settle goes back to the model with what the collision check said (2026-10-30: 95 of 136 died there)', () => {
  assert.match(FIX_SYSTEM, /without changing the pattern match\(\) uses always fails/);
  assert.match(settleNote('coin', 'coinflip', { applied: false }), /copied whole/);
  assert.match(settleNote('coin', 'coinflip', { applied: true, loadError: 'Invalid regular expression' }), /did not load \(Invalid regular expression\)/);
  assert.match(settleNote('coin', 'coinflip', { applied: true, takes: false }), /match\(\) still does not take "coinflip": change the pattern/);
  assert.match(settleNote('suntimes', 'sun times chicago', { applied: true, takes: true, by: 'dates' }), /the dates skill comes earlier/);
  const lines = ['dates: "what day is it" -> suntimes', 'coin: "coinflip" -> coin', 'a', 'b', 'c', 'd', 'e', 'f'];
  const n = settleNote('suntimes', 'coinflip', { applied: true, takes: true, by: 'suntimes', lines });
  assert.match(n, /dates: "what day is it" -> suntimes/); assert.ok(!n.includes('"coinflip" -> coin'), 'the ask\'s own line is not a breakage');
  assert.match(n, /narrower/); assert.ok(n.length <= MAX_TRIED);
  assert.ok(settleNote('x', 'y', { applied: true, takes: true, by: 'x', lines: ['z: "q" -> x'.repeat(200)] }).length <= MAX_TRIED);
  const p = fixPrompt('coinflip', 'coin', 'const x = 1;', 'learn', '', 'match() still does not take it');
  assert.match(p, /Your last try did not pass\. match\(\) still does not take it/); assert.ok(!/last try/.test(fixPrompt('coinflip', 'coin', 'const x = 1;')));
  assert.ok(fixPrompt('a', 'b', 'c', 'learn', '', 'x'.repeat(5000)).length < 5000 + 300, 'the feedback is clipped');
  assert.deepEqual(collisionLines('ok\n  dates: "x" -> coin  \nsuite failed: coin\nnothing'), ['dates: "x" -> coin', 'suite failed: coin']);
  assert.ok(SETTLE_TRIES >= 2);
});

test('landing: where the ask goes with the edited file, the edited module standing in for its own skill in routing order', async () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'land-'));
  writeFileSync(join(dir, 'dates.js'), "export default { name: 'dates', match: (l) => /\\b(day|times?)\\b/.test(l) };\n");
  writeFileSync(join(dir, 'suntimes.js'), "export default { name: 'suntimes', match: (l) => /^sunrise\\b/.test(l) };\n");
  const edited = join(dir, 'suntimes-edit.js');
  writeFileSync(edited, "export default { name: 'suntimes', match: (l) => /^(sunrise|sun times)\\b/.test(l) };\n");
  assert.deepEqual(await landing(edited, 'suntimes', 'sun times chicago', ['dates', 'suntimes'], dir), { takes: true, by: 'dates', loadError: '' });
  assert.deepEqual(await landing(edited, 'suntimes', 'sun times chicago', ['suntimes', 'dates'], dir), { takes: true, by: 'suntimes', loadError: '' });
  writeFileSync(edited, "export default { name: 'suntimes', match: (l) => /^sunrise\\b/.test(l) };\n");
  assert.deepEqual(await landing(edited, 'suntimes', 'sun times chicago', ['suntimes', 'dates'], dir), { takes: false, by: 'dates', loadError: '' });
  writeFileSync(edited, "export default { match: (l) => /(/.test(l) };\n");
  const bad = await landing(edited, 'suntimes', 'sun times chicago', ['suntimes'], dir);
  assert.equal(bad.takes, false); assert.ok(bad.loadError);
});

test('letGoJob: an ask an earlier skill takes first becomes a routing correction that jobAsk reads as narrow mode', () => {
  const j = letGoJob('dates', 'suntimes', 'sun times chicago');
  assert.equal(j.target, 'route:dates-sun-times-chicago'); assert.ok(j.target.length <= 40);
  assert.deepEqual(jobAsk(j), { ask: 'sun times chicago', skill: 'dates', want: 'skill:suntimes', mode: 'narrow' });
  assert.ok(pickJob({ items: [{ ...j, id: 'q1', state: 'queued', at: '2026-10-30' }] }, '', () => true), 'the forge picks it up on its next run');
});
