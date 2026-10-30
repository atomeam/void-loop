// The full-cycle loop (owner, 2026-10-22: "nothing is ever finished; everything upgrades infinitely"; "make the loop a full cycle").
// A lap goes around every skill one by one (upgrade each: fix its gaps, add missing basics, apply every discovered rule), then adds
// NEW_PER_LAP new features (from wants, studies, Grok drafts, frontier ideas), then the next lap starts over the whole, now bigger, set.
// No skill is ever marked done: each keeps a rolling next upgrade. Within a lap the order can be weighted (rarely used or high-revenue
// skills first), but every skill is touched once per lap. The state is counts and skill names only, never people. Pure.

export const NEW_PER_LAP = 100;
export const fresh = () => ({ lap: 1, pos: 0, order: [], newThisLap: 0, at: null });

/** the lap's order: every skill once, heavier first (weight: rarely used, earns, stale), then by name. Pure. */
export function orderOf(skills, weights = {}) {
  const names = [...new Set((skills || []).map(String).filter(Boolean))];
  return names.sort((a, b) => (+weights[b] || 0) - (+weights[a] || 0) || a.localeCompare(b));
}

/** a staleness boost: one point per week since a skill was last upgraded (never upgraded counts as a year), capped at 52. Pure. */
export const staleness = (lastAt, now) => { const t = Date.parse(lastAt || ''); return Math.min(52, Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 6048e5)) : 52); };

/** the next step of the loop: { kind: 'upgrade', skill } while the lap has skills left, then { kind: 'new' } until NEW_PER_LAP are added. Pure. */
export function nextStep(state, skills, weights = {}) {
  let s = { ...fresh(), ...(state || {}) };
  if (!s.order.length) s = { ...s, order: orderOf(skills, weights) };
  // a skill added mid-lap joins this lap's tail, so it is still touched this lap
  const have = new Set(s.order), added = orderOf((skills || []).filter((x) => !have.has(String(x))), weights);
  if (added.length) s = { ...s, order: s.order.concat(added) };
  if (s.pos < s.order.length) return { state: s, step: { kind: 'upgrade', skill: s.order[s.pos], lap: s.lap } };
  if (s.newThisLap < NEW_PER_LAP) return { state: s, step: { kind: 'new', n: s.newThisLap + 1 } };
  const next = { ...fresh(), lap: s.lap + 1, order: orderOf(skills, weights), before: s.before || {}, lastLap: { lap: s.lap, items: s.order.length, added: s.newThisLap } }; // the next lap, over the bigger set
  return { state: next, step: { kind: 'upgrade', skill: next.order[0], lap: next.lap } };
}

/** the state after a step was taken (queued): position moves on, so an interruption resumes at the next one. Pure. */
export function advance(state, step, at = null, facts = null) {
  const s = { ...state, at };
  // when the lap began: its first step's time, kept so a card can say what changed since (an older lap has none and says so)
  if (!s.since && at && !(+s.pos > 0) && !(+s.newThisLap > 0)) s.since = at;
  if (step && step.kind === 'upgrade') { s.pos = Math.min(s.order.length, s.pos + 1); if (facts) s.before = { ...(s.before || {}), [step.skill]: facts }; }
  if (step && step.kind === 'new') s.newThisLap = s.newThisLap + 1;
  return s;
}

/** the public line (counts only): "Lap 2: upgraded 140 of 316, 37 of 100 new this lap". Pure. */
export const lapLine = (s) => { const x = { ...fresh(), ...(s || {}) }; return 'Lap ' + x.lap + ': upgraded ' + x.pos + ' of ' + x.order.length + ' items' + ', ' + x.newThisLap + ' of ' + NEW_PER_LAP + ' new this lap'; };
/** the public tracker: counts, the next item and the last few items taken this lap (newest first, so the wants card can say what
 *  changed), and when the lap began when that was kept. Item ids only (they are public in /lap.items.json), never people. Pure. */
export const publicLap = (s, onlySite = null) => { const x = { ...fresh(), ...(s || {}) }; return { ...(onlySite ? { onlySite } : {}), lap: x.lap, upgraded: x.pos, skills: x.order.length, newThisLap: x.newThisLap, newPerLap: NEW_PER_LAP, next: x.order[x.pos] || null, recent: x.order.slice(Math.max(0, x.pos - 3), x.pos).reverse(), line: lapLine(x), at: x.at, ...(x.since ? { since: x.since } : {}), ...(x.lastLap ? { lastLap: x.lastLap } : {}) }; };

