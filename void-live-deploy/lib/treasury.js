// Verse's treasury (owner, 2026-11-03: "so verse is to be able to reallocate its own profits in the most efficient and helpful
// way, i get a cut of coarse"; asked what the cut is: "Let Verse decide"). Pure functions only; functions/api/treasury.js runs them.
//
// The only source of funds is realized Gumroad revenue: the recorded pings in D1 void_sales (and, when GUMROAD_ACCESS_TOKEN is set,
// sales read back from Gumroad's API into the same table, deduplicated by sale id). Realized = each sale's price minus Gumroad's fee
// (gumroad.com/help/article/66-gumroads-fees: 10% + 50c, plus 2.9% + 30c card processing on direct sales; 30% flat on Discover
// sales), minus refunded and lost-dispute sales and the processing part Gumroad keeps on them. Test purchases are never money.
// Nothing is borrowed, assumed or forecast into the balance: a bucket only ever holds money that already came in.
//
// Order of the split, every time new realized money appears (policy in /treasury/policy.json, Verse's own reasons beside each number):
//   1. Atom's owner cut, first.  2. the giving pot: a tenth of what is left, pledged to the causes on /creed/give/ (owner, 2026-11-06:
//   "verse should become a religion and a charity").  3. the reserve.  4. the reinvestment buckets, weighted by expected ROI.
// A gift leaves the giving pot only when Atom sends it to a charity's own donation page and it is recorded ('given'); Verse sends no money.
// Money going back out (a refund after it was split) comes out of the reserve first, then the buckets, then the owner cut.
// A bucket's money becomes a spend entry only when a ranked candidate fits inside it. Verse holds no card and no login: every
// spend is logged as 'ready to execute' with the credential it needs, and is marked executed only when a person or a tool reports it.

export const BUCKETS = ['infrastructure', 'tools', 'growth', 'bounties'];
export const POTS = ['owner', 'giving', 'reserve', ...BUCKETS];

const int = (n) => Math.round(Number(n) || 0);
const bool = (v) => String(v) === 'true';

// x-www-form-urlencoded with bracketed keys -> nested object (the same reading as lib/earnings.js parsePing)
export function readPing(text) {
  const o = {};
  for (const [k, v] of new URLSearchParams(String(text || ''))) {
    const m = /^([a-z_]+)\[([^\]]*)\]$/i.exec(k);
    if (m) { o[m[1]] = o[m[1]] && typeof o[m[1]] === 'object' ? o[m[1]] : {}; o[m[1]][m[2]] = v; } else o[k] = v;
  }
  return o;
}

export const GUMROAD_FEE = { pct: 0.10, fixed_cents: 50, processing_pct: 0.029, processing_fixed_cents: 30, discover_pct: 0.30,
  source: 'https://gumroad.com/help/article/66-gumroads-fees' };

/** Gumroad's fee on one sale, in cents. Pure. */
export function feeCents(price, { discover = false } = {}, fee = GUMROAD_FEE) {
  const p = Math.max(0, int(price));
  if (!p) return 0;
  if (discover) return Math.round(p * fee.discover_pct);
  return Math.min(p, Math.round(p * (fee.pct + fee.processing_pct)) + fee.fixed_cents + fee.processing_fixed_cents);
}

/** rows of void_sales [{ resource, sale_id, raw }] -> realized revenue in cents. Each sale counted once (pings and API rows share
 *  a sale id). Pure. */
