// lib/prizes.js: the maths behind /prizes/. A weighted prize wheel's real odds, the expected value of every slice, how often the top prize
// turns up in N spins, a 1,000-spin check against the theory (seedable, so a test can pin it), and how long a reward drip takes to reach a
// cashout. Pure and offline: nothing here pays, collects or sends anything; it only does the arithmetic.

export const NEVER = 'Never reaches cashout ($0 expected value per spin)';
const MAX_SLICES = 200;

const num = (s) => { const t = String(s == null ? '' : s).replace(/[$,\s]/g, ''); if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?$/i.test(t)) return NaN; return Number(t); };
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const finite = (v, d) => (Number.isFinite(v) ? v : d);

/** One line: "Label:value:weight", "Label:value", "Label *3" / "Label x3" (a wheel weight, value 1) or a plain label (value 1, weight 1). */
export function parseSlice(line) {
  let text = clean(line); if (!text) return null;
  let value = 1, weight = 1;
  const parts = text.split(':');
  if (parts.length >= 3 && Number.isFinite(num(parts[parts.length - 1])) && Number.isFinite(num(parts[parts.length - 2]))) {
    weight = num(parts.pop()); value = num(parts.pop()); text = parts.join(':');
  } else if (parts.length >= 2 && Number.isFinite(num(parts[parts.length - 1]))) {
    value = num(parts.pop()); text = parts.join(':');
  } else {
    const w = /^(.*?)\s*(?:\*\s*|\s[x×]\s?)(\d{1,4})$/i.exec(text);
    if (w && w[1].trim()) { text = w[1]; weight = Number(w[2]); }
  }
  const label = clean(text); if (!label) return null;
  return { label, value: finite(value, 1), weight: Math.min(1e9, Math.max(0, finite(weight, 1))) };
}

/** The slices in a text: one per line (or comma-separated when there is a single line), blanks dropped, at most 200. */
export function parseSlices(text) {
  const s = String(text == null ? '' : text);
  const lines = /\n/.test(s) ? s.split(/\r?\n/) : s.split(',');
  return lines.map(parseSlice).filter(Boolean).slice(0, MAX_SLICES);
}
export const sliceText = (x) => x.label + ':' + x.value + ':' + x.weight;
export const slicesText = (slices) => slices.map(sliceText).join('\n');
/** the bare labels, the :value:weight taken off (what the name wheel and the tournament roster want) */
export const labelsOf = (slices) => slices.map((x) => x.label);

/** every slice's chance and share of the expected value; the top prize (highest value; the first on a tie). */
export function odds(slices, cost = 0) {
  const total = slices.reduce((a, x) => a + x.weight, 0);
  const rows = slices.map((x) => { const p = total > 0 ? x.weight / total : 0; return { ...x, p, ev: p * x.value }; });
  const ev = rows.reduce((a, r) => a + r.ev, 0);
  let top = -1; rows.forEach((r, i) => { if (r.p > 0 && (top < 0 || r.value > rows[top].value)) top = i; });
  const c = Math.max(0, finite(Number(cost), 0));
  return { rows, total, ev, cost: c, net: ev - c, top, topP: top >= 0 ? rows[top].p : 0 };
}

/** P(at least one hit in n tries) = 1 - (1 - p)^n */
export function atLeastOnce(p, n) {
  p = Math.min(1, Math.max(0, finite(p, 0))); n = Math.max(0, Math.floor(finite(n, 0)));
  if (p === 0 || n === 0) return 0; if (p === 1) return 1;
  return -Math.expm1(n * Math.log1p(-p));
}
/** spins needed for a given chance (default even odds) of at least one hit; Infinity when p is 0 */
export function spinsFor(p, chance = 0.5) {
  if (!(p > 0)) return Infinity; if (p >= 1) return 1;
  return Math.max(1, Math.ceil(Math.log1p(-chance) / Math.log1p(-p)));
}

/** the slice a number u in [0, 1) lands on, by weight */
export function pick(slices, u) {
  const total = slices.reduce((a, x) => a + x.weight, 0); if (!(total > 0)) return -1;
  let at = Math.min(Math.max(u, 0), 1 - 1e-12) * total;
  for (let i = 0; i < slices.length; i++) { if (at < slices[i].weight) return i; at -= slices[i].weight; }
  for (let i = slices.length - 1; i >= 0; i--) if (slices[i].weight > 0) return i;
  return -1;
}

