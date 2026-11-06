// What a skill still lacks to be proven (asked by Verse twice: "Provide a list of the 17 checked and 6 tested skills that can be promoted to
// proven status", and again with 16 and 5). tools/families.mjs rates every skill from evidence alone (its own self-test, the browser suite, real
// asks in the everyday benchmark, a kept live finding) and writes the result into skills/families.json on every deploy; this works out, from the
// same counts and the same rule, the fewest pieces of evidence that would make a checked or tested skill proven, and says them in words. It is
// written into families.json as `needs` beside the rating, so the list follows every build by itself and nothing is claimed: a skill becomes
// proven only when the evidence it names is in the repo.

/** the proven rule of tools/families.mjs ratingOf: three kinds of evidence, or two with at least 3 real asks, or two where one is a fresh live finding. Pure. */
export function isProven(ev) {
  const e = ev || {};
  const kinds = [!!e.suite, e.browser > 0, e.bench > 0, e.live > 0].filter(Boolean).length;
  return kinds >= 3 || (kinds === 2 && (e.bench >= 3 || !!e.liveFresh));
}

const WORD = { suite: 'a self-test (suite() in the skill, or a tools/*.test.mjs that imports it)', again: 'its self-test passing again', browser: 'a browser-suite check named after it' };
/** "a real ask in the benchmark that routes to it", or "2 more real asks ..." when it has some. Pure. */
const asks = (n, had) => (had ? n + ' more real ask' + (n === 1 ? '' : 's') : n === 1 ? 'a real ask' : n + ' real asks') + ' in the benchmark that route' + (n === 1 ? 's' : '') + ' to it';

/** the cheapest ways to proven: [{ add: { suite, browser, bench }, cost, words }], fewest new pieces first (a self-test, a suite check and a
 *  benchmark ask each count one), at most three. [] for a skill already proven. ev: { suite, browser, bench, live, liveFresh, smoke }; smoke:
 *  its daily smoke test is failing, so the self-test it has does not count until it passes again. Pure. */
export function waysToProven(ev) {
  const e = { suite: !!(ev && ev.suite), browser: +(ev && ev.browser) || 0, bench: +(ev && ev.bench) || 0, live: +(ev && ev.live) || 0, liveFresh: !!(ev && ev.liveFresh) };
  const smoked = !!(ev && ev.smoke && (!Array.isArray(ev.smoke) || ev.smoke.length));
  if (isProven(e)) return [];
  const out = [];
  for (const s of e.suite ? [0] : [0, 1]) for (const b of e.browser ? [0] : [0, 1]) for (let q = 0; q <= 3; q++) {
    const next = { ...e, suite: e.suite || !!s, browser: e.browser + b, bench: e.bench + q };
    if (!isProven(next)) continue;
    const parts = [s ? (smoked ? WORD.again : WORD.suite) : '', b ? WORD.browser : '', q ? asks(q, e.bench) : ''].filter(Boolean);
    out.push({ add: { suite: !!s, browser: b, bench: q }, cost: s + b + q, words: parts.join(' and ') });
  }
  // keep only the ways nothing smaller is inside (one benchmark ask beats one ask and a suite check)
  const lean = out.filter((w) => !out.some((o) => o !== w && o.cost < w.cost && o.add.suite <= w.add.suite && o.add.browser <= w.add.browser && o.add.bench <= w.add.bench));
  return lean.sort((a, b) => a.cost - b.cost || a.words.localeCompare(b.words)).slice(0, 3);
}

/** the evidence a families.json row's why names: { suite, browser, bench, live }. The why is written by ratingOf, so its words are fixed. Pure. */
export function evidenceOfWhy(why) {
  const w = String(why || '');
  const n = (re) => { const m = re.exec(w); return m ? +m[1] : 0; };
  return { suite: /\ba self-test\b/.test(w), browser: n(/(\d+) browser-suite mentions?/), bench: n(/(\d+) real asks? in the benchmark/), live: n(/(\d+) live findings?/) };
}

/** what a skill lacks to be proven, in one line: "1 more real ask in the benchmark that routes to it, or a browser-suite check named after it". '' when proven. Pure. */
export const needsWords = (ev) => waysToProven(ev).map((w) => w.words).join(', or ');

/** every checked and tested skill, weakest family first (the lowest share proven), then checked before tested, with what it lacks:
 *  { families: [{ id, name, proven, total, skills: [{ name, tier, why, needs, smoke }] }], checked, tested }. fam: families.json. Pure. */
export function promotable(fam) {
  const fams = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills));
  const rank = { checked: 0, tested: 1, experiment: 2 };
  const families = fams.map((f) => ({
    id: String(f.id || ''), name: String(f.name || f.id || ''), proven: f.skills.filter((s) => s && s.tier === 'proven').length, total: f.skills.length,
    skills: f.skills.filter((s) => s && s.name && s.tier && s.tier !== 'proven').map((s) => ({ name: s.name, tier: s.tier, why: String(s.why || ''),
      needs: typeof s.needs === 'string' && s.needs ? s.needs : needsWords(evidenceOfWhy(s.why)), ...(Array.isArray(s.smoke) && s.smoke.length ? { smoke: String(s.smoke[0]) } : {}) }))
      .sort((a, b) => (rank[a.tier] ?? 3) - (rank[b.tier] ?? 3) || a.name.localeCompare(b.name)),
  })).filter((f) => f.skills.length).sort((a, b) => a.proven / a.total - b.proven / b.total || a.name.localeCompare(b.name));
  const all = families.flatMap((f) => f.skills);
  return { families, checked: all.filter((s) => s.tier === 'checked').length, tested: all.filter((s) => s.tier === 'tested').length, experiment: all.filter((s) => s.tier === 'experiment').length };
}
