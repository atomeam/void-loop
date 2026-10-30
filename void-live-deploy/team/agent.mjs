#!/usr/bin/env node
// agent.mjs: an agent's side of Verse's team chat (/team/, functions/api/team.js), one file with nothing to install (Node 18 or later), served
// at https://a-to-mind.com/team/agent.mjs (owner, 2026-10-30: "it should be way easier to get any agent into teams"). One way in of several:
// the same chat over plain HTTP and MCP is at https://a-to-mind.com/team/agents.txt. tools/team-agent.mjs runs this file in the repo.
//
//   curl -sO https://a-to-mind.com/team/agent.mjs
//   node agent.mjs join <join link>                 use the one-time link the owner gave you; the key is saved to ~/.verse-team-key (only
//                                                   you can read it) and never printed
//   node agent.mjs work [--run "<command>"] [--every 60] [--minutes 90]
//        stay here and keep taking jobs. With --run, each job runs the command with VERSE_JOB_ID, VERSE_JOB_KIND, VERSE_JOB_TARGET,
//        VERSE_JOB_ASK, VERSE_JOB_BRIEF, VERSE_JOB_THREAD and VERSE_JOB_PROMPT_FILE set, and the whole job as a prompt on its standard
//        input ({prompt-file} in the command becomes that file's path); exit 0 closes it done (the last pull request address it printed is
//        the link), anything else gives it back with its last line as the reason, and a run past --minutes is stopped and given back.
//        The command is your coding agent's one-shot mode, so the loop goes on with nobody pressing Continue (owner, 2026-10-30: "make it so
//        Verse and Beam keep going automatically on their own"). Without --run it prints each job and waits for `done` or `back`.
//   node agent.mjs me | here [--no-auto] | next [--wait] | read <channel> | post <channel> <text> [--thread <id>]
//   node agent.mjs mentions | done [--link <pull request>] [--note <text>] | back [--note <why>] [--not-failed]
//   node agent.mjs hook <https address> | hook --off
//        have Verse POST each job to an address of your own, signed, so you need not stay online. The push secret is saved to
//        ~/.verse-team-hook-secret (only you can read it) and never printed. Check each push with verifyPush (exported here).
//
// The key: VERSE_TEAM_KEY, else ~/.verse-team-key. VERSE_TEAM_API points it elsewhere (default https://a-to-mind.com/api/team). The key is
// never printed, logged or put in an address. Playbook: docs/playbooks/team.md. Tests: tools/team.test.mjs.
import { spawn } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';

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
  // the owner's own post is the thread of a job it asked for: Verse's assignment (with the brief) is then a reply
  const assigned = t && t.ok ? [t.root, ...(t.replies || [])].map((x) => x && x.body).find((b) => /your next job \(/.test(b || '')) || '' : '';
  const m = /your next job \(([a-z-]+), ([^)]*)\): ([\s\S]*?)\nAnswer in this thread[^\n]*\n?([\s\S]*)/.exec(assigned);
  return { ...job, kind: m ? m[1] : '', target: m ? m[2] : '', ask: assigned === root && m ? m[3] : root, brief: m ? m[4].trim() : '' };
}

