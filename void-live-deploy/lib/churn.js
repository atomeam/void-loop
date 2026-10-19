// Churn caps for the build loop (the frontier's "stop proposing changes to a file that has changed more than N times in M days").
// A file that keeps changing is being fought over, not finished; another want that edits it adds to the pile. Pure: the caller passes the commits
// ([{ at, files: [path] }], from tools/churn.mjs reading git) and the clock.
export const MAX_CHANGES = 12;  // a file changed more than this many times ...
export const WINDOW_DAYS = 7;   // ... in this many days is hot
// files that change on every ship by design (the ledger, the logs, the registers, generated indexes): their churn is not a fight
export const EXPECTED = /(?:^|\/)(?:void\.growth\.json|void\.agents\.log\.md|incidents\.json|[\w.-]*(?:log|seen|verified)\.json|MAP\.md|void\.frontier\.md|deps\.json|index\.json|families\.json|guide\.json|self\.json|test_void\.mjs|checks\.mjs)$|^void-live-deploy\/(?:index|void)\.html$|^void\.html$/;

/** the files changed more than `max` times in the last `days` days, most changed first: [{ file, changes }]. A commit counts once per file. Pure. */
export function hotFiles(commits, { max = MAX_CHANGES, days = WINDOW_DAYS, now = Date.now() } = {}) {
  const since = now - days * 864e5, n = new Map();
  for (const c of Array.isArray(commits) ? commits : []) {
    const t = Date.parse(c && c.at);
    if (!(t >= since) || t > now) continue;
    for (const f of new Set(Array.isArray(c.files) ? c.files : [])) if (typeof f === 'string' && f && !EXPECTED.test(f)) n.set(f, (n.get(f) || 0) + 1);
  }
  return [...n].filter(([, k]) => k > max).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([file, changes]) => ({ file, changes }));
}

/** which hot files a text names, by full path or by file name as a whole word (`will-guard.js` or `lib/will-guard.js`). Pure. */
export function namedHot(text, hot) {
  const t = String(text || '').toLowerCase();
  return (Array.isArray(hot) ? hot : []).filter((h) => {
    const f = String(h && h.file || h || '').toLowerCase(), base = f.slice(f.lastIndexOf('/') + 1);
    return f && (t.includes(f) || (base.length >= 4 && new RegExp('(?<![\\w.-])' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(t)));
  }).map((h) => String(h.file || h));
}
