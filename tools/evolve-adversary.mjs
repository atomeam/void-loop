// Forge, component A: the adversarial generator. Turns a skill's own example asks into harder,
// near-miss stress cases without a model, a network or a secret. Deterministic: the same skills always
// produce the same suite, so a tournament result can be reproduced and a regression bank can be trusted.
// Cases are plain { ask, want, kind } rows in tools/bench.json's shape; `want` is the skill that ought
// to answer. A case that the current page does not answer yet is a stress case, not a failure of this file.
//
// The seam for an LLM generator is `synthesize` in generateStress: an owner-only lane can pass extra
// phrases there later; everything downstream only sees rows, so the tournament need not change.

export const HOW = new Set(('a an the of to for me my mine your our us we i you it its this that these those is are was were be am do does did '
  + 'can could would should will just please and or with in on at by from as into about up out off now some any one new show tell give '
  + 'make draw create put add open start play get find let what whats how why when where which want need like turn set see look run build '
  + 'bring keep use say ask today verse void v01d').split(' '));

/** Content words of an ask: lower case, no small words, no numbers, no punctuation. Pure. */
export function words(ask) {
  return [...new Set(String(ask || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !HOW.has(w) && !/^\d+$/.test(w)))];
}

/** How many content words two asks share. Pure. */
export function overlap(a, b) {
  const x = new Set(words(a)), y = new Set(words(b));
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return n;
}

/** The skills whose examples sit closest to this skill, worst (most confusable) first. Pure. */
export function neighbors(name, skills, limit = 3) {
  const mine = (skills.find((s) => s.name === name) || {}).examples || [];
  return skills
    .filter((s) => s.name !== name && (s.examples || []).length)
    .map((s) => ({ name: s.name, examples: s.examples, score: s.examples.reduce((n, e) => n + Math.max(0, ...mine.map((m) => overlap(m, e))), 0) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, limit | 0 || 3));
}

const FILLERS = ['please ', 'can you ', 'could you ', 'just '];
const COLLOQUIAL = {
  throw: ['toss', 'chuck', 'fling'], toss: ['throw', 'chuck', 'fling'], show: ['display', 'bring up'],
  make: ['build', 'put together'], find: ['look up', 'locate'], tell: ['say', 'explain'],
  calculate: ['work out', 'figure out'], stop: ['end', 'cut'], start: ['kick off', 'begin'],
};
const ENDINGS = ['?', '!'];

const add = (out, seen, ask, want, kind) => {
  const a = String(ask || '').replace(/\s+/g, ' ').trim();
  if (a.length < 3 || a.length > 140 || seen.has(a.toLowerCase())) return;
  seen.add(a.toLowerCase());
  out.push({ ask: a, want: 'skill:' + want, kind });
};

/**
 * Stress cases for one skill. Five families: politeness fillers, colloquial verbs, punctuation,
 * boundary collisions (a content word borrowed from a neighbor) and multi-intent asks (a neighbor's
 * ask tacked on). Every case keeps this skill as `want`, so the tournament measures whether a mutation
 * steals it rather than merely adding phrases. Pure.
 */
export function generateStress({ name, examples = [], neighbors: near = [], perExample = 4, cap = 24, synthesize = [] } = {}) {
  const out = [], seen = new Set();
  const neighborAsks = near.flatMap((s) => (s.examples || []).slice(0, 2).map((e) => ({ name: s.name, ask: e })));
  const own = new Set(examples.flatMap((e) => words(e)));
  const neighborWords = near.flatMap((s) => (s.examples || []).slice(0, 2).flatMap((e) => words(e).filter((w) => !own.has(w))));
  for (const raw of examples) {
    const ask = String(raw || '').trim();
    if (!ask) continue;
    const base = ask.replace(/[?!.]+$/, '');
    for (const f of FILLERS.slice(0, perExample)) add(out, seen, f + base.toLowerCase(), name, 'filler');
    const first = /^[a-z]+/i.exec(base);
    const swaps = first && COLLOQUIAL[first[0].toLowerCase()] ? COLLOQUIAL[first[0].toLowerCase()] : [];
    for (const swap of swaps.slice(0, perExample - 1)) add(out, seen, base.replace(/^[a-z]+/i, swap), name, 'colloquial');
    for (const end of ENDINGS.slice(0, Math.max(0, perExample - 2))) add(out, seen, base + end, name, 'punctuation');
    const mine = words(base);
    for (const [i, w] of neighborWords.slice(0, perExample).entries()) {
      if (!mine.length || own.has(w)) continue;
      const alt = [...mine]; alt[i % alt.length] = w;
      add(out, seen, alt.join(' '), name, 'boundary');
    }
    for (const n of neighborAsks.slice(0, Math.max(0, perExample - 2))) {
      const tail = words(n.ask).slice(0, 3).join(' ');
      if (tail) add(out, seen, base.toLowerCase() + ' and ' + tail, name, 'multi-intent');
    }
  }
  for (const extra of synthesize) add(out, seen, extra, name, 'synthesized');
  return out.sort((a, b) => a.ask.localeCompare(b.ask)).slice(0, Math.max(1, cap | 0 || 24));
}

/** One corpus for several skills: every skill's stress cases, with each case naming its own `want`. Pure. */
export function generateCorpus(skills, opts = {}) {
  const list = Array.isArray(skills) ? skills : [];
  return [...new Map(list.flatMap((s) => generateStress({
    name: s.name,
    examples: s.examples || [],
    neighbors: neighbors(s.name, list, opts.neighborLimit || 2),
    ...opts,
  })).map((c) => [c.ask.toLowerCase(), c])).values()].sort((a, b) => a.ask.localeCompare(b.ask));
}
