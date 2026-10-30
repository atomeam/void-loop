// Verse proposes the fix (frontier #28, step 3 of docs/playbooks/probe-and-fix.md): the oldest open `probe:` job (an ask Verse wrote
// for itself and missed, tools/probe-asks.mjs) goes back to Verse's model with the owning skill's file (owner-only /api/propose-fix,
// lib/propose-fix.js), which proposes the narrowest matcher change as exact line replacements. This applies them to a copy of the
// skill and lets the repo's own checks decide, in order: the skill collision check (tools/skills-check.mjs), the skill's unit test
// when it has one, Verse's review as a gate (tools/review-pr.mjs --gate), and the everyday benchmark on the missed ask plus every
// bench ask the skill already answers (BENCH_ASKS, so nothing it knew is lost). A proposal that passes everything is written as
// a patch file for the workflow's write job (.github/workflows/propose-fix.yml), which moves the bytes into a pull request labelled
// "made by Verse" and automerge (owner, 2026-10-16); a proposal that fails any step is undone here and the job's note says which step, so a builder
// picks it up. Nothing a model wrote runs with a write token, and the job's ask is Verse's own words.
//   node tools/propose-fix.mjs                         the oldest open probe: job (owner token VOID_OWNER_TOKEN)
//   node tools/propose-fix.mjs --job <id>              that job
//   node tools/propose-fix.mjs --ask "…" --skill words  no queue: propose for this ask and skill (always --dry)
//   node tools/propose-fix.mjs --dry                   propose, apply and test, but leave the queue note alone
//   --brain claude   Claude proposes instead of Verse's own model (tools/claude-brain.mjs; ANTHROPIC_API_KEY, one call, capped)
//   --out <dir>   where the patch (propose-fix.patch) and the result (propose-fix.json) are written (default: the temp folder)
// Exit 0 when it ran (passed or failed cleanly), 3 when there is no job, the site could not be reached or Verse proposed nothing.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { jobAsk, applyEdits, evidenceOf, whereOf, riskOf, MAX_SOURCE } from '../void-live-deploy/lib/propose-fix.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const STEPS = ['collisions', 'lets go', 'unit test', 'void review', 'benchmark', 'answers']; // 'lets go' runs for a routing correction only, 'answers' for a learned ask only
export const stepsFor = (mode) => STEPS.filter((s) => (mode === 'narrow' ? s !== 'answers' : s !== 'lets go'));

/** The job to work on: the oldest open probe: job (or a miss: job the router says a skill should have caught: its lane is propose-fix), or the one named; null when there is none. */
export function pickJob(queue, id = '', hasSkill = (name) => existsSync(join(root, 'void-live-deploy', 'skills', name + '.js'))) {
  // a job whose skill has no file of its own (a route the page makes inline, like the automation fix) is a builder's, never Verse's:
  // skipping it keeps one such job from blocking every probe behind it
  const items = ((queue && queue.items) || []).filter((i) => (/^(probe|route):/.test(i.target) || (/^miss:/.test(i.target) && /\brouter skill:/.test(String(i.note || '')))) && /^(queued|building)$/.test(i.state) && jobAsk(i) && hasSkill(jobAsk(i).skill));
  if (id) return items.find((i) => i.id === id) || null;
  return items.sort((a, b) => String(a.at).localeCompare(String(b.at)))[0] || null;
}

/** The asks the benchmark replays after the change: the missed one first, then every bench ask the skill already answers. */
export function regressionAsks(miss, bench, skill) {
  const own = (bench || []).filter((b) => String(b.want || '').split('|').some((p) => p === 'skill:' + skill || p === skill));
  const rest = own.filter((b) => b.ask.trim().toLowerCase() !== miss.ask.trim().toLowerCase());
  // a routing correction: the ask is checked by 'lets go' (the skill's own match()), the bench keeps everything the skill should still answer
  return miss.mode === 'narrow' ? rest : [{ ask: miss.ask, want: miss.want }, ...rest];
}

/** a routing correction's own check: the skill file as it stands now, loaded fresh, must no longer take the ask; '' when it lets
 * go, else why not. */
export async function letsGo(file, ask) {
  try { const mod = (await import(pathToFileURL(file).href + '?v=' + Date.now() + Math.random())).default; return mod.match(String(ask).toLowerCase(), ask) ? 'the skill still takes the ask' : ''; }
  catch (e) { return 'the edited skill did not load: ' + e.message; }
}