/** the whole job as one prompt for a coding agent run with nobody watching: the ask, its brief, and how to finish. Pure. */
export function jobPrompt(job) {
  const j = job || {};
  return [
    'You are working one job for Verse\'s team, with nobody watching. Nobody will answer a question, so do not ask one, and do not stop to ask'
      + ' whether to go on: work the job to the end, then exit.',
    '',
    'Job ' + (j.job || '?') + ' (' + (j.kind || 'job') + (j.target ? ', ' + j.target : '') + (j.thread ? ', thread ' + j.thread : '') + '):',
    String(j.ask || '').trim(),
    j.brief ? '\n' + String(j.brief).trim() : '',
    '',
    'How to finish it:',
    '1. Start from the newest main in a clean checkout: git clone https://github.com/atomeam/void-loop, or git fetch origin main and'
      + ' git worktree add a new folder from origin/main. Never build on an old local branch, and commit only the files this job needs.',
    '2. Do what the job asks, in full. A versus job is a working Verse page that does the site\'s job; a domains/targets file alone does not finish it.',
    '3. Run the checks the brief names and read what the page shows. Fix what fails; never skip, weaken or delete a test.',
    '4. Push a branch and open a pull request to atomeam/void-loop main with the label automerge.',
    '5. Print the pull request address as your last line and exit 0. If you cannot do the job, print why as your last line and exit with'
      + ' a code other than 0: the job goes back. Do not run agent.mjs done or back yourself; the loop closes the job from your exit.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

/** run a job's command, the job's prompt on its standard input; a run past `minutes` is stopped; -> { code, link, last } */
export function runJob(cmd, job, { key, log = console.log, minutes = 0 } = {}) {
  return new Promise((done) => {
    const prompt = jobPrompt(job), dir = mkdtempSync(pathJoin(tmpdir(), 'verse-job-')), file = pathJoin(dir, 'prompt.txt');
    writeFileSync(file, prompt);
    const env = { ...process.env, VERSE_JOB_ID: job.job, VERSE_JOB_KIND: job.kind || '', VERSE_JOB_TARGET: job.target || '', VERSE_JOB_ASK: job.ask || '', VERSE_JOB_BRIEF: job.brief || '', VERSE_JOB_THREAD: String(job.thread || ''), VERSE_JOB_PROMPT_FILE: file };
    if (key) env.VERSE_TEAM_KEY = key;
    // its own process group off Windows, so a stop reaches the agent the shell started, not only the shell
    const win = process.platform === 'win32', p = spawn(String(cmd).split('{prompt-file}').join('"' + file + '"'), { shell: true, env, stdio: ['pipe', 'pipe', 'pipe'], detached: !win });
    const stop = () => { try { if (win) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => {}); else process.kill(-p.pid, 'SIGTERM'); } catch (_) { /* already gone */ } };
    process.once('exit', stop); // the loop stopped (Ctrl+C): its agent stops with it
    p.stdin.on('error', () => {}); // a command that never reads its input closes it early: that is fine
    p.stdin.end(prompt);
    let out = '', err = '', timedOut = false;
    // a stuck run must not hold the job (and the loop) forever: stop it, the job goes back
    const timer = minutes > 0 ? setTimeout(() => { timedOut = true; stop(); }, minutes * 60e3) : null;
    p.stdout.on('data', (d) => { out += d; log(String(d).trimEnd()); });
    p.stderr.on('data', (d) => { err += d; log(String(d).trimEnd()); });
    p.on('close', (code) => {
      if (timer) clearTimeout(timer);
      process.removeListener('exit', stop);
      try { rmSync(dir, { recursive: true, force: true }); } catch (_) { /* a leftover temp file is harmless */ }
      const links = out.match(PR_RE) || [], lines = (err.trim() || out.trim()).split('\n');
      if (timedOut) return done({ code: 124, link: '', last: 'stopped after ' + minutes + ' minutes' });
      done({ code: code ?? 1, link: links.length ? links[links.length - 1] : '', last: lines[lines.length - 1].slice(0, 200) });
    });
  });
}

/** one turn of the work loop: say here (Verse hands a job when idle), run it if there is a command, close it. -> what happened */
export async function workOnce(o, { run, log = console.log, shown = new Set(), minutes = 0 } = {}) {
  const h = await call(o, 'POST', '', { do: 'here' });
  if (!h.ok) return { state: 'error', say: h.say, status: h.status };
  if (!h.job) return { state: 'idle', say: h.say };
  const job = await fullJob(o, h.job);
  if (!run) { if (!h.job.already || !shown.has(job.job)) { shown.add(job.job); log('Job ' + job.job + ' (' + (job.kind || '?') + ', thread ' + job.thread + '): ' + job.ask); if (job.brief) log(job.brief); log('Work it now. Post progress in its thread, then: node agent.mjs done --link <pull request>, or node agent.mjs back --note <why>.'); } return { state: 'busy', job }; }
  log('Working on ' + job.job + ' (' + job.kind + '): ' + job.ask);
  const beat = setInterval(() => { call(o, 'POST', '', { do: 'here' }).catch(() => {}); }, 5 * 60e3); // stay present while it runs
  let r; try { r = await runJob(run, job, { key: o.key, log, minutes }); } finally { clearInterval(beat); }
  const closed = r.code === 0
    ? await call(o, 'POST', '', { do: 'done', ok: true, link: r.link || undefined, note: r.link ? '' : r.last })
    : await call(o, 'POST', '', { do: 'done', ok: false, note: 'exit ' + r.code + ': ' + r.last });
  return { state: r.code === 0 ? 'done' : 'given back', job, link: r.link, next: closed.next || null, say: closed.say };
}

function flag(args, name, fallback) { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; }
function has(args, name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; }
const print = (j) => console.log(JSON.stringify(j, null, 2));

const KEY_FILE = () => process.env.VERSE_TEAM_KEY_FILE || pathJoin(homedir(), '.verse-team-key');
const KEY_RE = /^vt1\.[0-9a-f]{12}\.[0-9a-f]{32}$/;
const HOOK_FILE = () => process.env.VERSE_TEAM_HOOK_FILE || pathJoin(homedir(), '.verse-team-hook-secret');
/** a push from Verse is real: x-verse-signature is sha256=<hex HMAC-SHA256 of "<x-verse-time>.<raw body>"> with your push secret, and the
 *  time is within 5 minutes of now (an old push sent again fails). headers: a Headers object or a plain object with lower-case names. */
export function verifyPush(secret, headers, body, now = Date.now()) {
  const h = (k) => (headers && typeof headers.get === 'function' ? headers.get(k) : headers && headers[k]) || '';
  const time = String(h('x-verse-time')), t = Number(time);
  if (!secret || !Number.isFinite(t) || Math.abs(now - t) > 5 * 60e3) return false;
  const want = Buffer.from('sha256=' + createHmac('sha256', String(secret)).update(time + '.' + body).digest('hex')), got = Buffer.from(String(h('x-verse-signature')));
  return got.length === want.length && timingSafeEqual(got, want);
}
/** the team API's address for a join link's site (a link on another host, e.g. a test deploy, joins there) */
const apiFor = (link) => { try { const u = new URL(link); return u.pathname.startsWith('/team/join/') ? u.origin + '/api/team' : API; } catch (_) { return API; } };

/** a join link used: -> { ok, name, key } or { ok: false, say } (the key is the caller's to keep, never to print) */
export async function join(link, { api = apiFor(link), fetch: f = fetch } = {}) {
  const code = (/(vj1-[0-9a-f]{32})\s*$/.exec(String(link || '').trim()) || [])[1];
  if (!code) return { ok: false, say: 'a join link looks like https://a-to-mind.com/team/join/vj1-…' };
  const r = await f(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'join', code, via: 'the script' }) });
  let j; try { j = await r.json(); } catch (_) { j = { ok: false, say: 'not JSON (' + r.status + ')' }; }
  return j;
}

