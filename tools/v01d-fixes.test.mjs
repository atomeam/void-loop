// V01D's fixes for the owner (lib/v01d-fixes.js, skills/v01d-fixes.js, functions/api/v01d-fixes.js): the open pull requests V01D
// opened, read from their labels and body; the waiting ones first; Approve swaps "waits for owner" for automerge, owner only.
// Run: node --test tools/v01d-fixes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixOf, fixesOf, diffLines, MAX_LINES } from '../void-live-deploy/lib/v01d-fixes.js';
import * as route from '../void-live-deploy/functions/api/v01d-fixes.js';
import skill from '../void-live-deploy/skills/v01d-fixes.js';

const TOKEN = 'owner-token-for-tests-1234567890';
const body = (c, where = 'void-live-deploy/skills/rides.js lines 42, 57') => "Verse's own model proposed this change ... Why, in V01D's words: the matcher only knew ride words. V01D's confidence: " + c + '. Where: ' + where + '. Labelled ...';
const pr = (n, c, labels) => ({ number: n, title: 'Verse fixes its rides skill: learn to handle "x"', html_url: 'https://github.com/atomeam/void-loop/pull/' + n, body: body(c), labels: labels.map((name) => ({ name })) });

test('a fix is read from its pull request: confidence, where, why, and whether it waits; only Verse\'s own count', () => {
  const f = fixOf(pr(901, '0.62', ['made by V01D', 'waits for owner']));
  assert.deepEqual(f, { number: 901, title: 'Verse fixes its rides skill: learn to handle "x"', url: 'https://github.com/atomeam/void-loop/pull/901', confidence: 0.62, where: 'void-live-deploy/skills/rides.js lines 42, 57', why: 'the matcher only knew ride words', risk: null, riskWhy: '', draft: false, waits: true, merges: false });
  assert.equal(fixOf(pr(902, 'none given', ['made by V01D', 'waits for owner'])).confidence, null);
  assert.equal(fixOf(pr(903, '0.9', ['automerge'])), null, 'not made by Verse');
  assert.equal(fixOf({ ...pr(904, '0.9', ['made by V01D']), html_url: 'https://evil.example/x' }).url, 'https://github.com/atomeam/void-loop/pull/904');
  const list = fixesOf([pr(10, '0.95', ['made by V01D', 'automerge']), pr(11, '0.7', ['made by V01D', 'waits for owner']), pr(12, '0.4', ['made by V01D', 'waits for owner']), pr(13, '0.99', ['other'])]);
  assert.deepEqual(list.map((f) => f.number), [12, 11, 10], 'waiting first, least sure first');
});

test('the diff is the changed lines only, with the file named, and never more than the card holds', () => {
  const files = [{ filename: 'void-live-deploy/skills/rides.js', patch: '@@ -40,3 +40,3 @@\n context\n-  return /^ride/.test(t);\n+  return /^(?:ride|how to get from)/.test(t);' }];
  assert.deepEqual(diffLines(files), ['# void-live-deploy/skills/rides.js', '-  return /^ride/.test(t);', '+  return /^(?:ride|how to get from)/.test(t);']);
  const long = [{ filename: 'a.js', patch: Array.from({ length: 100 }, (_, i) => '+line ' + i).join('\n') }];
  const d = diffLines(long); assert.equal(d.length, MAX_LINES + 1); assert.equal(d[d.length - 1], '… (more on GitHub)');
  assert.deepEqual(diffLines(null), []);
});

test('the card answers only its own asks', () => {
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of skill.nearMisses) assert.ok(!skill.match(a.toLowerCase(), a), a);
});

