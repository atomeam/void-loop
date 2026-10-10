// A weekly digest ends with one proposal (frontier "metabolism"): the digest's last line is `Proposal: <one sentence>`, and this puts that sentence on the
// growth board as an `idea`, so a week of reading turns into one thing someone can say yes or no to. The digest file is committed and reviewed like any
// other file, but its text still reaches a public board, so the line is checked: one line, a plain sentence, no links or markup, nothing the site's own
// secret masking would change, and nothing that reads as an order to a model. A line that fails is reported and not written. Idempotent: the same
// proposal from the same digest is never written twice.
//   node tools/digest-proposal.mjs domains/inputs/<topic>/digest.md           show the proposal and whether it would be written
//   node tools/digest-proposal.mjs domains/inputs/<topic>/digest.md --write   append the growth line (void-live-deploy/void.growth.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { redact } from '../void-live-deploy/lib/automation-fix.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|above|instructions?|rules?)\b|system\s+prompt|jailbreak|you\s+are\s+now|act\s+as\b|reveal\b[^.]{0,30}\b(secret|password|token|key)s?\b/i;

/** { proposal } from a digest's text, or { error } saying why there is none. Only the last non-empty line counts. */
export function proposalOf(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const m = /^(?:\*\*)?proposal:?(?:\*\*)?:?\s+(.+)$/i.exec(last);
  if (!m) return { error: 'the digest does not end with a "Proposal:" line' };
  const p = m[1].replace(/\s+/g, ' ').trim();
  if (p.length < 20 || p.length > 220) return { error: 'the proposal must be 20 to 220 characters (it is ' + p.length + ')' };
  if (/[<>{}[\]\\|`]|https?:|www\.|@|\b\S+\.(?:com|org|net|io|dev)\b/i.test(p)) return { error: 'the proposal must be plain text: no links, addresses or markup' };
  if (ORDER.test(p)) return { error: 'the proposal reads as an instruction to a model, not a proposal' };
  if (redact(p) !== p) return { error: 'the proposal looks like it holds a secret or key' };
  if (!/[a-z]/i.test(p) || !/\s/.test(p)) return { error: 'the proposal is not a sentence' };
  return { proposal: p.replace(/[.!]*$/, '') };
}

/** The growth line for a proposal from a digest file, or null when the ledger already has it. */
export function growthLine(proposal, digestPath, ledgerText, now = new Date()) {
  const what = 'proposal from ' + basename(dirname(digestPath)) + "'s weekly digest: " + proposal;
  if (String(ledgerText).includes(JSON.stringify(what).slice(1, -1))) return null;
  return JSON.stringify({ at: now.toISOString().replace(/\.\d+Z$/, 'Z'), by: 'digest', kind: 'idea', what });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2], write = process.argv.includes('--write');
  if (!file || file.startsWith('--')) { console.error('usage: node tools/digest-proposal.mjs <digest.md> [--write]'); process.exit(2); }
  const r = proposalOf(readFileSync(resolve(file), 'utf8'));
  if (r.error) { console.log('no proposal: ' + r.error); process.exit(write ? 1 : 0); }
  const ledger = resolve(root, 'void-live-deploy/void.growth.json'), text = readFileSync(ledger, 'utf8'), line = growthLine(r.proposal, file, text);
  console.log('proposal: ' + r.proposal);
  if (!line) { console.log('already on the board'); process.exit(0); }
  if (!write) { console.log('would write: ' + line); process.exit(0); }
  const body = text.replace(/\s*\]\s*$/, '');
  writeFileSync(ledger, body + ',\n  ' + line + '\n]\n');
  JSON.parse(readFileSync(ledger, 'utf8')); // never leave the ledger unparseable
  console.log('written to void-live-deploy/void.growth.json');
}
