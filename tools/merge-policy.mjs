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

/** Split a unified diff into hunks of added and removed lines. Context and headers are dropped. Pure. */
export function hunksOf(patch) {
  const hunks = [];
  let cur = null;
  for (const line of String(patch || '').split('\n')) {
    if (line.startsWith('@@')) { cur = { added: [], removed: [] }; hunks.push(cur); continue; }
    if (!cur || line.startsWith('\\')) continue;
    if (line.startsWith('+')) cur.added.push(line.slice(1));
    else if (line.startsWith('-')) cur.removed.push(line.slice(1));
  }
  return hunks;
}

const meaningful = (lines) => (lines || []).map((l) => l.trim()).filter(Boolean);

/** Whether `needle` sits together, in order, inside `lines` (blank lines ignored). Pure. */
function sequenceIn(lines, needle) {
  const n = meaningful(needle);
  if (!n.length) return true;
  const h = (lines || []).map((l) => String(l).trim()).filter(Boolean);
  if (n.length > h.length) return false;
  outer: for (let i = 0; i <= h.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (h[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * One file from an older pull request is already on main, or in the newer pull request's patch.
 * A hunk's added lines must sit together in main or in the newer patch. A pure deletion must already
 * be gone from main, or be deleted by the newer patch. A missing patch (binary, or too big to read)
 * is not contained. Pure.
 */
export function fileContained(file, { newerPatch = '', mainText = '' } = {}) {
  if (!file || file.truncated || !file.patch) return false;
  const hunks = hunksOf(file.patch);
  if (!hunks.length) return false;
  const newer = hunksOf(newerPatch);
  const newerAdded = newer.flatMap((h) => h.added);
  const newerRemoved = newer.flatMap((h) => h.removed);
  const mainLines = String(mainText ?? '').split('\n');
  for (const h of hunks) {
    const added = meaningful(h.added);
    const removed = meaningful(h.removed);
    if (added.length) {
      if (!sequenceIn(mainLines, added) && !sequenceIn(newerAdded, added)) return false;
      continue;
    }
    if (removed.length && sequenceIn(mainLines, removed) && !sequenceIn(newerRemoved, removed)) return false;
  }
  return true;
}

/**
 * Whether every change in `older` is already on main or in `newer`. An empty older diff is contained
 * (nothing left to land). `mainText` is the current main file by path. Returns `{ ok, missing, patch }`.
 * The patch is only the files still missing, so a later branch can carry them. Pure.
 */
export function loopCovers(older, newer, mainText = {}) {
  const byPath = new Map((newer || []).map((f) => [f.path, f.patch || '']));
  const missing = [], parts = [];
  for (const f of older || []) {
    if (!f || !f.path) continue;
    if (fileContained(f, { newerPatch: byPath.get(f.path) || '', mainText: mainText[f.path] ?? '' })) continue;
    missing.push(f.path);
    if (f.patch) parts.push('diff --git a/' + f.path + ' b/' + f.path + '\n--- a/' + f.path + '\n+++ b/' + f.path + '\n' + f.patch);
  }
  return { ok: missing.length === 0, missing, patch: parts.join('\n') };
}

/**
 * Older bot pull requests a newer one replaces. lab/sync-* is one queue (the lab import): the newest
 * stays and the rest are closed. loop/* is one queue too, but an older lap is closed only when `covers`
 * says the newer pull request or main already contains its changes. Otherwise it is carried: left open,
 * with the missing paths, so the work is not dropped. With no `covers`, a loop pull request stays open.
 * `covers(old, keep)` returns true, or `{ ok, missing, patch }`. Pure apart from `covers`.
 * @returns {{ close: { number, keep, ref }[], carry: { number, keep, ref, missing, patch }[] }}
 */
export function superseded(prs, covers = null) {
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
  const close = [], carry = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0) || b.number - a.number);
    const keep = list[0];
    for (const old of list.slice(1)) {
      const row = { number: old.number, keep: keep.number, ref: old.head?.ref || '' };
      if (key === 'loop') {
        let verdict = null;
        try { verdict = typeof covers === 'function' ? covers(old, keep) : null; }
        catch (_) { verdict = { ok: false, missing: ['(coverage check failed)'], patch: '' }; }
        const ok = verdict === true || !!(verdict && verdict.ok === true);
        if (!ok) {
          carry.push({ ...row, missing: (verdict && verdict.missing) || ['(not checked)'], patch: (verdict && verdict.patch) || '' });
          continue;
        }
      }
      close.push(row);
    }
  }
  return { close, carry };
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

const sameHead = (a, b) => {
  const x = String(a || '').toLowerCase(), y = String(b || '').toLowerCase();
  return !!(x && y && (x === y || x.startsWith(y) || y.startsWith(x)));
};

/**
 * Whether Verse verify on main blocks automerge. `runs` are verify.yml runs on main:
 * { headSha, status, conclusion, updatedAt, committedAt, covers, url }. `covers` is true when
 * headSha is the current main head or an ancestor of it. The newest finished run that covers
 * this head decides. A failure holds every merge until a newer finished run on this head is
 * green. Cancelled and skipped do not count. A run still going does not clear a red.
 * A green verify on the current head does not hold: Verse merges itself. Pure.
 */
export function mainVerifyHold(runs, mainSha) {
  const finished = (runs || []).filter((r) => r && (r.covers === true || sameHead(r.headSha, mainSha)) && r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
  const when = (r) => Number(r.committedAt) || Date.parse(r.updatedAt || '') || 0;
  finished.sort((a, b) => when(b) - when(a) || String(b.headSha || '').localeCompare(String(a.headSha || '')));
  const latest = finished[0];
  if (!latest) return { hold: false, why: 'no finished Verse verify covers this main head' };
  const sha = String(latest.headSha || mainSha || '');
  if (latest.conclusion === 'success') return { hold: false, why: 'Verse verify is green on ' + sha.slice(0, 9) };
  return {
    hold: true,
    rule: 'main-verify-red',
    file: '.github/workflows/verify.yml',
    sha,
    hint: 'Verse verify is ' + latest.conclusion + ' on main ' + sha.slice(0, 9) + (latest.url ? ' (' + latest.url + ')' : '') + '. Automerge waits until Verse verify is green on the current main head. Fix the red check on main (verify.yml reverts a red suite and files a heal job). Pull requests stay open.',
  };
}
