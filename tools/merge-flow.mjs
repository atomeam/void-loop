// The next step for one pull request. Pure. automerge.mjs and pr-fix.mjs carry it out.
export const FIX_MARK = '<!-- void-fix', RETRY_MS = 30 * 60 * 1000;
export function fixNote(sha, kind) {
  return FIX_MARK + ' sha=' + sha + ' kind=' + kind + ' -->\nVerse is fixing this pull request (' + kind + ') on ' + String(sha || '').slice(0, 7) + '. It merges after that, or when the window ends if a check is still red.';
}
export function fixAge(comments, sha, kind, now = Date.now()) {
  const mark = 'sha=' + sha + ' kind=' + kind;
  const times = (comments || []).filter((c) => c && String(c.body || '').includes(FIX_MARK) && String(c.body).includes(mark)).map((c) => Date.parse(c.created_at || c.createdAt || '') || 0);
  return times.length ? now - Math.max(...times) : null;
}
export function nextStep({ draft = false, fork = false, readiness = '', age = null } = {}) {
  if (draft) return { action: 'skip', why: 'draft' };
  if (fork) return { action: 'skip', why: 'fork' };
  const recent = age != null && age < RETRY_MS;
  if (readiness === 'resolve') {
    if (recent) return { action: 'wait', why: 'the coder is resolving the conflict' };
    return { action: 'fix', kind: 'conflict', why: 'conflicts with main' };
  }
  if (readiness === 'stop') {
    if (age == null) return { action: 'fix', kind: 'red', why: 'a check failed' };
    if (recent) return { action: 'wait', why: 'the coder is fixing the red check' };
    return { action: 'merge', why: 'the coder already tried this head; merge now' };
  }
  if (readiness === 'wait') return { action: 'wait', why: 'a check is still running' };
  if (readiness === 'merge') return { action: 'merge', why: 'ready' };
  return { action: 'wait', why: readiness || 'unknown' };
}

export function fixTask(mode, why) {
  const w = String(why || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const leave = ' Never skip, disable or weaken a test. Leave Tower files unchanged (skills/tower.js, lib/tower*, tools/tower*, docs/TOWER*).';
  if (mode === 'main') return 'Verse verify or the watchdog says main is failing' + (w ? ': ' + w : '') + '. Fix the failing code.' + leave;
  if (mode === 'conflict') return 'This branch conflicts with main' + (w ? ' in ' + w : '') + '. Resolve every conflict, keeping both sides where you can.' + leave;
  return 'A check failed' + (w ? ': ' + w : '') + '. Fix the code that fails.' + leave;
}

export function isTowerPath(file) {
  const f = String(file || '').replace(/\\/g, '/');
  return /(^|\/)skills\/tower\.js$/.test(f)
    || /(^|\/)lib\/tower[^/]*$/.test(f)
    || /(^|\/)tools\/tower[^/]*$/.test(f)
    || /(^|\/)docs\/TOWER[^/]*$/.test(f);
}
