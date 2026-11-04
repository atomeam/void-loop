// Who merges by itself, which bot pull request an newer one replaces, and what to do with one that has
// been open for hours (tools/automerge.mjs). Pure: the workflow passes in the pull request GitHub returned.

export const AUTO_LABEL = 'automerge';
const BOTS = new Set(['atomeam', 'github-actions[bot]', 'app/github-actions']);

/** a login that opens Verse's own pull requests (the owner, or the Actions app under either of its logins). Pure. */
export const isBot = (login) => BOTS.has(login);

/**
 * A pull request from this repository that should arm GitHub auto-merge: it carries the automerge label,
 * or the owner or the Actions app opened it on helper/*, loop/* or lab/*. Forks never qualify. Pure.
 */
export function eligible(pr, repo) {
  if (!pr || pr.head?.repo?.full_name && pr.head.repo.full_name !== repo) return false;
  if ((pr.labels || []).some((l) => l.name === AUTO_LABEL)) return true;
  const ref = pr.head?.ref || '';
  return isBot(pr.user?.login) && /^(helper|loop|lab)\//.test(ref);
}

/**
 * Older bot pull requests a newer one replaces. lab/sync-* is one queue (the lab import). loop/* is one
 * queue (the conductor's lap). The newest stays; the rest are closed. Pure.
 */
export function superseded(prs) {
  const groups = new Map();
  for (const p of prs || []) {
    if (!p || p.state && p.state !== 'open') continue;
    if (!isBot(p.user?.login)) continue;
    const ref = p.head?.ref || '';
    const key = /^lab\/sync-/.test(ref) ? 'lab/sync' : /^loop\//.test(ref) ? 'loop' : '';
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(p);
    groups.set(key, list);
  }
  const close = [];
  for (const list of groups.values()) {
    list.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0) || b.number - a.number);
    for (const old of list.slice(1)) close.push({ number: old.number, keep: list[0].number, ref: old.head?.ref || '' });
  }
  return close;
}

const GREEN = new Set(['success', 'skipped', 'neutral']);

/**
 * A pull request open for `hours` or more. `merge` when every finished check is green, `update` when it
 * is merely behind main, `rebase` when it conflicts, `comment` when something failed or nothing ran,
 * `wait` while a check is still going, `young` before the hour mark. Pure.
 */
export function stuckDecision(pr, checks, now = Date.now(), hours = 6) {
  const opened = Date.parse(pr?.created_at || '');
  if (!Number.isFinite(opened) || (now - opened) / 36e5 < hours) return { action: 'young' };
  if (pr.mergeable_state === 'behind') return { action: 'update', why: 'behind main' };
  if (pr.mergeable_state === 'dirty') return { action: 'rebase', why: 'conflicts with main' };
  const runs = checks || [];
  const bad = runs.find((c) => c && c.status === 'completed' && !GREEN.has(c.conclusion) && c.conclusion !== 'cancelled');
  if (bad) return { action: 'comment', why: bad.name + ' ' + bad.conclusion };
  const pending = runs.find((c) => c && c.status !== 'completed');
  if (pending) return { action: 'wait', why: pending.name + ' still running' };
  if (!runs.length) return { action: 'comment', why: 'no checks have reported on this head' };
  return { action: 'merge', why: 'checks are green' };
}