// what a card says when the skill took the ask but had no answer for it ("I couldn't find “is nyc”. Try a city name.")
export const NO_ANSWER = /couldn['’]t find|could not find|can['’]t find|cannot find|no (?:match|result)s? for|try a city name|didn['’]t (?:answer|understand)|not sure what you mean/i;
/** The benchmark checks that the right skill takes the ask, not that the card answers it: on 2026-10-30 a fix for "how far is nyc to london"
 *  passed every step and went out as "Verse fixes its distance skill" while the live card said it could not find "is nyc". This runs the
 *  edited skill's run() on the ask, with the network and a bare page, and reads what it drew: 'answered', 'no answer' (with the line that
 *  says so), or 'not run' when the skill needs more of the page than a bare one gives (then the fix only routes, and its title says so). */
export async function answers(file, ask, { timeoutMs = 15000 } = {}) {
  const pages = [], esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const base = { esc, showPage: (fn) => { const el = { innerHTML: '', textContent: '', style: {}, appendChild() {}, querySelector: () => null }; fn(el); pages.push(el); return el; }, _pageStill: () => true };
  const api = new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => undefined) });
  try {
    const mod = (await import(pathToFileURL(file).href + '?v=' + Date.now() + Math.random())).default;
    const out = await Promise.race([mod.run(ask, api), new Promise((_, no) => setTimeout(() => no(new Error('no answer in ' + timeoutMs / 1000 + ' s')), timeoutMs))]);
    const said = pages.map((p) => String(p.innerHTML || p.textContent || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).join(' ');
    const bad = said.match(NO_ANSWER);
    if (bad) return { outcome: 'no answer', why: said.slice(Math.max(0, bad.index - 40), bad.index + 80).trim() };
    if (out === 'none' && !said) return { outcome: 'no answer', why: 'the skill drew nothing' };
    return { outcome: 'answered', why: '' };
  } catch (e) { return { outcome: 'not run', why: String(e && e.message || e).slice(0, 120) }; }
}
/** The pull request's title: "fixes" only when the card answered the ask; a fix whose answer could not be checked here only routes. Pure. */
export function titleFor(miss, outcome) {
  if (miss.mode === 'narrow') return 'Verse\'s ' + miss.skill + ' skill lets go of "' + miss.ask + '" (a correction)';
  return outcome === 'answered' ? 'Verse fixes its ' + miss.skill + ' skill: learn to handle "' + miss.ask + '"' : 'Verse routes "' + miss.ask + '" to its ' + miss.skill + ' skill (the answer is not checked)';
}

/** a gateway error worth one more try (the edge or the model's route hiccupped); 4xx and 500 are answers, not hiccups. Pure. */
export const retryable = (status) => status === 502 || status === 503 || status === 504;
export const RETRY_MS = 8000;
/** The job's state after an attempt: 'done' when the fix passed (its pull request carries it), 'failed' when a step stopped it. Pure. */
export const stateFor = (result) => (result && result.passed ? 'done' : 'failed');
/** The part of a skill file the model is sent: the whole file when it fits, else its head and its tail (where match() and the examples live) with a
 *  clipped marker between, at most `max` characters. The route's guard caps the body at 40,000 bytes and the model is shown at most MAX_SOURCE
 *  (lib/propose-fix.js), so until 2026-10-23 every skill file over ~39 KB made the POST a 413 and the job stayed open at the cap for days. Pure. */
