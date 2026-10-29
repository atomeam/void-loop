// council-law: the veto council (owner, 2026-10-18, "operating laws for serious thought with a machine"). Pure: no DOM, no clock, no network.
// Five named reasoners each propose; each holds veto mass (whole numbers that always sum to TOTAL). A low-mass objection only DELAYS
// a proposal (adds a round); an objection from an agent holding BLOCK_SHARE of the mass or more BLOCKS it. Consensus is not a merge:
// one proposal survives whole, and the verdict names who delayed and who blocked every other.
import { rng, clamp } from './field-kit.js';

export const TOTAL = 100, BLOCK_SHARE = 0.3, MAX_ROUNDS = 6, OBJECT_BELOW = 0.45;
export const CRITERIA = ['safety', 'cheapness', 'novelty', 'evidence'];
export const AGENTS = [
  { name: 'Skeptic', w: [0.55, 0.1, 0.0, 0.35], mass: 30 },
  { name: 'Builder', w: [0.1, 0.35, 0.45, 0.1], mass: 20 },
  { name: 'Archivist', w: [0.25, 0.1, 0.05, 0.6], mass: 20 },
  { name: 'Economist', w: [0.2, 0.6, 0.05, 0.15], mass: 15 },
  { name: 'Wanderer', w: [0.05, 0.1, 0.8, 0.05], mass: 15 }
];
export const startMasses = () => Object.fromEntries(AGENTS.map((a) => [a.name, a.mass]));

/** FNV-1a of the question: the seed, so the same question always convenes the same council. */
export function seedOf(text) { let h = 2166136261; for (const c of String(text || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** masses -> whole numbers summing to TOTAL (largest remainder), never negative; a bad input falls back to the start. */
export function normalize(masses) {
  const raw = AGENTS.map((a) => Math.max(0, Number(masses && masses[a.name]) || 0)), sum = raw.reduce((s, v) => s + v, 0);
  if (!(sum > 0)) return startMasses();
  const exact = raw.map((v) => v * TOTAL / sum), out = exact.map(Math.floor);
  let left = TOTAL - out.reduce((s, v) => s + v, 0);
  exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return Object.fromEntries(AGENTS.map((a, i) => [a.name, out[i]]));
}

/** set one agent's mass; conservation: the difference comes from (or goes to) the others in proportion, the total stays TOTAL. */
export function setMass(masses, name, value) {
  const m = normalize(masses); if (!(name in m)) return m;
  const v = clamp(Math.round(Number(value) || 0), 0, TOTAL), others = AGENTS.map((a) => a.name).filter((n) => n !== name), rest = others.reduce((s, n) => s + m[n], 0);
  const next = { ...m, [name]: v };
  for (const n of others) next[n] = rest > 0 ? (m[n] * (TOTAL - v)) / rest : (TOTAL - v) / others.length;
  return normalize(next);
}

const score = (w, props) => w.reduce((s, x, i) => s + x * props[i], 0);

/** the proposals for a question: one per agent, each leaning toward what that agent values, drawn from the question's seed. */
export function propose(question) {
  const r = rng(seedOf(question));
  return AGENTS.map((a) => {
    const props = CRITERIA.map((_, i) => clamp(0.2 + 0.7 * a.w[i] + (r() - 0.5) * 0.5, 0, 1));
    return { by: a.name, props: props.map((p) => Math.round(p * 100) / 100) };
  });
}

/** convene: every agent scores every proposal; below OBJECT_BELOW it objects with its mass. Returns the verdict. */
export function convene(question, masses) {
  const m = normalize(masses), ps = propose(question);
  const proposals = ps.map((p) => {
    const delayedBy = [], blockedBy = [];
    for (const a of AGENTS) {
      if (a.name === p.by) continue;
      const s = score(a.w, p.props); if (s >= OBJECT_BELOW) continue;
      (m[a.name] / TOTAL >= BLOCK_SHARE ? blockedBy : delayedBy).push({ name: a.name, mass: m[a.name], score: Math.round(s * 100) / 100 });
    }
    const support = AGENTS.reduce((s, a) => s + (m[a.name] / TOTAL) * score(a.w, p.props), 0);
    return { ...p, rounds: Math.min(MAX_ROUNDS, 1 + delayedBy.length), delayedBy, blockedBy, support: Math.round(support * 1000) / 1000, status: blockedBy.length ? 'blocked' : delayedBy.length ? 'delayed' : 'clear' };
  });
  const alive = proposals.filter((p) => p.status !== 'blocked').sort((a, b) => a.rounds - b.rounds || b.support - a.support || (a.by < b.by ? -1 : 1));
  const survivor = alive[0] ? alive[0].by : null;
  for (const p of proposals) if (p.by === survivor) p.status = 'survived';
  return { question: String(question || ''), masses: m, proposals, survivor };
}

/** metrics for the kit: entropy of the masses, how delayed the survivor is, share of proposals blocked, where attention sits. */
export function metrics(v) {
  const sh = AGENTS.map((a) => v.masses[a.name] / TOTAL), ent = -sh.reduce((s, p) => (p > 0 ? s + p * Math.log(p) : s), 0) / Math.log(AGENTS.length);
  const surv = v.proposals.find((p) => p.by === v.survivor);
  return { entropy: clamp(ent, 0, 1), activity: surv ? (surv.rounds - 1) / (MAX_ROUNDS - 1) : 1, consensus: v.proposals.filter((p) => p.status === 'blocked').length / v.proposals.length, cx: 0.5, cy: 0.5 };
}