export function realized(rows, fee = GUMROAD_FEE) {
  const sales = new Map(), refunded = new Set(), disputed = new Set(), won = new Set();
  for (const r of rows || []) {
    const p = readPing(r.raw);
    if (bool(p.test)) continue;
    const id = r.sale_id || p.sale_id;
    if (!id) continue;
    const res = String(r.resource || p.resource_name || 'sale');
    if (res === 'sale') {
      if (!sales.has(id)) sales.set(id, { cents: Math.max(0, int(p.price)), discover: bool(p.discover_fee_charged) });
      if (bool(p.refunded)) refunded.add(id);
      if (bool(p.disputed) && !bool(p.dispute_won)) disputed.add(id);
      if (bool(p.dispute_won)) won.add(id);
    } else if (res === 'refund') refunded.add(id);
    else if (res === 'dispute') disputed.add(id);
    else if (res === 'dispute_won') won.add(id);
  }
  let gross = 0, fees = 0, back = 0, n = 0;
  for (const [id, s] of sales) {
    n++;
    gross += s.cents;
    const lost = refunded.has(id) || (disputed.has(id) && !won.has(id));
    if (lost) { back += s.cents; fees += s.discover ? 0 : Math.round(s.cents * fee.processing_pct) + fee.processing_fixed_cents; }
    else fees += feeCents(s.cents, s);
  }
  // a lost sale: its price comes back out, and the card processing on it is kept by Gumroad (its own 10% + 50c is returned)
  const realized_cents = gross - fees - back;
  return { sales: n, gross_cents: gross, fee_cents: fees, refunded_cents: back, realized_cents };
}

/** ledger rows [{ kind, bucket, cents }] -> what each pot holds now and what was split so far. Pure.
 *  kinds: 'alloc' (+ into a pot, - out for a refund), 'move' (between buckets at a review), 'spend' (out of a bucket, when queued),
 *  'cancel' (a queued spend dropped: money back to its bucket), 'paid' (owner cut handed over: out of the owner pot). */
export function balances(rows) {
  const pot = Object.fromEntries(POTS.map((k) => [k, 0]));
  let split = 0, committed = 0;
  for (const r of rows || []) {
    const c = int(r.cents), b = r.bucket;
    if (!(b in pot)) continue;
    if (r.kind === 'alloc') { pot[b] += c; split += c; }
    else if (r.kind === 'move') pot[b] += c;
    else if (r.kind === 'spend') { pot[b] -= c; committed += c; }
    else if (r.kind === 'cancel') { pot[b] += c; committed -= c; }
    else if (r.kind === 'paid' || r.kind === 'given') pot[b] -= c;
  }
  return { pots: pot, split_cents: split, committed_cents: committed };
}

/** Each bucket's weight from expected ROI. candidates: reinvest candidates (impact, confidence, bucket); learned: { bucket: mult }
 *  from weekly reviews; priorities: [{ bucket, score 0..1 }] from Verse's priorities engine when it publishes one. Pure. */
export function bucketWeights(policy, { candidates = [], learned = {}, priorities = [] } = {}) {
  const b = policy.buckets || {}, floor = b.min_share ?? 0.1, cap = b.max_share ?? 0.5;
  const score = {};
  for (const k of BUCKETS) {
    const own = candidates.filter((c) => c.bucket === k && !c.blocked && int(c.cost_cents) > 0);
    const best = own.reduce((m, c) => Math.max(m, (Number(c.impact) || 0) * (c.confidence == null ? 0.5 : Number(c.confidence))), 0);
    const prior = (b.prior || {})[k] ?? 0.3;
    const pr = priorities.filter((p) => p.bucket === k).reduce((m, p) => Math.max(m, Number(p.score) || 0), 0);
    score[k] = Math.max(best, prior) * (learned[k] == null ? 1 : Number(learned[k])) * (1 + pr);
  }
  return clampShares(score, floor, cap);
}

/** scores -> shares that sum to 1, each between floor and cap. Pure. */
export function clampShares(score, floor = 0.1, cap = 0.5) {
  const keys = Object.keys(score);
  let w = Object.fromEntries(keys.map((k) => [k, Math.max(0, score[k])]));
  const tot = keys.reduce((n, k) => n + w[k], 0) || 1;
  w = Object.fromEntries(keys.map((k) => [k, w[k] / tot]));
  for (let i = 0; i < 20; i++) {
    let fixed = 0, freeTot = 0;
    const pinned = {};
    for (const k of keys) { if (w[k] < floor) pinned[k] = floor; else if (w[k] > cap) pinned[k] = cap; }
    for (const k of keys) { if (k in pinned) fixed += pinned[k]; else freeTot += w[k]; }
    if (!Object.keys(pinned).length) break;
    const rest = Math.max(0, 1 - fixed);
    const next = {};
    for (const k of keys) next[k] = k in pinned ? pinned[k] : (freeTot ? (w[k] / freeTot) * rest : rest / (keys.length - Object.keys(pinned).length || 1));
    const same = keys.every((k) => Math.abs(next[k] - w[k]) < 1e-9);
    w = next;
    if (same) break;
  }
  return Object.fromEntries(keys.map((k) => [k, +w[k].toFixed(4)]));
}

