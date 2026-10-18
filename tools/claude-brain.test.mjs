// Claude as Verse's builder brain (tools/claude-brain.mjs): one call with a hard output ceiling, the same question and gate as Verse's
// own model, and a refusal, a cut-off reply or a reply that fails the gate never becomes a proposal. A fake client: no credits spent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAIN_MODEL, MAX_OUTPUT_TOKENS, WORST_RUN_USD, brainRequest, costOf, proposeWithClaude } from './claude-brain.mjs';
import { FIX_SYSTEM, NARROW_SYSTEM } from '../void-live-deploy/lib/propose-fix.js';

const LINE = "  return /^(?:rhymes? (?:with|for) )\\S+/.test(t);";
const SOURCE = ['/** words skill */', 'export function match(lower, text) {', "  const t = String(text || '').trim().toLowerCase();", LINE, '}',
  "export default { name: 'words', examples: ['rhymes with orange'], nearMisses: [], match, run: async () => 'words' };"].join('\n');
const MISS = { ask: 'opposite of brave', skill: 'words', source: SOURCE, mode: 'learn' };
const GOOD = JSON.stringify({ why: 'opposite of was not known', confidence: 0.9, edits: [{ find: LINE, replace: "  return /^(?:rhymes? (?:with|for) |opposite of )\\S+/.test(t);" }] });
const fake = (reply, calls = []) => ({ beta: { messages: { create: async (req) => { calls.push(req); return { model: BRAIN_MODEL, stop_reason: 'end_turn', usage: { input_tokens: 2000, output_tokens: 500 }, content: [{ type: 'text', text: GOOD }], ...reply }; } } } });

test('one call, capped output, the same question Verse\'s own model gets', async () => {
  const calls = [], p = await proposeWithClaude(MISS, { client: fake({}, calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, BRAIN_MODEL);
  assert.equal(calls[0].max_tokens, MAX_OUTPUT_TOKENS);
  assert.equal(calls[0].system, FIX_SYSTEM);
  assert.match(calls[0].messages[0].content, /opposite of brave/);
  assert.equal(p.edits.length, 1);
  assert.equal(p.confidence, 0.9);
  assert.equal(p.evidence[0].line, 4);
  assert.equal(p.cost, 0.02); // 2000 in at $4/M + 500 out at $20/M
});

test('a routing correction asks the narrow question', () => {
  assert.equal(brainRequest({ ...MISS, mode: 'narrow', said: 'not yours' }).system, NARROW_SYSTEM);
});

test('a refusal, a cut-off reply and a reply that fails the gate are not proposals', async () => {
  await assert.rejects(proposeWithClaude(MISS, { client: fake({ stop_reason: 'refusal', stop_details: { category: 'cyber' } }) }), /declined \(cyber\)/);
  await assert.rejects(proposeWithClaude(MISS, { client: fake({ stop_reason: 'max_tokens' }) }), /ceiling/);
  const sneaky = JSON.stringify({ why: 'x', edits: [{ find: LINE, replace: "  fetch('https://evil.example'); return true;" }] });
  await assert.rejects(proposeWithClaude(MISS, { client: fake({ content: [{ type: 'text', text: sneaky }] }) }), /nothing that passes the gate/);
});

test('the worst run stays well under a dollar', () => {
  assert.ok(WORST_RUN_USD > 0 && WORST_RUN_USD < 0.5, String(WORST_RUN_USD));
  assert.equal(costOf({ input_tokens: 1e6, output_tokens: 0 }), 4);
  assert.equal(costOf(undefined), 0);
});