export function sourceWindow(source, max = MAX_SOURCE) {
  const src = String(source || '');
  if (src.length <= max) return src;
  const marker = '\n// … (clipped: the middle of the file is not shown) …\n', head = Math.floor((max - marker.length) / 3), tail = max - marker.length - head;
  return src.slice(0, head) + marker + src.slice(src.length - tail);
}
/** The queue note after an attempt: which step stopped it, or where the fix went; counts and step names only. */
export function noteFor(result) {
  if (result.passed) return 'Verse proposed a fix that passed ' + stepsFor(result.mode).join(', ') + ' (' + result.edits + ' line change' + (result.edits === 1 ? '' : 's') + ' in skills/' + result.skill + '.js); it went onto main when Verse was sure (0.8 or more), else its v01d/fix- branch waits for the owner';
  return 'Verse proposed a fix (' + result.edits + ' line change' + (result.edits === 1 ? '' : 's') + ') that failed at: ' + result.failed + (result.detail ? ' (' + result.detail + ')' : '') + '';
}

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: opts.timeout || 600000, env: { ...process.env, ...(opts.env || {}) }, maxBuffer: 64 * 1024 * 1024 });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const direct = opt('--ask') && opt('--skill'), dry = args.includes('--dry') || !!direct;
  const outDir = opt('--out') || join(os.tmpdir(), 'void-propose-fix'); mkdirSync(outDir, { recursive: true });
  const api = async (path, method = 'GET', body) => {
    const tok = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN; if (!tok) throw new Error('VOID_OWNER_TOKEN is not set in this environment');
    const go = () => fetch(SITE + path, { method, headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-propose-fix/1.0', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let res = await go();
    // one more try after a gateway error (2026-10-19: a 502 from the model's route spent a whole tick of the growth clock)
    if (retryable(res.status)) { await new Promise((r) => setTimeout(r, RETRY_MS)); res = await go(); }
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`); return res.json();
  };
  let job = null, miss;
  try {
    if (direct) miss = { ask: opt('--ask'), skill: opt('--skill'), want: 'skill:' + opt('--skill') };
    else { job = pickJob(await api('/api/queue'), opt('--job') || ''); if (!job) { console.log('no open probe: job to work on'); process.exit(3); } miss = jobAsk(job); }
  } catch (e) { console.error('propose-fix: the queue was not read: ' + e.message); process.exit(3); }
  // a job that cannot be worked leaves the open list with the reason (2026-10-23: a 413 on the POST exited here without marking the job, so the
  // same four over-size jobs sat at the probe cap for days and no new miss was ever queued: the loop starved itself)
  const bail = async (why) => { console.error('propose-fix: ' + why); if (job && !dry) { try { await api('/api/queue', 'PATCH', { id: job.id, state: 'failed', note: ('Verse proposed nothing: ' + why).slice(0, 300) }); } catch (e) { console.error('propose-fix: the job note was not written: ' + e.message); } } process.exit(3); };
  const file = join(root, 'void-live-deploy', 'skills', miss.skill + '.js');
  if (!existsSync(file)) await bail('no skill file for ' + miss.skill);
  const source = readFileSync(file, 'utf8');
  let proposal;
  const brain = opt('--brain') === 'claude' ? 'claude' : 'v01d';
  try {
    if (brain === 'claude') {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set in this environment');
      const { proposeWithClaude } = await import('./claude-brain.mjs');
      proposal = await proposeWithClaude({ ask: miss.ask, skill: miss.skill, source, mode: miss.mode, said: miss.mode === 'narrow' ? (job && job.note) || '' : '' });
      delete process.env.ANTHROPIC_API_KEY; // the checks below run the edited skill: none of them gets the key
    } else proposal = await api('/api/propose-fix', 'POST', { ask: miss.ask, skill: miss.skill, source: sourceWindow(source), ...(miss.mode === 'narrow' ? { mode: 'narrow', said: job && job.note } : {}) });
  } catch (e) { await bail((brain === 'claude' ? 'Claude' : 'Verse') + ' proposed nothing: ' + String(e.message).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)); }
  const next = applyEdits(source, proposal.edits);
  if (!next) await bail('the edits do not apply to the file as it stands');
  const result = { at: new Date().toISOString(), job: job ? job.id : null, skill: miss.skill, ask: miss.ask, want: miss.want, edits: proposal.edits.length, why: proposal.why, confidence: proposal.confidence ?? null, evidence: evidenceOf(source, proposal.edits, miss.skill), risk: riskOf(proposal.edits), model: proposal.model, brain, cost: proposal.cost ?? null, mode: miss.mode || 'learn',
    title: titleFor(miss, ''), passed: false, failed: '', detail: '' };
  let committed = false;
  writeFileSync(file, next);
  const stop = (step, detail) => { result.failed = step; result.detail = String(detail || '').replace(/\s+/g, ' ').trim().slice(0, 160); };
  try {
    const col = run(process.execPath, [join(here, 'skills-check.mjs')]);
    if (col.status !== 0) stop('collisions', (col.stdout + col.stderr).split('\n').filter((l) => /->|collision|reaches|near miss/i.test(l)).length + ' collision line(s)');
    // a routing correction: the edited skill itself must now let the ask go (its own match(), loaded fresh from the edited file)
    if (!result.failed && miss.mode === 'narrow') {
      const why = await letsGo(file, miss.ask); if (why) stop('lets go', why);
    }
    const unit = join(here, miss.skill + '.test.mjs');
    if (!result.failed && existsSync(unit)) { const u = run(process.execPath, ['--test', unit]); if (u.status !== 0) stop('unit test', (u.stdout.match(/^# fail (\d+)/m) || [])[1] ? (u.stdout.match(/^# fail (\d+)/m) || [])[1] + ' failing' : 'failed'); }
    // Verse's review reads committed refs (tools/review-pr.mjs diffs base...head), so the proposal is committed for the review and reset below
    if (!result.failed) {
      run('git', ['-c', 'user.name=Verse', '-c', 'user.email=void@a-to-mind.com', 'commit', '-q', '--no-verify', '-m', 'Verse proposes: learn to handle "' + miss.ask + '"', '--', 'void-live-deploy/skills/' + miss.skill + '.js']);
      committed = run('git', ['rev-parse', '--verify', '-q', 'HEAD~1']).status === 0 && /Verse proposes/.test(run('git', ['log', '-1', '--format=%s']).stdout);
      const rv = run(process.execPath, [join(here, 'review-pr.mjs'), '--gate', '--base', 'HEAD~1', '--head', 'HEAD']); if (rv.status !== 0) stop('void review', 'a bug or a risk on an added line');
    }
    if (!result.failed) {
      const bench = JSON.parse(readFileSync(join(here, 'bench.json'), 'utf8')), asksFile = join(outDir, 'regression.json');
      const asks = regressionAsks(miss, bench, miss.skill); writeFileSync(asksFile, JSON.stringify(asks, null, 1));
      const b = run(process.execPath, [join(here, 'bench.mjs'), '--score'], { env: { BENCH_ASKS: asksFile }, timeout: 20 * 60000 });
      let score = null; try { score = JSON.parse(b.stdout.trim().split('\n').pop()); } catch (_) { score = null; }
      if (!score) stop('benchmark', 'did not run'); else if (score.wrong && score.wrong.length) stop('benchmark', score.wrong.length + ' of ' + score.total + ' missed' + (score.wrong.some((w) => String(w.ask || w).trim().toLowerCase() === miss.ask.toLowerCase()) ? ', the ask among them' : ''));
      else result.bench = { score: score.score, total: score.total };
    }
    // the right skill takes the ask: now the card must answer it, or the fix is not a fix (a "fixed" claim comes from the answer, not the route)
    if (!result.failed && miss.mode !== 'narrow') {
      const a = await answers(file, miss.ask); result.answers = a.outcome;
      if (a.outcome === 'no answer') stop('answers', 'the card says: ' + a.why);
      result.title = titleFor(miss, a.outcome);
    }
  } catch (e) { stop(result.failed || 'checks', e.message); }
  result.passed = !result.failed;
  const diff = committed ? run('git', ['diff', 'HEAD~1', 'HEAD', '--', 'void-live-deploy/skills/' + miss.skill + '.js']) : run('git', ['diff', '--', 'void-live-deploy/skills/' + miss.skill + '.js']);
  if (result.passed) writeFileSync(join(outDir, 'propose-fix.patch'), diff.stdout);
  // the tree is left as it was either way; the patch carries the change to the write job
  if (committed) run('git', ['reset', '-q', '--hard', 'HEAD~1']); else run('git', ['checkout', '--', 'void-live-deploy/skills/' + miss.skill + '.js']);
  writeFileSync(join(outDir, 'propose-fix.json'), JSON.stringify(result, null, 1));
  // the job leaves the open list either way (2026-10-19: a failed job stayed queued, so every run took the same one again and the open
  // limit kept new misses out; nothing grew for days): done when its pull request is up, failed with the step that stopped it otherwise
  if (job && !dry) { try { await api('/api/queue', 'PATCH', { id: job.id, state: stateFor(result), note: noteFor(result).slice(0, 300) }); } catch (e) { console.error('propose-fix: the job note was not written: ' + e.message); } }
  // one record in Verse's probe ledger (lib/probe-log.js): the skill, the line changes, Verse's confidence and what came of it, never the ask
  if (job && !dry) { try { await api('/api/probe-log', 'POST', { kind: 'fix', skill: result.skill, edits: result.edits, confidence: result.confidence, passed: result.passed, failed: result.failed }); } catch (e) { console.error('propose-fix: the probe ledger was not written: ' + e.message); } }
  console.log('### Verse proposed a fix for its ' + miss.skill + ' skill\n\n| What | |\n|:--|:--|\n| the ask | "' + miss.ask + '" (wanted ' + miss.want + ') |\n| line changes | ' + result.edits + (result.evidence.length ? ' (' + whereOf(result.evidence) + ')' : '') + ' |\n| Verse\'s confidence | ' + (result.confidence ?? '—') + ' |\n| risk | ' + result.risk.level + ' (' + result.risk.why + ') |\n| brain | ' + (result.model || brain) + (result.cost != null ? ' ($' + result.cost + ' this run)' : '') + ' |\n| why, in Verse\'s words | ' + (result.why || '—') + ' |\n| result | ' + (result.passed ? 'passed ' + stepsFor(result.mode).join(', ') + (result.bench ? ' (' + result.bench.score + '/' + result.bench.total + ')' : '') : 'failed at ' + result.failed + (result.detail ? ': ' + result.detail : '')) + ' |');
  process.exit(0);
}
