// Failed GitHub Actions jobs for any commit, not one commit in particular (Verse's ask: extract the failed job names
// and the failing step's log). The jobs API says which jobs failed and which step failed. The log text, when a caller
// has it, is cut to the last lines of that step. The count and the names are the same list.
const FAIL = /^(?:failure|timed_out)$/;

/** jobs whose conclusion is failure or timed_out. A skipped or cancelled job is not a failure. Pure. */
export function failedJobs(payload) {
  const jobs = payload && Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.filter((j) => j && j.name && FAIL.test(String(j.conclusion || '')));
}

/** the first step in a job that failed, or null. Pure. */
export function failedStep(job) {
  const steps = job && Array.isArray(job.steps) ? job.steps : [];
  return steps.find((s) => s && FAIL.test(String(s.conclusion || ''))) || null;
}

/** the last n non-empty lines of a log. Pure. */
export function tailLines(text, n = 30) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  const keep = Math.max(1, Math.min(200, n | 0));
  return lines.slice(-keep);
}

/** one report: the count is the number of names, and each name is a failed job. logs: { jobId: text }. Pure. */
export function reportOf(payload, logs = {}, n = 30) {
  const jobs = failedJobs(payload).map((j) => {
    const step = failedStep(j);
    const raw = logs && (logs[j.id] || logs[j.name]) || '';
    const tail = step && raw ? tailLines(sliceStep(raw, step.name), n) : tailLines(raw, n);
    return { id: j.id, name: String(j.name), conclusion: String(j.conclusion), step: step ? String(step.name) : '', tail };
  });
  return { count: jobs.length, names: jobs.map((j) => j.name), jobs };
}

/** lines of a combined job log that belong to one step (GitHub marks steps with ##[group] or a step header). Pure. */
export function sliceStep(text, step) {
  const lines = String(text || '').split(/\r?\n/);
  const name = String(step || '').trim();
  if (!name) return String(text || '');
  const start = lines.findIndex((l) => l.includes(name) && /##\[group\]|Run |step/i.test(l));
  if (start < 0) return String(text || '');
  const end = lines.findIndex((l, i) => i > start && /##\[endgroup\]/.test(l));
  return lines.slice(start, end < 0 ? lines.length : end).join('\n');
}

const API = 'https://api.github.com';

/** failed jobs for one commit of a public repo. fetchImpl(url) returns a Response. Throws nothing: a refusal is { error }. */
export async function failuresFor(sha, { repo = 'atomeam/void-loop', fetchImpl = fetch, logs = false, tail = 30 } = {}) {
  const get = async (path) => {
    try {
      const res = await fetchImpl(API + path, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'verse-actions-log' } });
      if (!res || !res.ok) return { __status: res ? res.status : 0 };
      return await res.json();
    } catch (_) { return { __status: 0 }; }
  };
  let full = String(sha || '');
  if (full.length < 40) {
    const commit = await get('/repos/' + repo + '/commits/' + encodeURIComponent(full));
    if (commit && commit.sha) full = commit.sha;
  }
  const runs = await get('/repos/' + repo + '/actions/runs?head_sha=' + encodeURIComponent(full) + '&per_page=20');
  if (runs.__status !== undefined) return { sha, count: 0, names: [], jobs: [], error: runs.__status === 403 ? 'GitHub is limiting calls' : 'GitHub did not answer' };
  const all = [];
  for (const run of runs.workflow_runs || []) {
    const body = await get('/repos/' + repo + '/actions/runs/' + run.id + '/jobs?per_page=100');
    if (body && Array.isArray(body.jobs)) all.push(...body.jobs);
  }
  const texts = {};
  if (logs) {
    for (const j of failedJobs({ jobs: all })) {
      const ann = j.check_run_url ? await get(j.check_run_url.replace(API, '') + '/annotations') : null;
      if (Array.isArray(ann)) texts[j.id] = ann.map((a) => a && a.message).filter(Boolean).join('\n');
    }
  }
  const report = reportOf({ jobs: all }, texts, tail);
  return { sha: full, ...report };
}