/** a secure number in [0, 1) (the live spins) */
export function secureRandom() { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; }
/** a seeded generator (mulberry32 over a string hash), for a simulation anyone can repeat with ?seed= */
export function seeded(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.codePointAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const cleanSeed = (s) => String(s == null ? '' : s).replace(/[^\w.-]/g, '').slice(0, 40);

/** n spins: each slice's count against what the odds expect, the average won per spin against the EV, and a chi-square for the fit */
export function simulate(slices, n, rand) {
  const o = odds(slices); n = Math.max(0, Math.min(1e6, Math.floor(finite(n, 0))));
  const counts = new Array(slices.length).fill(0); let won = 0;
  for (let k = 0; k < n; k++) { const i = pick(slices, rand()); if (i >= 0) { counts[i]++; won += slices[i].value; } }
  let chi2 = 0;
  const rows = o.rows.map((r, i) => { const expected = r.p * n; if (expected > 0) chi2 += (counts[i] - expected) ** 2 / expected; return { label: r.label, p: r.p, expected, got: counts[i], share: n ? counts[i] / n : 0 }; });
  return { n, rows, counts, mean: n ? won / n : 0, ev: o.ev, chi2, df: Math.max(0, o.rows.filter((r) => r.p > 0).length - 1) };
}

/** a reward drip: one spin every cooldown minutes, each worth ev on average (plus referral% of what each referral earns), until cashout. */
export function drip({ ev, cooldownMin, cashout, referralPct = 0, referrals = 0 }) {
  const cd = finite(Number(cooldownMin), 0), min = Math.max(0, finite(Number(cashout), 0));
  const boost = 1 + Math.max(0, finite(Number(referralPct), 0)) / 100 * Math.max(0, Math.floor(finite(Number(referrals), 0)));
  const per = finite(Number(ev), 0) * boost;
  if (!(per > 0) || !(cd > 0)) return { never: true, text: NEVER, perSpin: Math.max(0, per) };
  const spins = min > 0 ? Math.ceil(min / per - 1e-9) : 0, minutes = spins * cd;
  return { never: false, perSpin: per, spins, minutes, hours: minutes / 60, days: minutes / 1440 };
}

/** the starting setups; raffle is the default */
export const PRESETS = Object.freeze({
  raffle: { name: 'Raffle or giveaway', slices: 'Grand prize:500:1\nGift card:50:10\nTote bag:10:39\nThanks for entering:0:950', cost: 2, n: 100, cd: 1440, min: 50, ref: 0, refs: 0 },
  punch: { name: 'Loyalty punch card', slices: 'Free drink:5:1\nStamp:0:9', cost: 0, n: 30, cd: 1440, min: 5, ref: 0, refs: 0 },
  loot: { name: 'Loot drop table', slices: 'Legendary:1000:1\nEpic:250:4\nRare:50:15\nCommon:5:80', cost: 0, n: 100, cd: 30, min: 1000, ref: 0, refs: 0 },
  faucet: { name: 'Reward faucet audit', slices: 'Top prize:1:1\nBig:0.1:9\nSmall:0.01:90\nDust:0.001:900', cost: 0, n: 1000, cd: 60, min: 5, ref: 10, refs: 0 },
});
export const DEFAULT_PRESET = 'raffle';

const nIn = (v, d, lo, hi) => { const x = num(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
/** the page state from a query string: a preset (raffle by default) with any of s, cost, n, cd, min, ref, refs, seed laid over it */
export function stateOf(search) {
  const q = new URLSearchParams(search || '');
  const preset = PRESETS[q.get('preset')] ? q.get('preset') : DEFAULT_PRESET, P = PRESETS[preset];
  const s = q.has('s') ? String(q.get('s')).slice(0, 20000) : P.slices;
  return {
    preset, slices: s, cost: nIn(q.get('cost'), P.cost, 0, 1e9), n: Math.round(nIn(q.get('n'), P.n, 1, 1e7)),
    cd: nIn(q.get('cd'), P.cd, -1e6, 1e7), min: nIn(q.get('min'), P.min, 0, 1e12), ref: nIn(q.get('ref'), P.ref, 0, 1000), refs: Math.round(nIn(q.get('refs'), P.refs, 0, 1e6)),
    seed: cleanSeed(q.get('seed')),
  };
}
/** the query string for a state (only what differs from its preset, plus the preset) */
export function queryOf(st) {
  const P = PRESETS[st.preset] || PRESETS[DEFAULT_PRESET], q = new URLSearchParams();
  if (st.preset && st.preset !== DEFAULT_PRESET) q.set('preset', st.preset);
  if (st.slices.trim() !== P.slices) q.set('s', st.slices.trim());
  for (const k of ['cost', 'n', 'cd', 'min', 'ref', 'refs']) if (Number(st[k]) !== P[k]) q.set(k, String(st[k]));
  if (st.seed) q.set('seed', st.seed);
  return q.toString();
}

/** a number for people: grouped thousands, enough decimals for a fraction of a cent */
export function fmt(v, digits) {
  if (!Number.isFinite(v)) return '-';
  const a = Math.abs(v), d = digits != null ? digits : a === 0 ? 0 : a >= 100 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
}
export const money = (v) => (v < 0 ? '-$' : '$') + fmt(Math.abs(v));
export function pct(p) {
  if (!Number.isFinite(p)) return '-'; const x = p * 100;
  return (x === 0 ? '0' : x >= 99.995 && x < 100 ? '99.99' : x < 0.01 ? x.toPrecision(2) : fmt(x, x >= 10 ? 1 : 2)) + '%';
}

/** the odds table as CSV (a quote-safe cell each) */
export function csvOf(slices, cost, n) {
  const o = odds(slices, cost), q = (s) => { const t = String(s); return /[",\n]/.test(t) || /^[=+\-@]/.test(t) ? '"' + t.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""') + '"' : t; };
  const lines = ['slice,value,weight,chance,ev_per_spin,at_least_once_in_' + n];
  for (const r of o.rows) lines.push([q(r.label), r.value, r.weight, r.p.toFixed(8), r.ev.toFixed(8), atLeastOnce(r.p, n).toFixed(8)].join(','));
  lines.push(['total', '', o.total, '1', o.ev.toFixed(8), ''].join(','));
  return lines.join('\n') + '\n';
}
