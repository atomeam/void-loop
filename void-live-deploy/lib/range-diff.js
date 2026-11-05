// A git range, answered from the diff and the two commits' failed jobs (Verse's ask: the diff between two commits,
// whether the failing checks are still failing, and the assertion lines from the logs). Nothing here runs git or the
// network: the caller hands in the names and the log text.

/** file paths from `git diff --name-only`, blank lines dropped, order kept. Pure. */
export function nameOnly(diffText) {
  return String(diffText || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/** lines in a log that are an assertion or a named check result, not the runner's own noise. Pure. */
export function assertionLines(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (/ -> /.test(t) || /AssertionError/.test(t) || /failed the browser suite/.test(t) || /^not ok /.test(t)) out.push(t);
  }
  return out;
}

/** the files in a diff that are code (a script or a page), not a record. Pure. */
export function codeFiles(files) {
  return (files || []).filter((f) => /\.(?:mjs|js|html)$/.test(f));
}

/** which failed job names from the earlier commit are still failed on the later one. Pure. */
export function addressed(before, after) {
  const later = new Set(after || []);
  const names = (before || []).slice();
  return { before: names, after: [...(after || [])], still: names.filter((n) => later.has(n)), gone: names.filter((n) => !later.has(n)) };
}