/** a want for a step: an upgrade names the skill and its rolling next upgrade (never "done"); a new step asks for one new feature. Pure. */
const factLine = (f) => Object.entries(f || {}).map(([k, v]) => k + ' ' + v).join(', ');
/** what an upgrade of this kind of item means (owner, 2026-10-22: every item measurably better each lap). Pure. */
export function upgradeAsk(id) {
  const [g, name] = String(id).includes(':') ? [String(id).split(':')[0], String(id).slice(String(id).indexOf(':') + 1)] : ['skill', String(id)];
  if (g === 'plan' || g === 'research') return 'one concrete improvement to the ' + name + ' plan (no external actions)';
  if (g === 'archive') return 'bring one more reusable part of the archived ' + name + ' repo into a live skill';
  if (g === 'doc') return 'make the ' + name + ' doc more accurate and complete';
  if (g === 'tool') return 'make the ' + name + ' tool better tested or more useful';
  if (g === 'surface') return 'upgrade the ' + name + ' surface as a whole';
  if (g === 'site') return 'move the ' + name + ' category up (missing to partial, partial to replaced): what a visitor would otherwise leave Verse for, usable by more people than the original';
  if (g === 'loop' && name === 'handoffs') return 'build the top few page-to-page connections in docs/HANDOFF-GAPS.md (one page\'s result opening another, verse_handoff or a link) and play each end to end in tools/handoff-e2e.mjs';
  if (g === 'loop') return 'upgrade the loop itself';
  return 'upgrade the ' + name + ' skill: fix its gaps, add missing basics, make it usable by more people (docs/WIDER-USE.md) and apply every discovered rule';
}
/** before and after one item, counts only: better when a fact rose and none fell. Pure. */
export function compare(before, after) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const rose = keys.filter((k) => (+(after || {})[k] || 0) > (+(before || {})[k] || 0)), fell = keys.filter((k) => (+(after || {})[k] || 0) < (+(before || {})[k] || 0));
  return { better: rose.length > 0 && !fell.length, rose, fell };
}
/** last lap's before against this lap's facts: how many items got measurably better (counts only). Pure. */
export function lapProgress(beforeById, items) {
  let better = 0, same = 0; for (const it of items || []) { const b = (beforeById || {})[it.id]; if (!b) continue; if (compare(b, it.facts).better) better++; else same++; }
  return { better, notYet: same };
}

export function candidateOf(step, nextUpgrade = {}, facts = null) {
  if (!step) return null;
  if (step.kind === 'upgrade') return { kind: 'upgrade', title: (step.lap === 1 ? overhaulAsk(step.skill) : nextUpgrade[step.skill] ? 'Upgrade ' + step.skill + ': ' + nextUpgrade[step.skill] : upgradeAsk(step.skill).replace(/^./, (c) => c.toUpperCase())).slice(0, 150), why: 'its turn in this lap; it must end measurably better than last lap' + (facts ? ' (before: ' + factLine(facts) + ')' : ''), weight: 1000, source: 'lap' };
  return { kind: 'new', title: 'Add new feature ' + step.n + ' of ' + NEW_PER_LAP + ' this lap, from wants, studies, Grok drafts or frontier ideas', why: 'every skill was upgraded this lap; new features come next', weight: 1000, source: 'lap' };
}

// Lap 1 is a full overhaul (owner, 2026-10-22: "everything needs an overhaul again"): each item gets a persona playtest (new player, power
// user, phone, screen reader) and a best-site comparison, then whatever is weak is rebuilt (layout, completeness, clarity, speed, beauty in
// the void look, mobile, no cut-off text). The most used go first: the home page, the ask flow, cards, the book, then the games.
export const MOST_USED = ['surface:home', 'surface:ask', 'surface:cards', 'surface:book', 'surface:games'];
export const overhaulWeights = (ids) => { const w = {}; MOST_USED.forEach((id, i) => { w[id] = 1000 - i; }); (ids || []).filter((id) => /^site:/.test(id)).forEach((id, i) => { w[id] = 500 - i; }); for (const id of ids || []) if (/^skill:/.test(id) && !(id in w)) w[id] = /game|rally|duel|chess|monopoly|card|book/.test(id) ? 10 : 0; return w; };
export const overhaulAsk = (id) => 'Overhaul ' + id + ': persona playtest, best-site check, rebuild what is weak (wider use per docs/WIDER-USE.md, layout, completeness, speed, beauty, no cut-off)';
/** the "only site you need" line, counts only: "Only site you need: 9 replaced, 11 partial, 4 missing of 24 categories". Pure. */
export const onlySiteLine = (c) => c ? 'Only site you need: ' + c.replaced + ' replaced, ' + c.partial + ' partial, ' + c.missing + ' missing of ' + c.categories + ' categories' : '';