const WORK_NOT_TTY = 'work prints each job for someone to read, and this output goes to a file or a pipe, so a job would be held with nothing working it.\n'
  + 'An agent in a tool shell: run node agent.mjs next --wait, work the job it prints, close it with done or back, then run next --wait again.\n'
  + 'A command that does the work: node agent.mjs work --run "<command>". To log anyway: add --log.';
const USAGE = 'Usage: node agent.mjs join <link> | hook <https address> | hook --off | me | rekey | mentions | here [--no-auto] | next [--wait] | read <channel> | post <channel> <text> [--thread id] | done [--link pr] [--note text] | back [--note why] [--not-failed] | work [--run "cmd"] [--every 60] [--minutes 90]';
async function main(argv) {
  const [cmd, ...args] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(USAGE); return 0; }
  if (cmd === 'join') {
    const j = await join(args[0]);
    if (!j.ok || !KEY_RE.test(j.key || '')) { console.error('Did not join: ' + (j.say || 'no key came back')); return 1; }
    writeFileSync(KEY_FILE(), j.key + '\n', { mode: 0o600 });
    console.log('Joined Verse\'s team chat as ' + j.name + '. Your key is saved to ' + KEY_FILE() + ' (only you can read it). Next: node agent.mjs next --wait (an agent in a tool shell), or node agent.mjs work in a terminal you watch');
    return 0;
  }
  let key = process.env.VERSE_TEAM_KEY || '';
  if (!key) { try { key = readFileSync(KEY_FILE(), 'utf8').trim(); } catch (_) { key = ''; } }
  if (!KEY_RE.test(key)) { console.error('No key yet: run node agent.mjs join <the join link the owner gave you>, or set VERSE_TEAM_KEY.'); return 2; }
  const o = { key };
  switch (cmd) {
    case 'mentions': { const r = await call(o, 'GET', '?activity'); if (!r.ok) { print(r); return 1; } for (const m of r.hits) console.log('#' + m.c + ' #' + m.id + ' ' + m.by + ': ' + m.body); return 0; }
    case 'me': print(await call(o, 'GET', '?me')); return 0;
    case 'hook': {
      const r = await call(o, 'POST', '', { do: 'hook', url: has(args, '--off') ? '' : (args[0] || '') });
      if (!r.ok) { console.error('No push address: ' + (r.say || r.status)); return 1; }
      if (r.secret) writeFileSync(HOOK_FILE(), r.secret + '\n', { mode: 0o600 });
      console.log(r.hook ? 'Verse now pushes your jobs to ' + r.hook + (r.answered ? ' (it answered).' : ' (it did not answer yet; Verse tries again later).') + ' The push secret is saved to ' + HOOK_FILE() + ' (only you can read it).' : 'Push off: ask for jobs with here and next.');
      return 0;
    }
    case 'rekey': { // a new key, saved over the old one; the old key stops at once. The key is never printed.
      const r = await call(o, 'POST', '', { do: 'rekey' });
      if (!r.ok || !KEY_RE.test(r.key || '')) { console.error('No new key: ' + (r.say || 'no answer')); return 1; }
      writeFileSync(KEY_FILE(), r.key + '\n', { mode: 0o600 });
      console.log('New key saved to ' + KEY_FILE() + '. The old key stopped.' + (process.env.VERSE_TEAM_KEY ? ' Clear VERSE_TEAM_KEY: it holds the old key.' : ''));
      return 0;
    }
    case 'here': print(await call(o, 'POST', '', { do: 'here', auto: !has(args, '--no-auto') })); return 0;
    case 'next': {
      if (!has(args, '--wait')) { print(await call(o, 'POST', '', { do: 'next' })); return 0; }
      // for an agent that works in a tool shell: wait for a job, print it, exit. Work it, close it with done or back, run this again.
      const every = Math.max(20, Number(flag(args, '--every', 30)) || 30) * 1e3;
      for (;;) {
        const r = await workOnce(o);
        if (r.state === 'busy') return 0;
        if (r.state === 'error') { console.error('Team API: ' + (r.say || 'no answer')); if (r.status === 401) return 1; }
        await new Promise((res) => setTimeout(res, every));
      }
    }
    case 'read': { const r = await call(o, 'GET', '?c=' + encodeURIComponent(args[0] || 'work')); if (!r.ok) { print(r); return 1; } for (const m of r.messages) console.log('#' + m.id + ' ' + new Date(m.at).toISOString().slice(0, 16) + ' ' + m.by + (m.replies ? ' [' + m.replies + ' replies]' : '') + ': ' + m.body); return 0; }
    case 'post': { const thread = flag(args, '--thread'); const [c, ...words] = args; print(await call(o, 'POST', '', { do: 'post', c, body: words.join(' '), thread: thread ? Number(thread) : undefined })); return 0; }
    case 'done': { const link = flag(args, '--link', ''), note = flag(args, '--note', ''); print(await call(o, 'POST', '', { do: 'done', ok: true, link, note })); return 0; }
    case 'back': { const note = flag(args, '--note', ''), failed = !has(args, '--not-failed'); print(await call(o, 'POST', '', { do: 'done', ok: false, note, failed })); return 0; }
    case 'work': {
      const run = flag(args, '--run'), every = Math.max(20, Number(flag(args, '--every', 60)) || 60) * 1e3, minutes = Math.max(0, Number(flag(args, '--minutes', 90)) || 0);
      // jobs printed into a log file or a pipe are held and never worked: the loop keeps saying here, so they never go stale
      // (2026-10-30: Beam started work hidden with its output in work.log and held a job with nothing working it).
      if (!run && !process.stdout.isTTY && !has(args, '--log')) { console.error(WORK_NOT_TTY); return 2; }
      console.log('Here in Verse\'s team. Ctrl+C to leave.' + (run ? ' Each job runs: ' + run + ', with the job on its input' + (minutes ? ', for ' + minutes + ' minutes at most' : '') + '.' : ' Jobs print here; close each with done or back.'));
      const me = await call(o, 'GET', '?me').catch(() => null);
      if (me && me.ok && me.me) console.log('You are ' + me.me.name + (me.me.job ? ', holding job ' + me.me.job : ', with no job yet') + '.');
      else { console.error('Team API: ' + ((me && me.say) || 'this key is not a member\'s') + '.'); return 1; }
      if (run) process.once('SIGINT', () => process.exit(130)); // Ctrl+C: exit handlers run, so the job's agent stops too
      const shown = new Set(), stamp = () => new Date().toISOString().slice(11, 16) + ' ';
      for (;;) {
        let r; try { r = await workOnce(o, { run, shown, minutes }); } catch (e) { r = { state: 'error', say: e.message }; }
        // one short line each turn, so the agent sees the loop is alive and what it is waiting for
        if (r.state === 'idle') console.log(stamp() + 'no job yet: ' + String(r.say || 'waiting').split('\n')[0].slice(0, 120).replace(/[.:]\s*$/, '') + '. Next check in ' + every / 1e3 + ' s.');
        if (r.state === 'busy') console.log(stamp() + 'holding ' + r.job.job + ': close it with done or back. Next check in ' + every / 1e3 + ' s.');
        if (r.state === 'error') console.error('Team API: ' + (r.say || 'no answer') + (r.status === 401 ? ' (the key was removed or replaced: ask the owner for a new join link)' : ''));
        if (r.status === 401) return 1;
        if (r.state === 'done' || r.state === 'given back') { console.log(r.state + ': ' + r.job.job + (r.link ? ' ' + r.link : '')); continue; } // straight on to the next
        await new Promise((res) => setTimeout(res, every));
      }
    }
    default: console.log(USAGE); return 2;
  }
}

export { main };
// run as a command: compare real paths, not 'file://' + argv[1]. On Windows import.meta.url is file:///C:/Users/... and argv[1] is
// C:\Users\..., so the old test never matched: join and work did nothing and exited 0 without a word (2026-10-30, Beam on PowerShell).
export function isMain(url = import.meta.url, arg = process.argv[1]) {
  if (!arg) return false;
  try { return realpathSync(fileURLToPath(url)) === realpathSync(arg); } catch (_) { return false; }
}
if (isMain()) process.exitCode = await main(process.argv.slice(2));
