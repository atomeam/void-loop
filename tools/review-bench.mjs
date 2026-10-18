// How good is Verse's code reviewer? Scored on bugs that really reached main. Each case in tools/review-bench.json is a fix
// commit ("Main green: ...") and a pattern for the lines it repaired; git blame on the commit before the fix names the commit
// that wrote those lines, and Verse reviews that commit exactly as it reviews a PR (tools/review-pr.mjs). A case is caught when
// a finding lands in the same file within WINDOW lines of a broken line. Noise is every bug or risk finding that is not near one.
//   node tools/review-bench.mjs                  the pattern checks only (offline, seconds)
//   node tools/review-bench.mjs --deep URL       also the closer read (VOID_REVIEW_KEY, as tools/review-pr.mjs --deep)
//   node tools/review-bench.mjs --json           the scores and every case as JSON
// Add a case whenever a fix lands for a bug the review let through: the score only means something if the set keeps growing.
// Noise is checked by hand in tools/review-noise.json (each finding read at its commit: "false", or "real" for a bug the bench
// does not score), so the summary says how many other findings were false alarms, real, or not yet checked.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
export const WINDOW = 3;
const CHECKED = JSON.parse(readFileSync(resolve(here, 'review-noise.json'), 'utf8'));
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120e3 });

/** the commit and line (in that commit's file) that wrote each line matching `quote` in `file` just before `fix` */
export function blameBroken(fix, file, quote) {
  const re = new RegExp(quote); // void-review: ok (the pattern is a case written in tools/review-bench.json, meant as a regex)
  const lines = git('show', fix + '^:' + file).split('\n');
  const out = [];
  lines.forEach((l, i) => {
    if (!re.test(l)) return;
    const p = git('blame', '--porcelain', '-L', (i + 1) + ',' + (i + 1), fix + '^', '--', file).split('\n')[0].split(' ');
    out.push({ commit: p[0].slice(0, 12), line: Number(p[1]) });
  });
  return out;
}

/** the closer read's findings, from its rendered lines ("file:line — kind — sentence — `quote`", lib/review-api.js renderFindings). Pure. */
export function deepFindings(text) {
  return [...String(text || '').matchAll(/^(\S+?):(\d+) — (bug|risk|style) — (.*?)(?: — `|$)/gm)].map((m) => ({ file: m[1], line: Number(m[2]), kind: m[3], message: m[4], deep: true }));
}

/** caught or not, from Verse's findings on the bug commit and the broken lines there. Pure. */
export function score(findings, file, broken) {
  const near = (f) => f.file === file && broken.some((b) => Math.abs(f.line - b) <= WINDOW);
  const hits = findings.filter(near);
  const noise = findings.filter((f) => !near(f) && (f.kind === 'bug' || f.kind === 'risk'));
  return { caught: hits.length > 0, hits, noise };
}

/** each noise finding with what a person found when they read it ("false", "real" or "" for not yet checked). Pure. */
export function checkedNoise(noise, commit, checked) {
  return noise.map((f) => {
    const k = checked.find((x) => x.commit === commit && x.file === f.file && Math.abs(x.line - f.line) <= WINDOW);
    return { ...f, verdict: k ? k.verdict : '', why: k ? k.why : '' };
  });
}

export function runCase(c, deep = '') {
  const blamed = blameBroken(c.fix, c.file, c.quote);
  if (!blamed.length) return { ...c, error: 'no line matches the quote before the fix' };
  // the commit that wrote most of the broken lines is the one that brought the bug in
  const counts = new Map(); for (const b of blamed) counts.set(b.commit, (counts.get(b.commit) || 0) + 1);
  const commit = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const broken = blamed.filter((b) => b.commit === commit).map((b) => b.line);
  const args = [resolve(here, 'review-pr.mjs'), '--base', commit + '^', '--head', commit, '--json'];
  if (deep) args.push('--deep', deep);
  let r;
  try { r = JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 300000 })); }
  catch (e) { return { ...c, commit, broken, error: 'the review did not run: ' + String(e.message || e).split('\n')[0] }; } // one case, not the whole bench
  const findings = [...(r.findings || []), ...deepFindings(r.deep)];
  const s = score(findings, c.file, broken);
  return { ...c, commit, broken, ...s, noise: checkedNoise(s.noise, commit, CHECKED) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--deep'), deep = i > 0 ? process.argv[i + 1] : '';
  const cases = JSON.parse(readFileSync(resolve(here, 'review-bench.json'), 'utf8')).map((c) => runCase(c, deep));
  const ran = cases.filter((c) => !c.error), caught = ran.filter((c) => c.caught);
  const all = ran.flatMap((c) => c.noise), noise = all.length;
  const tally = { false: all.filter((f) => f.verdict === 'false').length, real: all.filter((f) => f.verdict === 'real').length };
  tally.unchecked = noise - tally.false - tally.real;
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ caught: caught.length, of: ran.length, noise, checked: tally, cases }, null, 1)); process.exit(0); }
  for (const c of cases) {
    if (c.error) { console.log('skip  ' + c.id + ': ' + c.error); continue; }
    console.log((c.caught ? 'caught' : 'missed') + '  ' + c.id + '  (' + c.commit + ', ' + c.file + ':' + c.broken.join(',') + ')' + (c.noise.length ? '  noise ' + c.noise.length : ''));
    if (!c.caught) console.log('        ' + c.what);
    for (const f of c.noise) console.log('        noise' + (f.verdict ? ' (' + (f.verdict === 'real' ? 'a real bug' : 'checked: false alarm') + ')' : ' (not checked yet)') + ': ' + f.file + ':' + f.line + ' ' + f.kind + ' — ' + String(f.message || f.rule || '').slice(0, 200)); // what it said
  }
  console.log('\nVoid\'s review' + (deep ? ' with the closer read' : ' (pattern checks)') + ' caught ' + caught.length + ' of ' + ran.length + ' bugs that reached main; ' + noise + ' other bug or risk findings on those commits' + (noise ? ' (' + tally.false + ' checked false alarms, ' + tally.real + ' real bugs, ' + tally.unchecked + ' not checked yet)' : ''));
}
