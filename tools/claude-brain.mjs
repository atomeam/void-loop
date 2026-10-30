// Claude as Verse's builder brain (frontier #28): the same job /api/propose-fix gives Workers AI (lib/propose-fix.js: the ask a
// skill missed or took wrongly, the skill's file, the narrowest matcher change as exact line replacements), asked of Claude on the
// GitHub runner instead, so the key lives only in the ANTHROPIC_API_KEY repo secret and never reaches the site. One call per run and
// a hard ceiling on what it can spend: the input is bounded by MAX_SOURCE (fixPrompt clips the skill file) and the output by
// MAX_OUTPUT_TOKENS, so the worst run costs about WORST_RUN_USD. The reply goes through the same gate (parseEdits) and the same
// checks (tools/propose-fix.mjs) as Verse's own model; nothing it writes runs with a write token.
//   node tools/propose-fix.mjs --brain claude ...   (the workflow's "brain: claude" input)
import Anthropic from '@anthropic-ai/sdk';
import { FIX_SYSTEM, NARROW_SYSTEM, MAX_SOURCE, MAX_TRIED, fixPrompt, parseEdits, evidenceOf } from '../void-live-deploy/lib/propose-fix.js';

export const BRAIN_MODEL = 'claude-opus-5-5';
export const MAX_OUTPUT_TOKENS = 8000; // the per-run ceiling on what Claude writes, thinking included
export const PRICE = { input: 4, output: 20 }; // dollars per million tokens for BRAIN_MODEL
// the worst run: the longest prompt fixPrompt can build (about 4 characters a token, plus the system text) and every output token
export const WORST_RUN_USD = Math.round((((MAX_SOURCE + MAX_TRIED + FIX_SYSTEM.length + 1000) / 3) * PRICE.input + MAX_OUTPUT_TOKENS * PRICE.output) / 1e4) / 100;

/** What one call cost, in dollars, from the reply's usage. Pure. */
export const costOf = (usage) => {
  const u = usage || {}, input = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  return Math.round((input * PRICE.input + (u.output_tokens || 0) * PRICE.output) / 1e4) / 100;
};

/** The request for one proposal: the same system text and question Verse's own model gets, with the output ceiling. Pure. */
export function brainRequest({ ask, skill, source, mode = 'learn', said = '', tried = '' }) {
  return {
    model: BRAIN_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    output_config: { effort: 'medium' },
    // a declined request is retried by the API on a model it picks, in the same call
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: mode === 'narrow' ? NARROW_SYSTEM : FIX_SYSTEM,
    messages: [{ role: 'user', content: fixPrompt(ask, skill, source, mode, said, tried) }],
  };
}

/** Claude's proposal, in the shape /api/propose-fix answers ({ edits, why, confidence, evidence, model }) plus usage and cost; throws
 * when Claude declined, ran out of room, or proposed nothing that passes the gate. */
export async function proposeWithClaude(miss, { client = new Anthropic() } = {}) {
  const r = await client.beta.messages.create(brainRequest(miss));
  const cost = costOf(r.usage);
  if (r.stop_reason === 'refusal') throw new Error('Claude declined (' + ((r.stop_details && r.stop_details.category) || 'no category') + '), $' + cost);
  if (r.stop_reason === 'max_tokens') throw new Error('Claude ran past the ' + MAX_OUTPUT_TOKENS + '-token ceiling, $' + cost);
  const said = (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const { edits, why, confidence } = parseEdits(said, miss.source);
  if (!edits.length) throw new Error('Claude proposed nothing that passes the gate, $' + cost);
  return { edits, why, confidence, evidence: evidenceOf(miss.source, edits, miss.skill), model: r.model || BRAIN_MODEL, usage: r.usage, cost };
}
