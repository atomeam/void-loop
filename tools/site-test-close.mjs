// The site tester closes its own items (owner, 2026-11-06: "clear the issues for the 10th time"). tools/site-test.mjs files one issue per
// distinct failure on live a-to-mind.com, but nothing ever closed one: a flake or a fixed bug stayed open until a person or an agent
// closed it by hand. Each hourly run of site-test.yml now runs this after the tester:
//   node tools/site-test-close.mjs [--dry] [--run <url>]
// It reads every open issue labelled site-test, turns its title back into the ask it failed on, and asks Verse that ask again on the
// live site, the same way the tester does (tools/site-test.mjs runVoid: a fresh browser per ask, nothing but GETs leave the browser).
// An ask that passes now closes its issue with the run that showed it, and stays in tools/site-test.json as a regression case, so the
// hourly tester keeps asking it. One that still fails stays open; the conductor (tools/conductor.mjs) puts it on Verse's build queue
// as one fix job (issueJobsOf below), and this closes it once the fix is live. A quality-upgrade item has no pass or fail to recheck
// (the weakest answer is a rank, not a bug): it goes to the queue and closes when its answer has grown past twice its old length.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';

/** The ask (and kind) behind a site-test issue title, as tools/site-test.mjs writes them: 'site-test: ' + the improvement's note, cut at
 *  120 characters. A title cut inside its ask names no whole ask and is left alone. Pure. */
export function askOf(title) {
  const t = String(title || '');
  let m = t.match(/^site-test: fix: "(.+?)" (?=load |console: |script |nothing appeared|only "|no skill|refused|missing text|unwanted text|no |fps |tester: )/);
  if (m) return { kind: 'fix', ask: m[1] };
  m = t.match(/^site-test: teach Verse "(.+?)" \(means/);
  if (m) return { kind: 'teach', ask: m[1] };
  m = t.match(/^site-test: quality upgrade: weakest answer was "(.+?)" \((\d+) chars\)/);
  if (m) return { kind: 'weak', ask: m[1], chars: Number(m[2]) };
  return null;
}

/** The case to ask again: the suite's own case for that ask (its path, wait and expectations), else the bare ask. Pure. */
export function caseFor(suite, ask) {
  const k = String(ask).toLowerCase();
  return (suite.cases || []).find((c) => String(c.ask || '').toLowerCase() === k) || { ask };
}

/** What happens to each open item after the recheck. items: [{ number, title }], results: runVoid's rows. Pure.
 *  Returns [{ number, ask, close, why }]. */
export function verdicts(items, results) {
  const by = new Map((results || []).filter(Boolean).map((r) => [String(r.ask || '').toLowerCase(), r]));
  return items.map((i) => {
    const p = askOf(i.title); if (!p) return { number: i.number, ask: null, close: false, why: 'the title names no whole ask' };
    const r = by.get(p.ask.toLowerCase()); if (!r) return { number: i.number, ask: p.ask, close: false, why: 'not rechecked this run' };
    if (p.kind === 'weak') {
      const grown = r.ok && (r.chars || 0) >= 2 * Math.max(1, p.chars);
      return { number: i.number, ask: p.ask, close: grown, why: grown ? `the answer grew from ${p.chars} to ${r.chars} chars` : `the answer is ${r.chars || 0} chars (was ${p.chars}); it closes past ${2 * p.chars}` };
    }
    return { number: i.number, ask: p.ask, close: !!r.ok, why: r.ok ? 'passed on the live site' + (Number.isFinite(r.loadMs) ? ` (home page load ${r.loadMs} ms)` : '') : 'still fails: ' + (r.why || []).join('; ') };
  });
}

/** One build-queue fix job per open site-test issue the recheck has not closed, once each, and only after it has been open
 *  `graceMs` (an hourly recheck gets the first try: most items are a flake it closes). openTargets: targets already queued. Pure. */
export function issueJobsOf(issues, openTargets = [], now = Date.now(), graceMs = 2 * 3600e3) {
  const open = new Set(openTargets.map(String)), out = [];
  for (const i of issues || []) {
    if (!i || i.pull_request || !askOf(i.title)) continue;
    const target = 'issue:' + i.number;
    if (open.has(target) || now - Date.parse(i.created_at || i.createdAt || 0) < graceMs) continue;
    out.push({ target, ask: ('Fix site-test issue #' + i.number + ' on live a-to-mind.com (it closes itself once the hourly site test passes the ask): ' + String(i.title).replace(/^site-test: /, '')).slice(0, 200), priority: 'visible' });
  }
  return out;
}

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const { SUITE, runVoid } = await import('./site-test.mjs'); // only here: the conductor imports this file's pure helpers without a browser
  const dry = a.includes('--dry'), run = opt('--run') || '';
  const items = JSON.parse(gh('api', `repos/${REPO}/issues?labels=site-test&state=open&per_page=100`)).filter((i) => !i.pull_request).map((i) => ({ number: i.number, title: i.title }));
  if (!items.length) { console.log('no open site-test items'); process.exit(0); }
  const suite = JSON.parse(readFileSync(SUITE, 'utf8')), asks = [...new Map(items.map((i) => askOf(i.title)).filter(Boolean).map((p) => [p.ask.toLowerCase(), p.ask])).values()];
  const results = asks.length ? await runVoid({ ...suite, cases: asks.map((ask) => caseFor(suite, ask)) }, { shots: opt('--shots') || 'site-test-shots/recheck' }) : [];
  const vs = verdicts(items, results);
  let grew = false;
  for (const v of vs) {
    console.log((v.close ? 'close ' : 'keep  ') + '#' + v.number + ' ' + (v.ask ? '"' + v.ask + '" ' : '') + '· ' + v.why);
    if (!v.close || dry) continue;
    try {
      gh('api', '-X', 'POST', `repos/${REPO}/issues/${v.number}/comments`, '-f', 'body=Rechecked by the site tester on live a-to-mind.com' + (run ? ' (' + run + ')' : '') + ': ' + v.why + '. Closing; the hourly site test keeps asking it as a regression case (tools/site-test-close.mjs).');
      gh('api', '-X', 'PATCH', `repos/${REPO}/issues/${v.number}`, '-f', 'state=closed', '-f', 'state_reason=completed');
    } catch (e) { console.log('::warning title=Site test close::#' + v.number + ' not closed: ' + String(e.stderr || e.message).slice(0, 160)); continue; }
    // a fixed ask stays tested: a probe that was filed is added to the suite as a regression case
    if (v.ask && !(suite.cases || []).some((c) => String(c.ask || '').toLowerCase() === v.ask.toLowerCase())) { suite.cases.push({ ask: v.ask }); grew = true; }
  }
  if (grew && existsSync(SUITE)) writeFileSync(SUITE, JSON.stringify(suite, null, 2) + '\n');
}
