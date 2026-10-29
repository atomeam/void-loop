// Privacy guard for the repo (public): blocks a commit that would put personal data in domains/, logs or fixtures:
// emails, phone numbers, IP addresses, card numbers and tokens (lib/privacy.js findPersonal), and verbatim visitor asks
// (a line marked `ask:` / "ask": with quotes that came from the live miss board must be a paraphrase, see docs/secrets.md).
// Prints kind and file:line only, never the value.
//   node tools/privacy-scan.mjs [files...]   (no files = every tracked file under the guarded paths)
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { findPersonal } from '../void-live-deploy/lib/privacy.js';

export const GUARDED = /^(domains\/|logs?\/|tools\/fixtures\/|.*\.log$|.*\.log\.md$|docs\/void-voice\.md$|void-live-deploy\/void\.asks\.json$)/;
// files that hold published business contacts on purpose (public listings, not visitors): the owner's call, see docs/secrets.md
export const BUSINESS = new Set(['domains/capacity-marketplace.md', 'domains/handoff-studio.md']);
// a line may opt out with `privacy:ok` when it shows a placeholder on purpose
export function scanText(text, file = '') {
  const out = [];
  String(text).split('\n').forEach((line, i) => {
    if (/privacy:ok/.test(line)) return;
    for (const f of findPersonal(line)) out.push({ file, line: i + 1, kind: f.kind });
    if (/\b(verbatim|exact words?|word for word)\b.{0,20}\b(visitor|user|person)'?s? ask/i.test(line) && /["“][^"”]{12,}["”]/.test(line)) out.push({ file, line: i + 1, kind: 'verbatim-ask' });
  });
  return out;
}
if (import.meta.url === 'file://' + process.argv[1]) {
  let files = process.argv.slice(2);
  if (!files.length) files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => GUARDED.test(f));
  const hits = [];
  files = files.filter((f) => GUARDED.test(f) && !BUSINESS.has(f) && existsSync(f));
  for (const f of files) hits.push(...scanText(readFileSync(f, 'utf8'), f));
  for (const h of hits) console.log(`${h.kind}  ${h.file}:${h.line}`);
  if (hits.length) { console.log(`privacy-scan: ${hits.length} personal-looking value(s); replace with a placeholder ([email], [phone], [ip]) or paraphrase`); process.exit(1); }
  console.log(`privacy-scan: ${files.length} guarded file(s) clean`);
}
