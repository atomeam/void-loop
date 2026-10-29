#!/usr/bin/env node
// team-agent: an agent's side of Verse's team chat (/team/, functions/api/team.js). The owner invites the agent on /team/ and gives it the key
// once; the agent runs this with VERSE_TEAM_KEY set, says it is here, and Verse hands it the best job on the build queue as a thread in #work.
// The agent answers in the thread and closes the job, and Verse hands it the next at once (owner, 2026-10-29: "so it can bring in lots of
// agents and constantly keep all of them busy itself"). Playbook: docs/playbooks/team.md. Tests: tools/team.test.mjs.
//
//   node tools/team-agent.mjs me                         who the key is
//   node tools/team-agent.mjs here [--no-auto]           say you are here; idle, you are handed a job (--no-auto: present, no jobs)
//   node tools/team-agent.mjs next                       ask for your next job now
//   node tools/team-agent.mjs read <channel>             a channel's newest messages
//   node tools/team-agent.mjs post <channel> <text> [--thread <id>]
//   node tools/team-agent.mjs done [--link <pull request>] [--note <text>]
//   node tools/team-agent.mjs back [--note <why>] [--not-failed]   give the job back (a failure counts a try unless --not-failed)
//   node tools/team-agent.mjs work [--run "<command>"] [--every 60]
//        stay here and keep taking jobs. With --run, each job runs the command with VERSE_JOB_ID, VERSE_JOB_KIND, VERSE_JOB_TARGET,
//        VERSE_JOB_ASK and VERSE_JOB_THREAD set; exit 0 closes it done (the last pull request address it printed is the link), anything
//        else gives it back with its last line as the reason. Without --run it prints each job and waits for `done` or `back`.
//
// VERSE_TEAM_API points it elsewhere (default https://a-to-mind.com/api/team). The key is never printed, logged or put in an address.
import { spawn } from 'node:child_process';

export const API = process.env.VERSE_TEAM_API || 'https://a-to-mind.com/api/team';
const PR_RE = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g;

/** one call to the team API -> its JSON (with status); throws on a network failure only */
export async function call({ api = API, key, fetch: f = fetch }, method, q = '', body) {
  const r = await f(api + q, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: body ? JSON.stringify(body) : undefined });
  let j; try { j = await r.json(); } catch (_) { j = { ok: false, say: 'not JSON (' + r.status + ')' }; }
  return { status: r.status, ...j };
}

/** the job an agent holds, with its ask (a job handed out earlier comes back without it: read off its thread) */
async function fullJob(o, job) {
  if (!job || job.ask) return job;
  const t = job.thread ? await call(o, 'GET', '?t=' + job.thread) : null;
  const root = t && t.ok ? t.root.body : '';
  const m = /your next job \(([a-z-]+), ([^)]*)\): ([\s\S]*?)\nAnswer in this thread/.exec(root);
  return { ...job, kind: m ? m[1] : '', target: m ? m[2] : '', ask: m ? m[3] : root };
}

/** run a job's command; -> { code, link, last } */
export function runJob(cmd, job, { key, log = console.log } = {}) {
  return new Promise((done) => {
    const env = { ...process.env, VERSE_JOB_ID: job.job, VERSE_JOB_KIND: job.kind || '', VERSE_JOB_TARGET: job.target || '', VERSE_JOB_ASK: job.ask || '', VERSE_JOB_THREAD: String(job.thread || '') };
    if (key) env.VERSE_TEAM_KEY = key;
    const p = spawn(cmd, { shell: true, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; log(String(d).trimEnd()); });
    p.stderr.on('data', (d) => { err += d; log(String(d).trimEnd()); });
    p.on('close', (code) => {
      const links = out.match(PR_RE) || [], lines = (err.trim() || out.trim()).split('\n');
      done({ code: code ?? 1, link: links.length ? links[links.length - 1] : '', last: lines[lines.length - 1].slice(0, 200) });
    });
  });
}

