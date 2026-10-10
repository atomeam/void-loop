// From the bake-off's verdict to a change (model-bench.yml, after a run). When a challenger wins under the thresholds in
// tools/model-bench.mjs verdict(), the answer path's model in void-live-deploy/lib/models.js is set to it, and the PR body
// carries the table, the previous model and the one-line revert; the workflow opens that PR and labels it for automerge, and
// Void's review and the automerge rules take it from there. A "keep" verdict changes nothing: the table is only posted.
//   node tools/model-switch.mjs model-bench.json table.md     a switch: edits lib/models.js, writes switch-body.md and
//                                                            prints branch=, title=, ledger= lines for $GITHUB_OUTPUT; a keep: switch=0 and ledger=
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const MODELS_JS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'lib', 'models.js');
const MODEL_ID = /^@cf\/[a-z0-9][\w.-]{0,60}\/[a-z0-9][\w.-]{0,80}$/i;
const ANSWER = /(\n\s*export const PATH_MODELS = \{[^}\n]*?\banswer:\s*)(FREE_MODEL|'[^'\n]*')/;
const REVIEW = /(\n\s*export const PATH_MODELS = \{[^}\n]*?\breview:\s*)(FREE_MODEL|'[^'\n]*')/;

// the answer path's model, and the review path's too when asked (reviewFollows: the bench's compliance column says the winner follows the
// closer read's JSON shape at least as well as the baseline); the other paths and FREE_MODEL itself stay as they are, so the old name stays in the file
export function applySwitch(src, to, { review = false } = {}) {
  if (!MODEL_ID.test(String(to))) throw new Error('not a Workers AI model id: ' + String(to).slice(0, 80));
  const m = ANSWER.exec(src);
  if (!m) throw new Error('no answer path in lib/models.js PATH_MODELS');
  const free = (/export const FREE_MODEL = '([^']+)'/.exec(src) || [])[1];
  const from = m[2] === 'FREE_MODEL' ? free : m[2].slice(1, -1);
  if (from === to) throw new Error('the answer path already uses ' + to);
  let out = src.replace(ANSWER, `$1'${to}'`);
  if (review && REVIEW.test(out)) out = out.replace(REVIEW, `$1'${to}'`);
  return { src: out, from };
}
// does the winner follow the closer read's JSON shape at least as well as the baseline? (tools/model-bench.mjs comply column:
// valid JSON first time + every quote found - echoes). No compliance column in the run: the review path stays.
export function reviewFollows(result, to) {
  const rows = (result && result.rows) || [], base = rows.find((r) => r.model === (result.baseline || (rows[0] && rows[0].model))), win = rows.find((r) => r.model === to);
  const score = (r) => (r && r.comply && r.comply.asks ? r.comply.json + r.comply.quotes - r.comply.echoes : null);
  const b = score(base), w = score(win);
  return b != null && w != null && w >= b;
}

// the growth ledger's line for any run: its date, the models that ran and the verdict
export function ledgerLine(result) {
  const day = String((result && result.at) || new Date().toISOString()).slice(0, 10), v = (result && result.verdict) || {};
  const ran = ((result && result.rows) || []).map((r) => String(r.model || '').split('/').pop()).filter(Boolean);
  return `model bake-off ${day} (${ran.join(', ') || 'no models ran'}): ${v.switchTo ? 'switch to ' + v.switchTo.split('/').pop() + ', ' : ''}${String(v.why || 'no verdict').slice(0, 240)}`;
}

// null for a keep (or anything that is not a clean win); else what the PR needs
export function planSwitch(result, table, src) {
  const to = result && result.verdict && result.verdict.switchTo;
  if (!to || !MODEL_ID.test(to)) return null;
  const review = reviewFollows(result, to);
  let from; try { ({ from } = applySwitch(src, to, { review })); } catch (_) { return null; }
  const day = String(result.at || new Date().toISOString()).slice(0, 10), short = to.split('/').pop();
  const body = [
    `The model bake-off (\`tools/model-bench.mjs\`, run ${day}) says a challenger beats the answer engine's model under its thresholds: ${result.verdict.why}`,
    '', table.trim(), '',
    `Previous model: \`${from}\`. New model on the answer path: \`${to}\` (\`void-live-deploy/lib/models.js\`, \`PATH_MODELS.answer\`${review ? ' and \`PATH_MODELS.review\`: the compliance column says it follows the closer read\'s JSON shape at least as well as the previous model, so the closer read switches too; the will and figurescript paths are unchanged' : '; the will, review and figurescript paths are unchanged' + (result.rows && result.rows.some((r) => r.comply && r.comply.asks) ? ', the review path because the winner followed the closer read\'s JSON shape worse than the previous model' : '')}).`,
    '', `To revert, one line: set \`answer: FREE_MODEL\`${review ? ' (and \`review: FREE_MODEL\`)' : ''} back in \`PATH_MODELS\` (\`${from}\`).`,
    '', 'Opened by `.github/workflows/model-bench.yml` (`tools/model-switch.mjs`). Void\'s review and the automerge rules decide from here; the full suite runs on main after the merge.',
  ].join('\n');
  const grow = ledgerLine(result);
  return { to, from, review, branch: `bench/switch-${day}-${short}`, title: `${review ? 'Answer engine and closer read' : 'Answer engine'}: switch to ${short} (model bake-off ${day})`, body, grow };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [resultFile, tableFile] = process.argv.slice(2);
  const result = JSON.parse(fs.readFileSync(resultFile, 'utf8')), table = fs.existsSync(tableFile || '') ? fs.readFileSync(tableFile, 'utf8') : '';
  const src = fs.readFileSync(MODELS_JS, 'utf8'), p = planSwitch(result, table, src);
  if (!p) { console.log(['switch=0', 'ledger=' + ledgerLine(result)].join('\n')); process.exit(0); }
  fs.writeFileSync(MODELS_JS, applySwitch(src, p.to, { review: p.review }).src);
  fs.writeFileSync('switch-body.md', p.body + '\n');
  console.log(['switch=1', 'branch=' + p.branch, 'title=' + p.title, 'ledger=' + p.grow.replace(/\n/g, ' ')].join('\n'));
}