/** The reserve's share right now: the full share until the reserve reaches its target, the maintenance share after. Pure. */
export function reserveShare(policy, reserveCents) {
  const r = policy.reserve || {};
  return reserveCents >= int(r.target_cents) ? (r.share_after_target ?? 0.05) : (r.share ?? 0.2);
}

/** Split new realized money (cents, may be negative after a refund) into allocation rows. Pure.
 *  Positive: owner cut first, then the reserve's share of what is left, then the buckets by weight; rounding remainder to the reserve.
 *  Negative: out of the reserve first, then the buckets (largest first), then the owner pot; never below zero in any pot. */
export function split(cents, policy, { pots = {}, weights = {} } = {}) {
  const n = int(cents);
  if (!n) return [];
  const out = [];
  if (n > 0) {
    const owner = Math.floor(n * (policy.owner_cut && policy.owner_cut.share || 0));
    const afterCut = n - owner;
    const giving = Math.floor(afterCut * Math.max(0, Math.min(0.5, Number(policy.giving && policy.giving.share) || 0)));
    const reserve = Math.floor((afterCut - giving) * reserveShare(policy, int(pots.reserve)));
    let left = afterCut - giving - reserve, given = 0;
    const parts = BUCKETS.map((k) => { const c = Math.floor(left * (weights[k] || 0)); given += c; return [k, c]; });
    out.push({ bucket: 'owner', cents: owner, purpose: 'Atom\'s owner cut (' + Math.round((policy.owner_cut.share || 0) * 100) + '%), paid first' });
    out.push({ bucket: 'giving', cents: giving, purpose: 'giving: ' + Math.round((policy.giving && policy.giving.share || 0) * 100) + '% of what is left, pledged to the causes on /creed/give/' });
    out.push({ bucket: 'reserve', cents: reserve + (left - given), purpose: 'reserve: kept, never spent' });
    for (const [k, c] of parts) out.push({ bucket: k, cents: c, purpose: 'reinvestment: ' + k + ' (' + Math.round((weights[k] || 0) * 100) + '% of what is left)' });
    return out.filter((r) => r.cents);
  }
  let owe = -n;
  const order = ['reserve', ...BUCKETS.slice().sort((a, b) => int(pots[b]) - int(pots[a])), 'giving', 'owner'];
  for (const k of order) {
    if (!owe) break;
    const take = Math.min(owe, Math.max(0, int(pots[k])));
    if (take) { out.push({ bucket: k, cents: -take, purpose: 'a refund or lost dispute: money back out (' + k + ')' }); owe -= take; }
  }
  if (owe) out.push({ bucket: 'reserve', cents: -owe, purpose: 'a refund larger than what was left: the reserve goes negative until new money covers it' });
  return out;
}

/** Spend entries for buckets that can now afford a ranked candidate. Each candidate is queued once while open. Pure.
 *  -> [{ id, bucket, cents, purpose, expected, needs, status: 'ready to execute' }] */
