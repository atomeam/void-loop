// The job drafts its own first step (frontier build order step 3, the draft half of its written next step). When a
// builder claims a serve job (target sale:<id>, lib/sale-jobs.js) whose body carries the buyer's reply — the
// `reply received: <url>` line functions/api/handoff.js appended — the claim drafts the proposal from it: the handoff
// is read by its id from D1 (never over HTTP), run through lib/proposal.js the way the card runs a paste
// (prepareProposal through redact, ruleProposal, blank price, To = the reply's domain the handoff stored as its
// author), and the Markdown is stored on the job's own `draft` column with one proposal.draft execution record.
// Idempotent per job: a second claim finds the draft and reuses it, no second record. Send stays stubbed behind the
// confirm line (skills/proposal.js, proposal.send) — nothing here sends anything. Tests: tools/job-draft.test.mjs.
import { prepareProposal, ruleProposal, toMarkdown } from './proposal.js';
import { redact } from './automation-fix.js';
import { track } from './actions.js';

/** the handoff id in a job's body: the id of the last `reply received:` link on it, else '' */
export function handoffIdIn(ask) {
  let id = '', re = /reply received: https?:\/\/[^\s]*[?&]id=([a-f0-9]{32})/g, m;
  while ((m = re.exec(String(ask || '')))) id = m[1];
  return id;
}

const q = (env, sql, ...a) => env.DB.prepare(sql).bind(...a);

/**
 * Draft the proposal for a just-claimed job. Returns a short line for the claim's reply:
 * what was drafted, that a draft was already there, why there is none — never throws past the record.
 */
export async function draftOnClaim(env, row) {
  if (!row || !String(row.target || '').startsWith('sale:')) return '';
  const hid = handoffIdIn(row.ask);
  if (!hid) return '';
  try { await q(env, 'ALTER TABLE void_queue ADD COLUMN draft TEXT').run(); } catch (_) {}
  const prior = await q(env, 'SELECT draft FROM void_queue WHERE id = ?', row.id).first('draft');
  if (prior) return 'draft already on the job';
  const h = await q(env, 'SELECT author, body FROM handoff WHERE id = ?', hid).first();
  if (!h) return 'no draft: the reply link has expired';
  const to = h.author || ''; // the handoff stored the domain, never the address
  let out;
  try { out = await track(env, { owner: 'void', kind: 'proposal.draft', ref: row.target + ' for ' + (to || 'unknown') }, async () => {
    const p = prepareProposal({ request: h.body }, redact); // stored redacted already; redact again costs nothing
    if (p.error) throw new Error('nothing to draft from the reply: ' + p.error);
    const md = toMarkdown(ruleProposal(p), to);
    await q(env, 'UPDATE void_queue SET draft = ?, updated = ? WHERE id = ? AND draft IS NULL', md, new Date().toISOString(), row.id).run();
    return 'draft proposal on job ' + row.id + ' for ' + (to || 'unknown') + ', waiting on the confirm line';
  }); } catch (e) { return 'no draft: ' + ((e && e.message) || String(e)); } // the failed record is already written
  return out.value;
}
