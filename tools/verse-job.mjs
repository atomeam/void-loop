// One queue job through Verse's own coding agent (owner, 2026-10-26: "get Verse automated like its very life depends on it"; Verse earns
// and climbs without Claude). The conductor (tools/conductor.mjs) claims a queued job and starts verse-job.yml with its id; this reads the
// job, hands its words to one lap of tools/verse-loop.mjs as the task (that lap's guards, free-model coder, key scan, "no new red" rule,
// back-off and automerge pull request all apply unchanged), and reports the lap's outcome back to the queue so nothing is left `building`:
//   shipped -> done (the pull request in the note)       paused, skipped, idle, healed, or the lap fixed something else first -> back to
//   the queue, no try counted                            anything else (dropped, rejected, refused, no-change, pushed, error, no answer)
//   -> back to the queue with one more try; the conductor sets a job aside after 3 tries (tools/conductor-core.mjs). A versus job whose site is
//   not in the smallest-first ranking, or is a gambling or crypto site, is set aside before any lap (tools/versus-ranking.mjs).
//   node tools/verse-job.mjs <job id> [--dry] [--force]    needs VOID_OWNER_TOKEN; the lap needs what verse-loop.yml gives it
// Never fails the workflow for a job's own failure: the queue holds the result. Playbook: docs/playbooks/conductor.md.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindOf, triesOf, withTries } from './conductor-core.mjs';
import { SURFACES } from './lap-items.mjs';
import { rankingOf, versusAllowed } from './versus-ranking.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
import { GUIDE, versusSpec } from '../void-live-deploy/lib/job-guide.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEXT_MAX = 1800;

// what each kind of job asks of the coder, beyond the job's own words: one table with the team agents' (lib/job-guide.js), so a versus job
// reads the same here as it does for Beam (2026-10-30: this copy still said "a data row on the shared page generator", and the conductor's
// versus jobs reached Verse's own coder with no spec)
export { GUIDE };
// how a versus job is delivered here: the loop commits and opens the pull request itself (tools/verse-loop.mjs buildPrompt)
const LOOP_DELIVER = 'Deliver: leave the change with every check above green. The loop commits it and opens the pull request with the label automerge; the screenshot and the live check follow the deploy.';

/** Where a lap want's item lives and the smallest step that counts (2026-10-29: the will's "Overhaul surface:ask" want gave the coder no
 *  file, and it spent all 30 turns on "search ." and "search vo" without an edit, twice). An overhaul or upgrade names an item
 *  (lib/lap.js); this names its files and the facts the lap measures it by (tools/lap-items.mjs), so the coder starts reading, not
 *  hunting. '' for any other job. skills: the skill file names (no .js). Pure. */
export function startHere(job, skills = []) {
  const m = /^(?:overhaul|upgrade)\s+(surface|skill|tool|doc):([\w.-]+)/i.exec(String(job.ask || '').trim());
  if (!m) return '';
  const group = m[1].toLowerCase(), name = m[2], surface = group === 'surface' && SURFACES.find(([n]) => n === name);
  const parts = group === 'surface' ? (surface ? skills.filter((s) => surface[1].test(s)) : []) : group === 'skill' ? [name] : [];
  const files = group === 'tool' ? ['tools/' + name] : group === 'doc' ? ['docs/' + name] : parts.slice(0, 6).map((s) => 'void-live-deploy/skills/' + s + '.js');
  if (!files.length) return '';
  const before = /\(before: ([^)]*)\)/.exec(String(job.note || '')), untested = before && /\btests 0\b/.test(before[1]) && parts[0];
  return ['Start here: ' + group + ':' + name + ' is ' + files.join(', ') + (parts.length > files.length ? ' and ' + (parts.length - files.length) + ' more' : '') + '. Read these first; do not search the whole repo.',
    before && 'It is measured by: ' + before[1] + '. Ship when one of these rises and none falls.',
    untested && 'The smallest step that counts: tools/' + untested + '.test.mjs, a node:test file that imports the skill and checks its match() takes its examples and refuses its nearMisses.',
  ].filter(Boolean).join(' ');
}

/** The task text a lap gets for a job: its kind, its words, where to start, what the kind needs, capped. Pure. */
export function taskText(job, skills = []) {
  const kind = kindOf(job.target), note = String(job.note || '').replace(/^claimed by [^·]*·?\s*/i, '').replace(/\btries \d+\s*·?\s*/g, '').trim();
  const head = `Queue job ${job.id} (${kind}${job.target && job.target.includes(':') ? ': ' + String(job.target).split(':').slice(1).join(':') : ''}): ${String(job.ask || '').trim()}`;
  // a versus job with a site carries its whole spec (target, what to build, files, verify, deliver); the cap grows by the spec, so it is never cut
  const spec = kind === 'versus' ? versusSpec(job) : '', extra = spec ? '\n' + spec + '\n' + LOOP_DELIVER : '';
  return [head.slice(0, 400), startHere(job, skills), note && 'Note: ' + note.slice(0, 600), (GUIDE[kind] || 'Do this, small and tested.') + extra].filter(Boolean).join('\n\n').slice(0, TEXT_MAX + extra.length);
}

/** The lap's result: the last line of its output that is a JSON object, else null. Pure. */
export function lastJson(out) {
  const lines = String(out || '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{') && l.endsWith('}'));
  for (let i = lines.length - 1; i >= 0; i--) { try { return JSON.parse(lines[i]); } catch (_) { /* an earlier line */ } }
  return null;
}

