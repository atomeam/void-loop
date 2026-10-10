// Add a skill to Void with one command, so even the simplest agent can grow it. A skill is one file with five fields
// ({ name, examples, nearMisses, match, run }); everything around it (the routing-order file, the generated index, the
// collision check) is done here, so nothing is hand-edited and nothing conflicts with another PR.
//   node tools/new-skill.mjs <name> --ask "an ask it answers" [--ask "another"] [--near "a look-alike it must NOT take"] [--rank 1050]
// It writes void-live-deploy/skills/<name>.js (a working card on exactly your examples), void-live-deploy/skills/order/<rank>-<name>
// (last in the routing order unless --rank), rewrites skills/index.json, and runs the collision check. Then: edit ANSWER and WHEN in the
// new file, `node tools/checks.mjs`, one line in docs/MAP.md, push. The whole recipe is docs/UPGRADING.md.
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ranksOf, writeIndex, ORDER_DIR } from './skills-index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = resolve(root, 'void-live-deploy', 'skills');
export const NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;
const lit = (s) => JSON.stringify(String(s));
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** the rank a new skill takes: ten after the last one, so it is asked after every skill that is already there. Pure. */
export function nextRank(ranks) { const r = Object.values(ranks); return (r.length ? Math.max(...r) : 0) + 10; }

/** { ok, why } for the inputs; pure */
export function validate({ name, examples, near }, ranks = {}) {
  if (!NAME_RE.test(String(name || ''))) return { ok: false, why: 'the name is lowercase letters, digits and dashes, starting with a letter (like "tide-tables")' };
  if (name in ranks) return { ok: false, why: name + ' already exists: edit void-live-deploy/skills/' + name + '.js instead' };
  if (!examples.length) return { ok: false, why: 'give at least one ask the skill answers: --ask "when is high tide in lisbon"' };
  for (const e of [...examples, ...near]) if (String(e).length > 120 || /[\n\r]/.test(e)) return { ok: false, why: 'an example is one short line (under 120 characters)' };
  const lower = near.map((n) => n.toLowerCase()), ex = examples.map((e) => e.toLowerCase());
  const clash = lower.find((n) => ex.includes(n));
  if (clash) return { ok: false, why: '"' + clash + '" is both an example and a near miss' };
  return { ok: true };
}

/** the skill file's text. It answers exactly its examples at first; widen WHEN, change ANSWER. Pure. */
export function render({ name, examples, near, title }) {
  const T = title || name.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return `/**
 * ${name} skill - made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 *   match: true when this skill should take the ask (the first skill in skills/order/ to say yes wins).
 *   run:   shows the answer; api.showPage(build) puts a card on the stage and api.esc escapes text. Return the skill's name.
 */
const WHEN = new RegExp('^(?:' + ${lit(examples.map(reEsc).join('|'))} + ')$', 'i'); // exactly the examples to start with: widen it to the phrasings people use
const ANSWER = ${lit('Not written yet: edit ANSWER in skills/' + name + '.js.')}; // what the card says

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(${lit(T)}) + '</h2><p>' + esc(ANSWER) + '</p><div class="src">Source: say where the answer comes from \\u00b7 as of ${new Date().toISOString().slice(0, 7)}</div>';
  });
  return ${lit(name)};
}

export default {
  name: ${lit(name)},
  examples: ${JSON.stringify(examples, null, 2).replace(/\n/g, '\n  ')},
  nearMisses: ${JSON.stringify(near, null, 2).replace(/\n/g, '\n  ')},
  match(lower) { return WHEN.test(lower.trim()); },
  run
};
`;
}

function main(argv) {
  const args = argv.slice(2), name = args[0] && !args[0].startsWith('--') ? args[0] : '';
  const all = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
  const examples = all('--ask'), near = all('--near'), rankArg = all('--rank')[0];
  const ranks = ranksOf();
  const v = validate({ name, examples, near }, ranks);
  if (!v.ok) { console.error('new-skill: ' + v.why + '\nusage: node tools/new-skill.mjs <name> --ask "an ask it answers" [--near "a look-alike"] [--rank 1050]'); return 2; }
  const rank = rankArg ? Number(rankArg) : nextRank(ranks);
  if (!Number.isInteger(rank) || rank < 1) { console.error('new-skill: --rank is a whole number, like 1050'); return 2; }
  const file = resolve(skillsDir, name + '.js');
  if (existsSync(file)) { console.error('new-skill: ' + file + ' exists'); return 2; }
  writeFileSync(file, render({ name, examples, near }));
  writeFileSync(resolve(ORDER_DIR, String(rank).padStart(4, '0') + '-' + name), '');
  writeIndex();
  const c = spawnSync(process.execPath, [resolve(root, 'tools', 'skills-check.mjs')], { encoding: 'utf8' });
  console.log(((c.stdout || '') + (c.stderr || '')).trim());
  console.log(`\nwrote void-live-deploy/skills/${name}.js, skills/order/${String(rank).padStart(4, '0')}-${name}, skills/index.json\nnext: edit ANSWER and WHEN in the new file; node tools/checks.mjs; add one line for it to docs/MAP.md; node tools/push.mjs`);
  return c.status === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