test('approve: owner only, needs a pull request number, a GitHub key, and a pull request made by Verse; swaps the labels', async () => {
  const req = (b, auth = TOKEN) => new Request('https://a-to-mind.com/api/v01d-fixes', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: JSON.stringify(b) });
  assert.equal((await route.onRequestPost({ request: req({ pr: 5, op: 'approve' }, ''), env: { READ_TOKEN: TOKEN } })).status, 401);
  assert.equal((await route.onRequestPost({ request: req({ pr: 'x', op: 'approve' }), env: { READ_TOKEN: TOKEN } })).status, 400);
  assert.equal((await route.onRequestPost({ request: req({ pr: 5, op: 'merge' }), env: { READ_TOKEN: TOKEN } })).status, 400);
  const none = await route.onRequestPost({ request: req({ pr: 5, op: 'approve' }), env: { READ_TOKEN: TOKEN } });
  assert.equal(none.status, 503); assert.equal((await none.json()).url, 'https://github.com/atomeam/void-loop/pull/5');
  const calls = [], real = globalThis.fetch;
  const fake = (labels, state = 'open') => async (u, o = {}) => { calls.push([o.method || 'GET', String(u).replace('https://api.github.com', ''), o.body || '']); return /\/pulls\/\d+$/.test(u) ? Response.json({ state, labels: labels.map((name) => ({ name })) }) : new Response('{}', { status: 200 }); };
  try {
    globalThis.fetch = fake(['made by V01D', 'waits for owner']);
    const ok = await route.onRequestPost({ request: req({ pr: 901, op: 'approve' }), env: { READ_TOKEN: TOKEN, GITHUB_TOKEN: 'gh-test' } });
    assert.equal(ok.status, 200);
    assert.deepEqual(calls.map((c) => c.slice(0, 2)), [['GET', '/repos/atomeam/void-loop/pulls/901'], ['POST', '/repos/atomeam/void-loop/issues/901/labels'], ['DELETE', '/repos/atomeam/void-loop/issues/901/labels/waits%20for%20owner']]);
    assert.equal(calls[1][2], JSON.stringify({ labels: ['automerge'] }));
    calls.length = 0; globalThis.fetch = fake(['automerge']);
    assert.equal((await route.onRequestPost({ request: req({ pr: 902, op: 'approve' }), env: { READ_TOKEN: TOKEN, GITHUB_TOKEN: 'gh-test' } })).status, 502, 'a pull request Verse did not make is never approved here');
    assert.equal(calls.length, 1, 'nothing was labelled');
    globalThis.fetch = fake(['made by V01D'], 'closed');
    assert.equal((await route.onRequestPost({ request: req({ pr: 903, op: 'approve' }), env: { READ_TOKEN: TOKEN, GITHUB_TOKEN: 'gh-test' } })).status, 502);
  } finally { globalThis.fetch = real; }
});

// asked by Void: a risk level on the proposal, and a fix under 0.8 is a draft on the board
import { riskOf } from '../void-live-deploy/lib/propose-fix.js';
import { readFileSync } from 'node:fs';
test('risk level: lists are low, several or long pattern edits medium, a structural line high', () => {
  assert.equal(riskOf([]).level, 'low');
  assert.equal(riskOf([{ find: "  examples: ['ride to x'],", replace: "  examples: ['ride to x', 'cab to y']," }]).level, 'low');
  assert.equal(riskOf([{ find: '  const RE = /^ride/;', replace: '  const RE = /^(?:ride|how to get from)/;' }]).level, 'low');
  assert.equal(riskOf([{ find: '  const A = /^a/;', replace: '  const A = /^(?:a|b)/;' }, { find: '  const B = /^c/;', replace: '  const B = /^(?:c|d)/;' }]).level, 'medium');
  assert.equal(riskOf([{ find: '  const A = /^a(?:long|alternative|list|of|words)/;', replace: '/^a/' }]).level, 'medium');
  const hi = riskOf([{ find: '  async run(text, api) {', replace: '  async run(text, api) { x();' }]);
  assert.equal(hi.level, 'high'); assert.match(hi.why, /structural/);
  assert.equal(riskOf([{ find: 'export default {', replace: 'export default { a: 1,' }]).level, 'high');
});
test('the card reads the risk and the draft state from the pull request', () => {
  const p = { ...pr(950, '0.5', ['made by V01D', 'waits for owner']), draft: true, body: body('0.5') + ' Risk: high (it changes a structural line (async run(text, api) {), not only the matcher). Model: m.' };
  const f = fixOf(p); assert.equal(f.risk, 'high'); assert.match(f.riskWhy, /structural line/); assert.equal(f.draft, true);
  const q = fixOf(pr(951, '0.9', ['made by V01D', 'automerge'])); assert.equal(q.risk, null); assert.equal(q.draft, false);
});
test('the workflow opens a fix under 0.8 as a draft, and says the risk in the body, the commit and the output', () => {
  const wf = readFileSync(new URL('../.github/workflows/propose-fix.yml', import.meta.url), 'utf8');
  assert.match(wf, /draft="--draft"/); assert.match(wf, /gh pr create \$draft /); assert.match(wf, /Risk: \$RISK\./); assert.match(wf, /risk=\$\(node -p/);
  assert.match(wf, /\[ "\$gate" = "automerge" \] \|\| draft="--draft"/);
});