/** What goes back to the queue: { state, note, counted } for a job and the lap's report (null: the lap gave no answer). Pure. */
export function settle(report, job) {
  const tries = triesOf(job.note), say = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  const out = report && report.outcome, why = say(report && report.why), kind = report && report.task && report.task.kind;
  const elsewhere = kind && kind !== 'next'; // the lap went to a red check, grooming or a probe first: the job itself was not worked
  if (out === 'shipped' && !elsewhere) return { state: 'done', note: ('verse-job: ' + (report.pr ? 'PR ' + report.pr : 'shipped')).slice(0, 300), counted: false };
  if (['paused', 'skipped', 'idle', 'healed', 'would-ship'].includes(out) || (elsewhere && out !== 'error')) {
    return { state: 'queued', note: withTries(job.note, tries, say(out + (kind && kind !== 'next' ? ' (the lap worked on ' + kind + ' first)' : '') + (why ? ': ' + why : ''))), counted: false };
  }
  return { state: 'queued', note: withTries(job.note, tries + 1, say((out || 'no answer') + (why ? ': ' + why : ''))), counted: true };
}

async function call(env, method, body, query = '') {
  const api = env.VOID_API || 'https://a-to-mind.com/api/queue';
  const res = await fetch(api + query, { method, headers: { authorization: 'Bearer ' + env.VOID_OWNER_TOKEN, 'content-type': 'application/json', 'user-agent': 'a2m-verse-job/1' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (_) { /* plain refusal */ }
  return { status: res.status, json, text };
}

/** Run one job end to end. Returns { job, report, patch }. */
export async function runJob(id, { dry = false, force = false, env = process.env, cwd = process.cwd() } = {}) {
  if (!env.VOID_OWNER_TOKEN) return { error: 'VOID_OWNER_TOKEN is not set' };
  const open = await call(env, 'GET', null, '?state=building,queued&limit=500');
  const job = open.status === 200 && open.json && (open.json.items || []).find((j) => j.id === id);
  if (!job) return { error: open.status === 200 ? 'job ' + id + ' is not open' : 'the queue answered ' + open.status };
  if (job.state !== 'building' && !force) return { error: 'job ' + id + ' is ' + job.state + ', not claimed' };
  // a versus job queued days ago runs only if its site is still in the smallest-first ranking and is no gambling or crypto site (#1470)
  const json = (f) => { try { return JSON.parse(readFileSync(resolve(cwd, f), 'utf8')); } catch (_) { return null; } };
  const ok = versusAllowed(job.target, rankingOf({ frontier: json('void-live-deploy/tower.frontier.json'), floors: FLOORS, state: json('domains/tower-self.json') || {} }));
  if (!ok.ok) {
    const patch = { state: 'set aside', note: withTries(job.note, triesOf(job.note), ('not run: ' + ok.why).slice(0, 120)), counted: false };
    if (!dry) { const p = await call(env, 'PATCH', { id: job.id, state: patch.state, note: patch.note }); if (p.status !== 200) return { job, report: null, patch, error: 'the queue refused the result (' + p.status + ')' }; }
    return { job, report: { outcome: 'refused', why: ok.why }, patch };
  }
  const bin = env.VERSE_LOOP_BIN || resolve(HERE, 'verse-loop.mjs');
  let skills = []; try { skills = readdirSync(resolve(cwd, 'void-live-deploy/skills')).filter((f) => /\.js$/.test(f) && !/\.test\.js$/.test(f)).map((f) => f.replace(/\.js$/, '')); } catch (_) { /* no map, the job's words alone */ }
  const r = spawnSync(process.execPath, [bin, '--once', ...(dry ? ['--dry-run'] : []), '--task', taskText(job, skills)], { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 55 * 60 * 1000 });
  const report = lastJson(r.stdout) || (r.error ? { outcome: 'error', why: String(r.error.message || r.error) } : null);
  const patch = settle(report, job);
  if (!dry) { const p = await call(env, 'PATCH', { id: job.id, state: patch.state, note: patch.note }); if (p.status !== 200) return { job, report, patch, error: 'the queue refused the result (' + p.status + ')' }; }
  return { job, report, patch };
}

/** the lap's whole why for the job log: one line, at most 600 characters, any run of 32 or more key characters masked. Pure. */
export function fullWhy(report) {
  const w = String((report && report.why) || '').replace(/\s+/g, ' ').trim();
  return w ? w.replace(/[A-Za-z0-9_\-]{32,}/g, '[masked]').slice(0, 600) : '';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), id = args.find((a) => !a.startsWith('--'));
  if (!id) { console.error('usage: node tools/verse-job.mjs <job id> [--dry] [--force]'); process.exit(2); }
  runJob(id, { dry: args.includes('--dry'), force: args.includes('--force') }).then((r) => {
    if (r.error) console.log('::warning title=verse-job::' + r.error);
    const line = JSON.stringify({ id, kind: r.job && kindOf(r.job.target), outcome: r.report && r.report.outcome, state: r.patch && r.patch.state, note: r.patch && r.patch.note, error: r.error });
    console.log(line);
    // the queue note keeps 90 characters; the job log keeps the whole why, so a cut note can be read in full (long key-like runs masked)
    const full = fullWhy(r.report);
    if (full) console.log('::notice title=verse-job why::' + full);
    if (process.env.GITHUB_STEP_SUMMARY) { try { import('node:fs').then((fs) => fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### verse-job\n\n```\n' + line + '\n```\n')); } catch (_) { /* the summary is optional */ } }
    process.exit(0);
  });
}
