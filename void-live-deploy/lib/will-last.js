// The will's last run on the growth card's "today" view (asked 2026-10-29: "put the will's last run result (shipped PR or why not) on the
// growth card's today view, live"). The will queues one want at a time (functions/api/will.js); tools/verse-job.mjs runs it through
// Verse's own coder and writes the outcome back on the queue row: "verse-job: PR <url>" when it shipped, "tries N · <outcome>: <why>"
// when it did not. GET /api/will carries the newest tried will row in this public shape, its why redacted there (lib/automation-fix.js redact,
// passed in so the browser never loads it); the growth card shows it. Pure.

/** the newest will row that was tried (a note, or a state past queued): a fresh want with nothing tried yet is not a run */
export const WILL_LAST_SQL = "SELECT ask, state, note, at, updated FROM void_queue WHERE target LIKE 'will:%' AND (COALESCE(note, '') <> '' OR state NOT IN ('queued', 'building')) ORDER BY COALESCE(updated, at) DESC LIMIT 1";
const PR_RE = /https:\/\/github\.com\/atomeam\/void-loop\/pull\/\d+/;
const SHIPPED = new Set(['done', 'live']);

/** the why of a note: no claim, no try count, no "Verse chose this" tail (that is the want's own reason, not the run's), redacted; whole (the queue caps a note at 300 characters) */
export function whyOf(note, scrub = (t) => t) {
  const parts = String(note || '').split(/\s+·\s+/).map((s) => s.trim()).filter((s) => s && !/^claimed by\b/i.test(s) && !/^tries \d+$/i.test(s) && !/^(?:verse|void) chose this:/i.test(s));
  return String(scrub(parts.join(' · '))).replace(/^verse-job:\s*/i, '').replace(/\s+/g, ' ').trim();
}

/** a queue row as the public sees it: { title, state, at, tries, shipped, pr, why }, or null. `scrub` redacts the why (the server passes redact). */
export function lastRun(row, scrub) {
  if (!row || typeof row !== 'object' || !row.state) return null;
  const note = String(row.note || ''), m = note.match(/\btries (\d+)\b/), pr = (note.match(PR_RE) || [null])[0];
  return {
    title: String(row.ask || '').replace(/\s+/g, ' ').trim(),
    state: String(row.state),
    at: String(row.updated || row.at || ''),
    tries: m ? +m[1] : 0,
    shipped: SHIPPED.has(row.state),
    pr,
    why: whyOf(note, scrub).replace(new RegExp('^' + String(row.state).replace(/[^a-z ]/gi, '') + ':\\s*', 'i'), ''),
  };
}

/** the line on the growth card: what the will last tried and whether it shipped, with the PR or the reason. '' without a run. */
export function lastRunHtml(esc, r) {
  if (!r || !r.title) return '';
  const when = r.at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.at) ? ' (' + r.at.slice(0, 16).replace('T', ' ') + ' UTC)' : '';
  const head = '<b>The will\'s last run</b>' + esc(when) + ': ' + esc(r.title) + '. ';
  let tail;
  if (r.shipped && r.pr) tail = 'Shipped: <a href="' + esc(r.pr) + '" target="_blank" rel="noopener">PR #' + esc(r.pr.split('/').pop()) + '</a>.';
  else if (r.shipped) tail = 'Shipped' + (r.why ? ': ' + esc(r.why) : '') + '.';
  else {
    const where = r.state === 'set aside' ? 'Set aside' : r.state === 'building' ? 'Building now' : r.state === 'failed' ? 'Failed' : 'Not shipped yet' + (r.tries ? ' (try ' + r.tries + ' of 3)' : '');
    tail = where + (r.why ? ': ' + esc(r.why) : '') + '.';
  }
  return '<div class="sub will-last" data-will-state="' + esc(r.state) + '" data-will-shipped="' + (r.shipped ? '1' : '0') + '" style="line-height:1.45;margin-top:6px">' + head + tail + '</div>';
}
