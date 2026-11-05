// /agent/ while you are away (owner, 2026-11-04: an agent like Grok Bot or Claude Duet works in the background and comes back to you, asking
// before anything risky). The page keeps watching a task that is still working when its tab is hidden, and says so when it finishes, gets
// stuck or waits for your yes: in the tab's title always, and as a browser notification when you turned those on. Pure parts, tested in
// tools/agent-watch.test.mjs; the page (agent/index.html) does the fetching and the Notification.

const ACTIVE = new Set(['queued', 'running']);
const NEWS = {
  needs_yes: { title: 'Verse needs your yes', lead: 'Waiting on you: ' },
  done: { title: 'Verse finished a task', lead: 'On your Made shelf: ' },
  failed: { title: 'Verse got stuck', lead: 'Try again: ' },
};

/** each task's status by id, to compare the next read against. */
export const statusesOf = (tasks) => Object.fromEntries((tasks || []).map((t) => [t.id, t.status]));

/** what changed since `before` (statusesOf the last read) that a person should hear: a task that was working and now waits for a yes,
 * finished or got stuck. The first read (before = null) is not a change. What happened while the tab was closed is the server inbox, and tellOf says it. */
export function newsOf(before, tasks) {
  if (!before) return [];
  const out = [];
  for (const t of tasks || []) {
    const was = before[t.id], n = NEWS[t.status];
    if (!n || was === t.status) continue;
    if (was !== undefined && !ACTIVE.has(was)) continue; // only a change out of working is news (a yes you just gave is not)
    out.push({ id: t.id, status: t.status, title: n.title, body: n.lead + String(t.ask || '').slice(0, 120) });
  }
  return out;
}

/** what to tell the member on this read. The first read is the inbox the server kept while the tab was closed (a notification and an inbox
 * entry even after the tab was shut). Later reads are only a change out of working, so a yes you just gave is not announced twice. */
export function tellOf(before, tasks, inbox) {
  if (!before) return (inbox || []).filter((n) => n && n.id && n.title).map((n) => ({ id: n.id, status: n.status, title: n.title, body: String(n.body || '') }));
  return newsOf(before, tasks);
}

/** how many tasks wait for a yes */
export const waiting = (tasks) => (tasks || []).filter((t) => t.status === 'needs_yes').length;

/** the tab's title: the page's own, led by how many wait for a yes, so a tab in the background still shows it */
export const titleFor = (base, tasks) => { const n = waiting(tasks); return (n ? '(' + n + ') ' : '') + base; };

/** ms until the next read: every 2 s while you watch; while the tab is hidden, every 10 s only when a task is still working (a finished
 * thread cannot change on its own, so a hidden tab asks nothing); null = do not read until the tab is shown again */
export function nextReadIn(tasks, hidden) {
  if (!hidden) return 2000;
  return (tasks || []).some((t) => ACTIVE.has(t.status)) ? 10000 : null;
}
