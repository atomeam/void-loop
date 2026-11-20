// The Tower beyond websites (owner, 2026-11-19: "games and everything else in the universe goes on the versus tower", "even a snail",
// "Verse is reality plus"). A target is anything Verse makes or could make: a game, a show, a song, a picture, an app, an assistant, a piece
// of writing, or a real thing (an animal, a place, a law of physics, an idea). Each target is measured against the best in the world on
// real checks, in three groups: beauty (how it looks, sounds and feels), correctness (faithful to reality or to its own rules, and it runs
// at 60 fps with no errors) and the plus (what reality and the best references cannot give: slow time, see inside, play with the variables).
// Verse beats a target only when its own entry outscores the best on every check in all three groups. Targets are for measuring, never for
// copying. This file names no target; the seeds (lib/universe-seeds.js) and the data (tower.universe.json) do, and both answer only the
// owner (lib/owner-gate.js). Pure: no fetch, no DOM, no fs.

export const SIDES = Object.freeze({ beauty: 'Beauty', correct: 'Correctness', plus: 'The plus' });
const C = (id, side, label, how, build) => Object.freeze({ id, side, label, how, build });
// how: 'play' (the play-bot's video and measures), 'vision' (a model looks at real frames), 'measure' (a number from a run), 'facts' (checked against sources), 'probe' (a scripted check of the scene)
export const CHECK = Object.freeze({
  graphics: C('graphics', 'beauty', 'Real-time graphics', 'vision', 'lighting, shadows, materials and post-effects in real-time 3D'),
  polish: C('polish', 'beauty', 'Polish', 'vision', 'finish: spacing, animation, sound and no rough edges'),
  juice: C('juice', 'beauty', 'Game feel', 'play', 'hits, sparks, shake and sound that answer every action'),
  fun: C('fun', 'beauty', 'Fun', 'play', 'a loop people want to repeat'),
  rules: C('rules', 'correct', 'Rules and physics hold', 'play', 'rules and physics that behave the same every time'),
  softlock: C('softlock', 'correct', 'No softlocks', 'play', 'no state where the player is stuck with no way out'),
  controls: C('controls', 'correct', 'Controls respond', 'play', 'every input does what the player expects, at once'),
  fair: C('fair', 'correct', 'Fair difficulty', 'play', 'difficulty that rises fairly and never feels cheap'),
  performance: C('performance', 'correct', '60 fps, no errors', 'measure', 'a steady 60 frames a second with nothing in the error log'),
  accuracy: C('accuracy', 'correct', 'Accurate form', 'probe', 'the model matches the real thing: anatomy, size, structure'),
  behavior: C('behavior', 'correct', 'Accurate behavior', 'probe', 'it moves and acts the way the real thing does'),
  facts: C('facts', 'correct', 'Facts checked', 'facts', 'every fact in the explainer checked against a trusted source'),
  works: C('works', 'correct', 'Everything works', 'probe', 'every feature does its job'),
  results: C('results', 'correct', 'Right results', 'probe', 'answers and outputs are right'),
  story: C('story', 'correct', 'Holds together', 'vision', 'story and logic with no holes or contradictions'),
  theory: C('theory', 'correct', 'In key and in time', 'measure', 'notes and timing that are right'),
  faithful: C('faithful', 'correct', 'Matches what was asked', 'vision', 'the picture is about what it says it is'),
  depth: C('depth', 'plus', 'Depth', 'probe', 'how much there is to find the longer you stay'),
  interactivity: C('interactivity', 'plus', 'Interactivity', 'probe', 'you can touch it, change it and explore it'),
  insight: C('insight', 'plus', 'Insight beyond reality', 'probe', 'slow time, see inside, play with the variables'),
  agency: C('agency', 'plus', 'Does, not just answers', 'probe', 'it takes the action, not only gives the answer'),
});
const SET = (...ids) => Object.freeze(ids);
const REAL = SET('graphics', 'polish', 'accuracy', 'behavior', 'facts', 'performance', 'interactivity', 'insight', 'depth');
export const KINDS = Object.freeze({
  game: { label: 'Game', checks: SET('graphics', 'polish', 'juice', 'fun', 'rules', 'softlock', 'controls', 'fair', 'performance', 'depth', 'insight') },
  video: { label: 'Video and shows', checks: SET('graphics', 'polish', 'story', 'facts', 'performance', 'interactivity', 'insight') },
  music: { label: 'Music', checks: SET('graphics', 'polish', 'theory', 'performance', 'interactivity', 'insight') },
  art: { label: 'Art and images', checks: SET('graphics', 'polish', 'faithful', 'performance', 'interactivity', 'insight') },
  app: { label: 'App or tool', checks: SET('graphics', 'polish', 'works', 'results', 'performance', 'depth', 'insight') },
  assistant: { label: 'AI assistant', checks: SET('graphics', 'polish', 'results', 'facts', 'performance', 'agency', 'insight') },
  writing: { label: 'Writing', checks: SET('graphics', 'polish', 'story', 'facts', 'performance', 'interactivity', 'insight') },
  creature: { label: 'Animal', checks: REAL }, nature: { label: 'Nature', checks: REAL }, object: { label: 'Object', checks: REAL },
  place: { label: 'Place', checks: REAL }, science: { label: 'Science', checks: REAL }, idea: { label: 'Idea', checks: REAL },
});
/** a kind this file does not list is still a kind (the universe has no end): it gets the real-thing checks. */
export const kindOf = (k) => KINDS[k] || { label: String(k || 'Other').replace(/^./, (c) => c.toUpperCase()), checks: REAL };
export const checksOf = (target) => kindOf(target && target.kind).checks.map((id) => CHECK[id]);
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

