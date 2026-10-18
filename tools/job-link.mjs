// A build-queue job follows its pull request (asked by Verse: "Learn skills by myself by turning the daily miss list into queued
// jobs"; a job used to sit at `building` forever once its PR merged). The link is one line at the end of the PR body, `Job: <id>`:
// tools/finish.mjs --job writes it and moves the job to `building` when the PR opens; tools/automerge.mjs moves it to `live` when
// it merges (and upkeep.yml's handoff-done job does the same for a merge a person made). Pure helpers plus two fetches against
// /api/queue (owner token); nothing here reads a PR from GitHub.
//   node tools/job-link.mjs live --body-env PR_BODY --url "$PR_URL"        the job the body names -> live (note: "live: <url>")
//   node tools/job-link.mjs building --id <id> --url "$PR_URL"             that job -> building (note: "PR: <url>")
// Without VOID_OWNER_TOKEN (or VOID_MISSES_TOKEN) it prints "job <id> not moved: no VOID_OWNER_TOKEN" and exits 0: the link is a
// courtesy, never a gate. Tests: tools/job-link.test.mjs.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const ID_RE = /^[a-z0-9]{4,16}$/; // a queue id is Date.now().toString(36) (functions/api/queue.js)
const LINE_RE = /^Job: ([a-z0-9]{4,16})\s*$/;
export const NOTE_MAX = 300; // what /api/queue keeps of a note

/** the line a PR body ends with. Pure. */
export const jobLine = (id) => 'Job: ' + id;

/** the job a PR body names: the LAST whole line `Job: <id>`; a "Job:" inside prose never counts. null when there is none. Pure. */
export function jobOfBody(body) {
  const lines = String(body || '').replace(/\r/g, '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) { const m = LINE_RE.exec(lines[i]); if (m) return m[1]; }
  return null;
}

/** the note with where the job went added: "<note> · <label>: <url>", clipped to what the queue keeps. Pure. */
export function noteWith(note, label, url) {
  const n = String(note || '').trim();
  return ((n ? n + ' · ' : '') + label + ': ' + url).slice(0, NOTE_MAX);
}

/** the owner token this environment holds, the way tools/propose-fix.mjs reads it; '' when none */
export const tokenOf = (env = process.env) => env.VOID_OWNER_TOKEN || env.VOID_MISSES_TOKEN || '';

const headers = (token, json) => ({ authorization: 'Bearer ' + token, 'user-agent': 'a2m-job-link/1.0', ...(json ? { 'content-type': 'application/json' } : {}) });

/** PATCH /api/queue { id, state?, note? }; the queue's view back, or an error naming the status */
export async function patchJob({ site = SITE, token, id, state, note, fetcher = fetch }) {
  const res = await fetcher(site + '/api/queue', { method: 'PATCH', headers: headers(token, true), body: JSON.stringify({ id, ...(state ? { state } : {}), ...(note ? { note } : {}) }) });
  if (!res.ok) throw new Error('PATCH /api/queue: HTTP ' + res.status);
  return res.json();
}

/** the job with this id in the queue's view (its newest 20 rows), or null */
export async function findJob({ site = SITE, token, id, fetcher = fetch }) {
  const res = await fetcher(site + '/api/queue', { headers: headers(token) });
  if (!res.ok) throw new Error('GET /api/queue: HTTP ' + res.status);
  const q = await res.json();
  return ((q && q.items) || []).find((i) => i && i.id === id) || null;
}

/** move a job and say what happened, in one line; never throws (the link is a courtesy, not a gate) */
export async function moveJob({ id, state, label, url, site = SITE, token = tokenOf(), fetcher = fetch }) {
  if (!ID_RE.test(String(id || ''))) return 'job not moved: no job id';
  if (!token) return 'job ' + id + ' not moved: no VOID_OWNER_TOKEN';
  try {
    const found = await findJob({ site, token, id, fetcher });
    const mark = label + ': ' + url;
    if (found && found.state === state && String(found.note || '').includes(mark)) return 'job ' + id + ' already ' + state + ' (' + url + ')';
    await patchJob({ site, token, id, state, note: noteWith(found && found.note, label, url), fetcher });
    return 'job ' + id + ' -> ' + state + ' (' + mark + ')';
  } catch (e) { return 'job ' + id + ' not moved: ' + String(e && e.message || e).slice(0, 160); }
}

/** the command line: { cmd, id, url, body } or { error }. Pure. */
export function parseArgs(argv, env = process.env) {
  const [cmd, ...rest] = argv, opt = (k) => { const i = rest.indexOf(k); return i >= 0 && rest[i + 1] != null ? rest[i + 1] : ''; };
  const url = opt('--url');
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(url)) return { error: '--url is the pull request address (https://github.com/<owner>/<repo>/pull/<n>)' };
  if (cmd === 'live') { const v = opt('--body-env'); return v ? { cmd, id: jobOfBody(env[v]), url } : { error: 'live takes --body-env <the variable holding the PR body>' }; }
  if (cmd === 'building') return ID_RE.test(opt('--id')) ? { cmd, id: opt('--id'), url } : { error: 'building takes --id <job id>' };
  return { error: 'usage: node tools/job-link.mjs live --body-env PR_BODY --url <pr url> | building --id <job> --url <pr url>' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2));
  if (a.error) { console.error('job-link: ' + a.error); process.exit(2); }
  if (!a.id) { console.log('no Job: line in the PR body: nothing to move'); process.exit(0); }
  console.log(await moveJob({ id: a.id, state: a.cmd, label: a.cmd === 'live' ? 'live' : 'PR', url: a.url }));
}
