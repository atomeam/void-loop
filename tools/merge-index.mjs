// The skill index (void-live-deploy/skills/index.json) is one line, so two branches that each add a skill at its end always
// conflict, and a hand merge once kept only one of them (9a48e0a dropped "services": its card never loaded). merge-main.mjs
// settles it with this: main's list as it is, then each name only this branch added, put right after the name before it in
// the branch's own list (so a skill added at the end lands before the entries main added there, and a chain stays in order).
// What it will not guess, it hands back to a person (returns null): the two lists order the names they share differently
// (somebody moved a skill: routing order is first match wins, and a merge must not undo a move). A name main removed
// stays removed; a name only the branch removed stays (a removal is a retirement, written in RETIRED in skills-unlisted.mjs).
export function mergeIndex(base, ours, theirs) {
  const inBase = new Set(base), inTheirs = new Set(theirs), inOurs = new Set(ours);
  const shared = (list, other) => list.filter((n) => other.has(n));
  const a = shared(ours, inTheirs), b = shared(theirs, inOurs);
  if (a.length !== b.length || a.some((n, i) => n !== b[i])) return null;
  const out = theirs.slice();
  ours.forEach((n, i) => {
    if (inTheirs.has(n) || inBase.has(n)) return; // main has it, or main removed it
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const k = out.indexOf(ours[j]); if (k >= 0) { at = k + 1; break; } }
    out.splice(at, 0, n);
  });
  return out.filter((n, i) => out.indexOf(n) === i);
}