const num = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : null);
const mark = (t, id) => (t && t.marks && t.marks[id]) || null;
/** one check, read: { id, side, label, verse, best, state: 'won' | 'lost' | 'open' }. A check with no Verse number is open, never won. Pure. */
export function readChecks(target) {
  return checksOf(target).map((c) => {
    const m = mark(target, c.id), verse = num(m && m.verse), best = num(m && m.best) ?? num(target && target.bar) ?? 90;
    return { id: c.id, side: c.side, label: c.label, how: c.how, build: c.build, verse, best, judge: (m && m.judge) || '', at: (m && m.at) || '', state: verse === null ? 'open' : verse > best ? 'won' : 'lost' };
  });
}
/** how close Verse is, 0 to 100: each check counts the share of the best's score Verse reaches (open counts 0). Pure. */
export function closeness(target) {
  const rows = readChecks(target);
  return rows.length ? Math.round(rows.reduce((s, r) => s + (r.verse === null ? 0 : Math.min(1, r.verse / Math.max(1, r.best))), 0) * 100 / rows.length) : 0;
}
/** per side: { side, label, won, of }. Pure. */
export function sidesOf(target) {
  const rows = readChecks(target);
  return Object.keys(SIDES).map((s) => ({ side: s, label: SIDES[s], won: rows.filter((r) => r.side === s && r.state === 'won').length, of: rows.filter((r) => r.side === s).length })).filter((x) => x.of);
}
/** Verse beats a target only when every check, in every side, is won by a measured number. Pure. */
export const beaten = (target) => { const rows = readChecks(target); return rows.length > 0 && rows.every((r) => r.state === 'won'); };
/** what is not won yet, correctness first (an accurate thing comes before a pretty one), then the plus, then beauty. Pure. */
export function gapsOf(target) {
  const rank = { correct: 0, plus: 1, beauty: 2 };
  return readChecks(target).filter((r) => r.state !== 'won').sort((a, b) => rank[a.side] - rank[b.side] || (a.verse ?? -1) - (b.verse ?? -1));
}
/** the card's row for a target. Pure. */
export const rowOf = (t) => ({ id: t.id, site: t.name, kind: t.kind, category: kindOf(t.kind).label, assim: closeness(t), n: readChecks(t).filter((r) => r.state === 'won').length, m: checksOf(t).length, beaten: beaten(t), page: t.entry && t.entry.page || '', universe: true });

/** the climb for sites and targets together: closest first, and inside a band of 4 points the categories take turns, so no one category
 *  floods the order. Items: { id, kind, assim, beaten }. A beaten item leaves. Pure. */
export function climbOrder(items, band = 4) {
  const left = (items || []).filter((i) => i && !i.beaten).sort((a, b) => b.assim - a.assim || String(a.id).localeCompare(String(b.id)));
  const out = [];
  while (left.length) {
    const top = left[0].assim, group = left.filter((i) => top - i.assim <= band);
    const queues = new Map(); for (const g of group) { if (!queues.has(g.kind)) queues.set(g.kind, []); queues.get(g.kind).push(g); }
    const last = out.length ? out[out.length - 1].kind : null;
    const kinds = [...queues.keys()].sort((a, b) => (a === last) - (b === last) || out.filter((o) => o.kind === a).length - out.filter((o) => o.kind === b).length);
    const pick = queues.get(kinds[0])[0];
    out.push(pick); left.splice(left.indexOf(pick), 1);
  }
  return out;
}
/** counts per category for the card: [{ kind, label, n, beaten }]. Pure. */
export function categories(targets) {
  const m = new Map();
  for (const t of targets || []) { const r = m.get(t.kind) || { kind: t.kind, label: kindOf(t.kind).label, n: 0, beaten: 0 }; r.n++; if (beaten(t)) r.beaten++; m.set(t.kind, r); }
  return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}
/** every name a visitor must never see: the names of what each target is measured against (`best.names`). A target's own `name` is the plain
 *  thing Verse makes ("an open-world action game", "a snail") and may be public. Pure. */
export function protectedNames(targets) {
  const out = new Set();
  for (const t of targets || []) {
    for (const n of (t.best && t.best.names) || []) { const s = String(n || '').trim(); if (s.length >= 4) out.add(s); }
  }
  return [...out].sort((a, b) => b.length - a.length);
}
const SAFE_WORDS = /^(?:another|the|a|an|your|this|that)$/i;
/** a scrub for free text: each protected name becomes "another one" (case-insensitive, whole words). Pure. */
export function scrubNames(text, names) {
  if (typeof text !== 'string' || !text || !names || !names.length) return text;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('(?<![\\w])(?:' + names.filter((n) => !SAFE_WORDS.test(n)).map(esc).join('|') + ')(?![\\w])', 'gi'), 'another one');
}
/** stall: no more checks won and no closer for `days` days. Same rule as the sites (#3040). Pure. */
export function stalled(prev, row, today, days = 3) {
  const moved = !prev || row.n > (+prev.n || 0) || row.assim > (+prev.assim || 0);
  const at = moved ? today : (prev && prev.progressAt) || today;
  return { n: row.n, assim: row.assim, progressAt: at, stalled: (Date.parse(today) - Date.parse(at)) / 864e5 >= days };
}
/** the build-list rows for a target's gaps: one row each, in plain words, never naming what it is measured against. Pure. */
export const jobsOf = (t, today) => gapsOf(t).map((g) => ({ id: t.id, aspect: g.id, side: g.side, since: today, job: 'build: ' + t.name + ' (' + kindOf(t.kind).label.toLowerCase() + '): ' + g.build }));
