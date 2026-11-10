// Fails if a person is put back in front of review or merge.
// #2309 (b1f5d2e8a) waited for the suite. #2617 (c0bd4c3be) held every merge on a red verify.
//   node tools/no-approval-gate.mjs
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = [
  [/(^|\/)CODEOWNERS$/, () => true, 'a CODEOWNERS file makes review wait for a named person'],
  [/\.(ya?ml|mjs|js|md)$/, (t) => /required_approving_review_count\s*[:=]\s*[1-9]/.test(t), 'required approving reviews'],
  [/\.(ya?ml|mjs|js|md)$/, (t) => /require_code_owner_reviews?\s*[:=]\s*true/.test(t), 'code owner reviews required'],
  [/\.(ya?ml|mjs|js|md)$/, (t) => /required_reviewers\s*:/.test(t), 'environment reviewers'],
  [/^tools\/merge-policy\.mjs$/, (t) => /hold:\s*true/.test(t), 'mainVerifyHold must not set hold: true'],
  [/^tools\/automerge\.mjs$/, (t) => /verifyHold\.hold\s*&&/.test(t), 'automerge must not freeze on a red main'],
  [/^(tools\/pr-ready|tools\/merge-gate|tools\/automerge)\.mjs$/, (t) => /files need a person/.test(t), 'a conflict must go to the coder'],
  [/^\.github\/workflows\/void-review\.yml$/, (t) => !/event:"APPROVE"/.test(t), 'Verse must submit an approving review'],
];

/** hits that put a person in front of a merge. Pure. files: [{ path, text }]. */
export function gateHits(files) {
  const hits = [];
  for (const f of files || []) {
    const path = String(f.path || ''), text = String(f.text || '');
    if (path.startsWith('archive/')) continue;
    for (const [re, bad, why] of RULES) if (re.test(path) && bad(text)) hits.push(path + ': ' + why);
  }
  return hits;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = String(spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout || '').split('\n').filter((p) => p && !p.startsWith('archive/') && /(^|\/)CODEOWNERS$|merge-policy|automerge|pr-ready|merge-gate|void-review\.yml|\.github\/workflows\//.test(p));
  const hits = gateHits(names.map((path) => ({ path, text: readFileSync(resolve(root, path), 'utf8') })));
  for (const h of hits) console.log(h);
  console.log(hits.length ? hits.length + ' approval gate(s)' : 'no human approval gate');
  process.exit(hits.length ? 1 : 0);
}
