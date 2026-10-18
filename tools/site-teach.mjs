// Teach-on-miss (docs/multipliers.md #5): a site-test teach item becomes a ready PR. The site tester found a wording Verse did not
// understand ("yo calculator" meaning "open a calculator"); this teaches the existing skill the phrase (Adam: extend skills, do not
// add new ones) by writing it into void-live-deploy/skills/aliases.json, adds the wording to the tester's regression cases, and
// (with --pr) opens the PR that closes the issue, labelled automerge.
//   node tools/site-teach.mjs --ask "<wording>" --means "<ask it means>" --skill <name> [--issue N] [--pr]
//   node tools/site-teach.mjs --from-title "<issue title>" [--issue N] [--pr]
// Safe by construction: the target ask must already be taken by that skill, the wording must not be taken by any other skill (a
// taught phrase never steals an ask), the wording is the tester's own (never a visitor's words), and it is short plain text.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..'), SK = resolve(root, 'void-live-deploy/skills');
export const ALIASES = resolve(SK, 'aliases.json'), SUITE = resolve(here, 'site-test.json');
export const keyOf = (s) => String(s || '').toLowerCase().trim().replace(/[\s?!.]+$/, '');

/** "site-test: teach Verse "x" (means "y", skill:z): ..." -> { ask, means, skill }. Pure. */
export function fromTitle(t) {
  const m = String(t).match(/teach (?:Verse|Verse) "([^"]+)" \(means "([^"]+)", skill:([a-z0-9-]+)\)/i);
  return m ? { ask: m[1], means: m[2], skill: m[3] } : null;
}
/** Can this wording be taught? skills: [{ name, match }] in routing order. '' when it can, else why not. Pure. */
export function teachable({ ask, means, skill }, skills, aliases = {}) {
  const k = keyOf(ask);
  if (!k || k.length > 80 || !/^[a-z0-9 '’&+\-,]+$/i.test(k)) return 'not a short plain wording';
  if (aliases[k]) return 'already taught';
  const own = skills.find((s) => s.name === skill); if (!own) return 'no skill ' + skill;
  const first = (a) => skills.find((s) => { try { return s.match(a.toLowerCase(), a); } catch (_) { return false; } });
  if ((first(means) || {}).name !== skill) return '"' + means + '" is not taken by ' + skill;
  const taker = first(ask); if (taker) return '"' + ask + '" is already taken by ' + taker.name;
  return '';
}
/** The files after teaching: aliases with the wording, the suite with it as a regression case (and off the teach list). Pure. */
export function taught({ ask, means, skill }, aliases, suite) {
  const k = keyOf(ask), a = { ...aliases, [k]: means };
  const sorted = Object.fromEntries(Object.keys(a).sort().map((x) => [x, a[x]]));
  const cases = suite.cases.some((c) => keyOf(c.ask) === k) ? suite.cases : suite.cases.concat({ ask, taught: skill });
  return { aliases: sorted, suite: { ...suite, cases, teach: (suite.teach || []).filter((t) => keyOf(t.ask) !== k) } };
}

export async function loadSkills() {
  const out = [];
  for (const n of JSON.parse(readFileSync(resolve(SK, 'index.json'), 'utf8'))) { try { out.push((await import(resolve(SK, n + '.js'))).default); } catch (_) {} }
  return out.filter(Boolean);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const item = opt('--from-title') ? fromTitle(opt('--from-title')) : { ask: opt('--ask'), means: opt('--means'), skill: opt('--skill') };
  if (!item || !item.ask) { console.log('nothing to teach (no teach item in that title)'); process.exit(0); }
  const aliases = JSON.parse(readFileSync(ALIASES, 'utf8')), suite = JSON.parse(readFileSync(SUITE, 'utf8'));
  const why = teachable(item, await loadSkills(), aliases);
  if (why) { console.log('not taught: ' + why); process.exit(0); }
  const t = taught(item, aliases, suite);
  writeFileSync(ALIASES, JSON.stringify(t.aliases, null, 1) + '\n'); writeFileSync(SUITE, JSON.stringify(t.suite, null, 2) + '\n');
  console.log('taught ' + item.skill + ': "' + keyOf(item.ask) + '" -> "' + item.means + '"');
  if (a.includes('--pr')) {
    const g = (...x) => execFileSync('git', x, { cwd: root, encoding: 'utf8' }).trim(), issue = opt('--issue');
    const branch = 'teach/' + item.skill + '-' + keyOf(item.ask).replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now().toString(36);
    g('checkout', '-b', branch); g('add', 'void-live-deploy/skills/aliases.json', 'tools/site-test.json');
    g('commit', '-m', 'Teach ' + item.skill + ' "' + keyOf(item.ask) + '" (means "' + item.means + '")' + (issue ? ' (fixes #' + issue + ')' : ''));
    g('push', 'origin', 'HEAD:refs/heads/' + branch);
    const body = 'The site tester found Verse did not understand "' + keyOf(item.ask) + '". This teaches the existing ' + item.skill + ' skill the wording (skills/aliases.json: an exact taught wording runs as "' + item.means + '") and keeps it as a regression case in tools/site-test.json. Checked: "' + item.means + '" is taken by ' + item.skill + ', and no other skill takes the wording.' + (issue ? '\n\nFixes #' + issue : '');
    const pr = execFileSync('gh', ['pr', 'create', '--head', branch, '--base', 'main', '--title', 'Teach ' + item.skill + ': "' + keyOf(item.ask) + '"', '--body', body, '--label', 'automerge'], { cwd: root, encoding: 'utf8' }).trim();
    console.log(pr);
  }
}
