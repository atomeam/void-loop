// Forge, component C: the tournament. Every candidate is judged on the same stress suite and the same
// regression bank before anything is promoted. Three hard kill switches come first: a candidate that
// breaks one banked ask, needs ten skills before it matches, or spends more than five turns / eight
// reads is dead even if it scores perfectly everywhere else. Among survivors the score is accuracy
// first, then an entropy tax that favours a small generalizing pattern over a regex dump, then routing
// speed and how early in the order the answer was found. Pure: no browser, no network, no writes.

export const LIMITS = { depth: 10, turns: 5, reads: 8 };
export const THRESHOLD = 0.6;

export const wantsOf = (want) => String((want && want.want) || want || '').split('|').map((w) => w.trim().replace(/^skill:/, '')).filter(Boolean);

/**
 * Fitness in [0,1], or exactly 0 when an anti-devolution guardrail trips. Pure.
 * The owner's formula, each raw term normalised to [0,1] so none can dominate:
 *   accuracy * 0.5 + tokenEfficiency * 0.2 + (1000 / speed) * 0.2 + (12 - readDepth) * 0.1
 * tokenEfficiency is 1 minus the entropy tax; speed is latency-derived throughput; readDepth is the
 * average position of the target in the focused routing order (1 = first skill checked).
 */
export function fitness({ accuracy = 0, newlyBroken = 0, addedChars = 0, patterns = 0, latencyMs = 0, depth = 0, turns = 0, reads = 0 } = {}) {
  if (newlyBroken > 0 || depth >= LIMITS.depth || turns > LIMITS.turns || reads > LIMITS.reads) return 0;
  const entropyTax = Math.min(1, addedChars / 1000 + Math.max(0, patterns - 1) * 0.05);
  const tokenEfficiency = 1 - entropyTax;
  const speed = Math.min(1, 1000 / (latencyMs + 1000)); // raw 1000/ms, capped: a 0ms match scores 1
  const readDepth = Math.max(0, (12 - depth) / 12);
  const score = accuracy * 0.5 + tokenEfficiency * 0.2 + speed * 0.2 + readDepth * 0.1;
  return Math.max(0, Math.round(score * 10000) / 10000);
}

/** Fraction of cases the router sends to the skill they name. Pure apart from measuring elapsed time. */
export function evaluate({ router, baseline, cases = [], bank = [], order = [], candidate, target }) {
  const rows = Array.isArray(cases) ? cases : [];
  const pos = new Map(order.map((n, i) => [n, i + 1]));
  const isTarget = (row) => !target || wantsOf(row.want).includes(target);
  const own = rows.filter(isTarget);
  let hit = 0, depthTotal = 0, depthCount = 0, nanos = 0, newlyBroken = 0;
  for (const c of rows) {
    const t0 = performance.now();
    const got = router(c.ask);
    nanos += performance.now() - t0;
    const want = wantsOf(c.want), before = baseline(c.ask);
    if (isTarget(c)) {
      if (got && want.includes(got)) { hit++; depthTotal += pos.get(got) || LIMITS.depth; depthCount++; }
    } else if (before && want.includes(before) && !want.includes(got)) {
      newlyBroken++; // a stress case for a neighbouring skill was stolen by this mutation
    }
  }
  for (const r of (Array.isArray(bank) ? bank : [])) {
    const want = wantsOf(r.want);
    if (!want.includes(baseline(r.ask))) continue; // already wrong before this candidate: not this candidate's fault
    if (!want.includes(router(r.ask))) newlyBroken++;
  }
  const patterns = candidate && Array.isArray(candidate.patterns) ? candidate.patterns.length : 0;
  const depth = depthCount ? Math.round((depthTotal / depthCount) * 100) / 100 : LIMITS.depth;
  const metrics = {
    accuracy: own.length ? Math.round((hit / own.length) * 10000) / 10000 : 0,
    newlyBroken,
    addedChars: candidate && typeof candidate.addedChars === 'number' ? candidate.addedChars : (candidate && Array.isArray(candidate.patterns) ? candidate.patterns.join('').length : 0),
    patterns,
    latencyMs: rows.length ? nanos / rows.length : 0,
    depth,
    turns: candidate && typeof candidate.turns === 'number' ? candidate.turns : 1,
    reads: candidate && typeof candidate.reads === 'number' ? candidate.reads : Math.ceil(depth),
  };
  return { ...metrics, skill: target || (candidate && candidate.skill) || '', strategy: (candidate && candidate.strategy) || 'baseline', fitness: fitness(metrics) };
}

/**
 * Score every mutation on the same cases and bank, best first. `routerFor(candidate)` is supplied by the
 * caller so this module never imports a skill. A champion is returned only above `threshold` with no
 * kill switch tripped; otherwise the list still says what was tried and why it lost.
 */
export function runTournament({ routerFor, baseline, cases = [], bank = [], order = [], target, candidates = [], threshold = THRESHOLD }) {
  const ranked = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const router = routerFor(candidate);
    return { candidate, result: evaluate({ router, baseline, cases, bank, order, candidate, target }) };
  }).sort((a, b) => b.result.fitness - a.result.fitness || a.candidate.strategy.localeCompare(b.candidate.strategy));
  const champion = ranked.length && ranked[0].result.fitness >= threshold ? ranked[0] : null;
  return { ranked, champion };
}
