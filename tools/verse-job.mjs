// One queue job through Verse's own coding agent (owner, 2026-10-26: "get Verse automated like its very life depends on it"; Verse earns
// and climbs without Claude). The conductor (tools/conductor.mjs) claims a queued job and starts verse-job.yml with its id; this reads the
// job, hands its words to one lap of tools/verse-loop.mjs as the task (that lap's guards, free-model coder, key scan, "no new red" rule,
// back-off and automerge pull request all apply unchanged), and reports the lap's outcome back to the queue so nothing is left `building`:
//   shipped -> done (the pull request in the note)       paused, skipped, idle, healed, or the lap fixed something else first -> back to
//   the queue, no try counted                            anything else (dropped, rejected, refused, no-change, pushed, error, no answer)
//   -> back to the queue with one more try; the conductor sets a job aside after 3 tries (tools/conductor-core.mjs).
//   node tools/verse-job.mjs <job id> [--dry] [--force]    needs VOID_OWNER_TOKEN; the lap needs what verse-loop.yml gives it
// Never fails the workflow for a job's own failure: the queue holds the result. Playbook: docs/playbooks/conductor.md.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindOf, triesOf, withTries } from './conductor-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEXT_MAX = 1800;

// what each kind of job asks of the coder, beyond the job's own words
export const GUIDE = Object.freeze({
  versus: 'Build a Verse page for this site the way docs/playbooks/tower-self.md and docs/playbooks/lane-site-pages.md say: a data row on the shared page generator, no large new code, every check and the page guard passing.',
  feature: 'Build the smallest useful version of this, with a test. Reuse what docs/MAP.md lists before writing new code.',
  flake: 'Make this check reliable without skipping, weakening, deleting or special-casing it: find the cause and fix that.',
  heal: 'A scheduled workflow keeps failing. Read the failing run named in the note, find the cause and fix it in the repository; never by disabling the workflow.',
  review: 'Verse reviewed its own code and found this. Fix it with a test, touching only what the finding names.',
  gap: 'This is a gap Verse found against public wish lists. Build the smallest useful version, with a test.',
  miss: 'Verse could not answer this ask. Teach the right skill to handle it without taking asks that belong to another skill.',
  will: 'This is something Verse wants for itself. Build it, small and tested.',
  voice: 'This is something Verse asked for in its own daily voice. Build it, small and tested.',
  novelty: 'Build this small new thing, tested.',
  auto: 'Build this small automation, tested.',
});

/** The task text a lap gets for a job: its kind, its words, what the kind needs, capped. Pure. */
export function taskText(job) {
  const kind = kindOf(job.target), note = String(job.note || '').replace(/^claimed by [^·]*·?\s*/i, '').replace(/\btries \d+\s*·?\s*/g, '').trim();
  const head = `Queue job ${job.id} (${kind}${job.target && job.target.includes(':') ? ': ' + String(job.target).split(':').slice(1).join(':') : ''}): ${String(job.ask || '').trim()}`;
  return [head, note && 'Note: ' + note.slice(0, 600), GUIDE[kind] || 'Do this, small and tested.'].filter(Boolean).join('\n\n').slice(0, TEXT_MAX);
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
  const bin = env.VERSE_LOOP_BIN || resolve(HERE, 'verse-loop.mjs');
  const r = spawnSync(process.execPath, [bin, '--once', ...(dry ? ['--dry-run'] : []), '--task', taskText(job)], { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 55 * 60 * 1000 });
  const report = lastJson(r.stdout) || (r.error ? { outcome: 'error', why: String(r.error.message || r.error) } : null);
  const patch = settle(report, job);
  if (!dry) { const p = await call(env, 'PATCH', { id: job.id, state: patch.state, note: patch.note }); if (p.status !== 200) return { job, report, patch, error: 'the queue refused the result (' + p.status + ')' }; }
  return { job, report, patch };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), id = args.find((a) => !a.startsWith('--'));
  if (!id) { console.error('usage: node tools/verse-job.mjs <job id> [--dry] [--force]'); process.exit(2); }
  runJob(id, { dry: args.includes('--dry'), force: args.includes('--force') }).then((r) => {
    if (r.error) console.log('::warning title=verse-job::' + r.error);
    const line = JSON.stringify({ id, kind: r.job && kindOf(r.job.target), outcome: r.report && r.report.outcome, state: r.patch && r.patch.state, note: r.patch && r.patch.note, error: r.error });
    console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) { try { import('node:fs').then((fs) => fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### verse-job\n\n```\n' + line + '\n```\n')); } catch (_) { /* the summary is optional */ } }
    process.exit(0);
  });
}