export function queueSpends(pots, candidates, { queued = [], credentials = {}, learned = {} } = {}) {
  const have = { ...pots }, out = [];
  const ranked = (candidates || []).filter((c) => c.bucket && BUCKETS.includes(c.bucket) && int(c.cost_cents) > 0 && !c.blocked
    && (!c.free_path || c.free_done || c.urgent))
    .map((c) => ({ ...c, cost: int(c.cost_cents) * (c.monthly ? 3 : 1),
      roi: ((Number(c.impact) || 0) * (c.confidence == null ? 0.5 : Number(c.confidence)) * (learned[c.bucket] ?? 1)) / Math.max(1, int(c.cost_cents) / 100) }))
    .sort((a, b) => b.roi - a.roi);
  for (const c of ranked) {
    if (queued.includes(c.id)) continue;
    if (c.cost > int(have[c.bucket])) continue;
    have[c.bucket] -= c.cost;
    out.push({ id: c.id, bucket: c.bucket, cents: c.cost, purpose: c.item + (c.monthly ? ' (3 months ahead)' : ''), expected: c.expected || '',
      needs: credentials[c.account] || credentials.default || 'a person to pay it', status: 'ready to execute', roi: +c.roi.toFixed(4) });
  }
  return out;
}

/** The weekly review. spends: [{ bucket, cents, return_score }] with return_score = actual / expected (1 = as expected), only
 *  for spends whose actual return was measured. -> { learned, weights, moves, reason }. Unspent bucket money is moved toward the new
 *  weights (moves sum to zero). Nothing measured: nothing learned, and the weights still follow the ROI ranking. Pure. */
export function review(policy, { pots = {}, learned = {}, spends = [], candidates = [], priorities = [] } = {}) {
  const next = { ...learned }, seen = [];
  for (const k of BUCKETS) {
    const m = spends.filter((s) => s.bucket === k && Number.isFinite(Number(s.return_score)));
    if (!m.length) continue;
    const avg = m.reduce((n, s) => n + Math.max(0, Math.min(4, Number(s.return_score))), 0) / m.length;
    const old = next[k] == null ? 1 : Number(next[k]);
    next[k] = +Math.max(0.25, Math.min(4, old * 0.5 + old * avg * 0.5)).toFixed(4);
    seen.push(k + ' ' + avg.toFixed(2) + 'x of expected over ' + m.length + ' spend' + (m.length === 1 ? '' : 's'));
  }
  const weights = bucketWeights(policy, { candidates, learned: next, priorities });
  const total = BUCKETS.reduce((n, k) => n + Math.max(0, int(pots[k])), 0);
  const target = Object.fromEntries(BUCKETS.map((k) => [k, Math.floor(total * weights[k])]));
  target[BUCKETS[0]] += total - BUCKETS.reduce((n, k) => n + target[k], 0);
  const moves = BUCKETS.map((k) => ({ bucket: k, cents: target[k] - Math.max(0, int(pots[k])) })).filter((m) => m.cents);
  const reason = seen.length ? 'Measured returns: ' + seen.join('; ') + '. Unspent money moves toward what worked.'
    : 'No spend has a measured return yet, so nothing was learned; unspent money follows the current ROI ranking.';
  return { learned: next, weights, moves, reason };
}

/** Should the owner cut change? Verse's own rule, stated in the policy: up a step when the trailing 30 days of realized revenue
 *  covers the running costs `cover` times over and the reserve is at target; down a step (never under the floor) when the reserve
 *  is under half its target for a whole review. -> null or { share, reason }. Pure. */
export function reviseCut(policy, { realized30 = 0, running30 = 0, reserve = 0 } = {}) {
  const c = policy.owner_cut || {}, r = policy.reserve || {}, step = c.step ?? 0.05;
  const target = int(r.target_cents);
  if (realized30 > 0 && reserve >= target && realized30 >= (c.raise_when_covers ?? 3) * Math.max(running30, 1) && c.share + step <= (c.max ?? 0.5) + 1e-9)
    return { share: +(c.share + step).toFixed(2), reason: 'The last 30 days of realized revenue cover running costs ' + (c.raise_when_covers ?? 3) + 'x over and the reserve is full, so more goes to Atom.' };
  if (reserve < target / 2 && realized30 > 0 && c.share - step >= (c.min ?? 0.2) - 1e-9 && running30 > realized30)
    return { share: +(c.share - step).toFixed(2), reason: 'Running costs are above the last 30 days of realized revenue and the reserve is under half its target, so the cut steps down until the reserve recovers.' };
  return null;
}

export const usd = (c) => (int(c) < 0 ? '-' : '') + '$' + (Math.abs(int(c)) / 100).toFixed(2);
