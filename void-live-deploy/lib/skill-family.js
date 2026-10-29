// One family skill from several member skills (convergence: "existing skills should merge", owner 2026-10-15).
// The family takes one place in skills/index.json and asks its members in their old order, so an ask lands exactly where it did
// when they sat side by side. Each member keeps its file (its tests and imports still work), its examples and its near misses;
// part(lower, text) names the member that answers, so the page's log, misses and the benchmark still read skill:<member>.
export function family(name, members, extra = {}) {
  const pick = (lower, text) => members.find((m) => m.match(lower, text)) || null;
  const stageKinds = Object.assign({}, ...members.map((m) => m.stageKinds || {}));
  const decorators = members.map((m) => m.decorate).filter((f) => typeof f === 'function');
  const f = {
    name,
    family: true,
    parts: members.map((m) => m.name),
    members,
    examples: members.flatMap((m) => m.examples || []),
    // a member's near miss that a sibling answers stays inside the family (it did before the merge); the rest must not land here
    nearMisses: members.flatMap((m) => m.nearMisses || []).filter((a) => !pick(a.toLowerCase(), a)),
    match: (lower, text) => !!pick(lower, text),
    member: pick,
    part: (lower, text) => { const m = pick(lower, text); return m ? m.name : null; },
    run: (text, api) => { const t = String(text || ''), m = pick(t.toLowerCase(), t); return m ? m.run(text, api) : 'none'; },
    ...extra,
  };
  if (Object.keys(stageKinds).length) f.stageKinds = stageKinds;
  if (decorators.length) f.decorate = (...a) => { for (const d of decorators) d(...a); };
  return f;
}