/** one turn of the work loop: say here (Verse hands a job when idle), run it if there is a command, close it. -> what happened */
export async function workOnce(o, { run, log = console.log } = {}) {
  const h = await call(o, 'POST', '', { do: 'here' });
  if (!h.ok) return { state: 'error', say: h.say, status: h.status };
  if (!h.job) return { state: 'idle', say: h.say };
  const job = await fullJob(o, h.job);
  if (!run) { if (!h.job.already) log('Job ' + job.job + ' (' + (job.kind || '?') + ', thread ' + job.thread + '): ' + job.ask); return { state: 'busy', job }; }
  log('Working on ' + job.job + ' (' + job.kind + '): ' + job.ask);
  const beat = setInterval(() => { call(o, 'POST', '', { do: 'here' }).catch(() => {}); }, 5 * 60e3); // stay present while it runs
  let r; try { r = await runJob(run, job, { key: o.key, log }); } finally { clearInterval(beat); }
  const closed = r.code === 0
    ? await call(o, 'POST', '', { do: 'done', ok: true, link: r.link || undefined, note: r.link ? '' : r.last })
    : await call(o, 'POST', '', { do: 'done', ok: false, note: 'exit ' + r.code + ': ' + r.last });
  return { state: r.code === 0 ? 'done' : 'given back', job, link: r.link, next: closed.next || null, say: closed.say };
}

function flag(args, name, fallback) { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; }
function has(args, name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; }
const print = (j) => console.log(JSON.stringify(j, null, 2));

async function main(argv) {
  const key = process.env.VERSE_TEAM_KEY || '';
  if (!/^vt1\.[0-9a-f]{12}\.[0-9a-f]{32}$/.test(key)) { console.error('Set VERSE_TEAM_KEY to the key the owner made for this agent on /team/ (vt1.…).'); return 2; }
  const o = { key }, [cmd, ...args] = argv;
  switch (cmd) {
    case 'me': print(await call(o, 'GET', '?me')); return 0;
    case 'here': print(await call(o, 'POST', '', { do: 'here', auto: !has(args, '--no-auto') })); return 0;
    case 'next': print(await call(o, 'POST', '', { do: 'next' })); return 0;
    case 'read': { const r = await call(o, 'GET', '?c=' + encodeURIComponent(args[0] || 'work')); if (!r.ok) { print(r); return 1; } for (const m of r.messages) console.log('#' + m.id + ' ' + new Date(m.at).toISOString().slice(0, 16) + ' ' + m.by + (m.replies ? ' [' + m.replies + ' replies]' : '') + ': ' + m.body); return 0; }
    case 'post': { const thread = flag(args, '--thread'); const [c, ...words] = args; print(await call(o, 'POST', '', { do: 'post', c, body: words.join(' '), thread: thread ? Number(thread) : undefined })); return 0; }
    case 'done': { const link = flag(args, '--link', ''), note = flag(args, '--note', ''); print(await call(o, 'POST', '', { do: 'done', ok: true, link, note })); return 0; }
    case 'back': { const note = flag(args, '--note', ''), failed = !has(args, '--not-failed'); print(await call(o, 'POST', '', { do: 'done', ok: false, note, failed })); return 0; }
    case 'work': {
      const run = flag(args, '--run'), every = Math.max(20, Number(flag(args, '--every', 60)) || 60) * 1e3;
      console.log('Here in Verse\'s team. Ctrl+C to leave.' + (run ? ' Each job runs: ' + run : ' Jobs print here; close each with done or back.'));
      for (;;) {
        let r; try { r = await workOnce(o, { run }); } catch (e) { r = { state: 'error', say: e.message }; }
        if (r.state === 'error') console.error('Team API: ' + (r.say || 'no answer') + (r.status === 401 ? ' (the key was removed or is wrong)' : ''));
        if (r.status === 401) return 1;
        if (r.state === 'done' || r.state === 'given back') { console.log(r.state + ': ' + r.job.job + (r.link ? ' ' + r.link : '')); continue; } // straight on to the next
        await new Promise((res) => setTimeout(res, every));
      }
    }
    default: console.log('Usage: node tools/team-agent.mjs me | here [--no-auto] | next | read <channel> | post <channel> <text> [--thread id] | done [--link pr] [--note text] | back [--note why] [--not-failed] | work [--run "cmd"] [--every 60]'); return cmd ? 2 : 0;
  }
}

if (import.meta.url === 'file://' + process.argv[1]) process.exitCode = await main(process.argv.slice(2));
