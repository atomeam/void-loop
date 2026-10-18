// V01D reinvests its own money (Adam, 2026-10-15: "V01D can repurpose its own money in the smartest possible way").
// Pure functions only: the allocator (tools/reinvest.mjs runs it daily), the learning update and the voice weighting.
// Money stays private (the repo is public): this file holds rankings and plan logic only. Real income is read from the owner-only
// GET /api/earnings (net of refunds); real spend proposals go to the confirm line (POST /api/approval, order.place) with cost,
// expected payback and a check date, and their baselines live there too. Nothing here writes a dollar amount to the repo.
// V01D never holds a card and never opens an account: a funded item becomes a *spend proposal* (item, cost, why, expected
// return). It is marked 'ready' only when the purchase goes through an account Adam already pays for; the money itself is
// always spent by Adam, from his own accounts. Plan in docs/reinvest.md; ledger in domains/void.money.json.

export const RESERVE = 0.2;        // the safety buffer: at least 20% of every new dollar is kept, never spent
export const MONTHS = 3;           // a monthly item is funded 3 months ahead, so a proposal never lapses next month
export const VOICE_WEIGHT = 0.3;   // how much V01D's own answer bends the ranking (input, not a gate)
export const LEARN_RATE = 0.5;     // how fast a measured outcome moves its kind's multiplier
export const KINDS = ['revenue', 'speed', 'quality', 'reserve'];

/** Expected return per dollar. Free items (cost 0) score on value alone and always come first (free-first). Pure. */
export function score(c, { learned = {}, voice = {} } = {}) {
  const base = (Number(c.impact) || 0) * (c.confidence == null ? 0.5 : Number(c.confidence));
  const m = (learned[c.kind] == null ? 1 : learned[c.kind]) * (voice[c.kind] == null ? 1 : voice[c.kind]);
  const dollars = costCents(c) / 100;
  return dollars > 0 ? (base * m) / dollars : base * m * 1000;
}
export const costCents = (c) => Math.max(0, Math.round(Number(c.cost_cents) || 0)) * (c.monthly ? MONTHS : 1);

/** A paid item is eligible only once its free path is used up, or when a live outage can't wait (urgent). Pure. */
export const eligible = (c) => !c.blocked && (costCents(c) === 0 || !c.free_path || c.free_done || c.urgent);

/** Rank and fund. income_cents: new money since the last run. Returns { reserve_cents, free, funded, saving, held_cents, ranked }. Pure.
 *  1. reserve first (max of RESERVE and what V01D's own answer keeps back);
 *  2. every free path not yet done becomes a $0 build task, ranked ahead of anything paid;
 *  3. the rest goes greedily by ROI per dollar to eligible paid items that fit; the best one that doesn't fit yet is saved toward. */
export function allocate(income_cents, candidates, { learned = {}, voice = {}, reserve = RESERVE, owned = [] } = {}) {
  const income = Math.max(0, Math.round(Number(income_cents) || 0));
  const keep = Math.max(RESERVE, Math.min(0.9, Number(reserve) || 0));
  const reserve_cents = Math.ceil(income * keep);
  let left = income - reserve_cents;
  const ranked = (candidates || []).filter((c) => c && c.kind !== 'reserve')
    .map((c) => ({ ...c, cost: costCents(c), roi: +score(c, { learned, voice }).toFixed(4), eligible: eligible(c) }))
    .sort((a, b) => (a.cost === 0) !== (b.cost === 0) ? (a.cost === 0 ? -1 : 1) : b.roi - a.roi || a.cost - b.cost);
  const free = ranked.filter((c) => !c.blocked && (c.cost === 0 || (c.free_path && !c.free_done)))
    .map((c) => ({ id: c.id, item: c.cost === 0 ? c.item : c.free_path, cents: 0, why: c.why, kind: c.kind }));
  const funded = []; let saving = null;
  for (const c of ranked) {
    if (!c.eligible || c.cost === 0) continue;
    if (c.cost <= left) { left -= c.cost; funded.push(proposal(c, owned)); }
    else if (!saving) saving = { id: c.id, item: c.item, cost_cents: c.cost, have_cents: 0 };
  }
  if (saving) { saving.have_cents = left; left = 0; }
  return { income_cents: income, reserve_cents, reserve_share: keep, free, funded, saving, held_cents: left, ranked: ranked.map((c) => ({ id: c.id, roi: c.roi, eligible: c.eligible, cost_cents: c.cost })) };
}

/** A funded item as a spend proposal. 'ready' only when it is bought through an account Adam already pays for. Pure. */
export const CHECK_DAYS = 30; // the honest payoff test: each spend is checked against its baseline this many days later
export function proposal(c, owned = []) {
  const ready = !!c.account && owned.includes(c.account);
  return { id: c.id, item: c.item, cost_cents: c.cost, why: c.why, expected: c.expected, kind: c.kind, account: c.account || null, metric: c.metric || null,
    status: ready ? 'ready' : 'queued', how: ready ? 'Adam buys it in his existing ' + c.account + ' account' : 'needs Adam: no account Verse may use yet (none is opened for it)' };
}

/** Learning: a spend's measured outcome (after / before of its metric, higher is better) moves its kind's multiplier. Pure. */
export function learn(learned, { kind, before, after } = {}) {
  const out = { ...(learned || {}) };
  const b = Number(before), a = Number(after);
  if (!kind || !(b > 0) || !(a >= 0)) return out;
  const ratio = Math.max(0.25, Math.min(4, a / b));
  const old = out[kind] == null ? 1 : out[kind];
  out[kind] = +Math.max(0.25, Math.min(4, old * (1 - LEARN_RATE) + old * ratio * LEARN_RATE)).toFixed(4);
  return out;
}

const VOICE_KINDS = [
  ['reserve', /buffer|emergenc|savings|reserve|cash on hand|liquid/i],
  ['quality', /yourself|skill|educat|course|book|learn|quality/i],
  ['revenue', /business|product|sell|market|customer|revenue|promot|experiment/i],
  ['speed', /compute|speed|faster|minutes|caps?\b|limit/i],
];
/** V01D's own answer -> { shares: {kind: share}, unmapped, voice: {kind: multiplier} }. Each "$N" or "N%" is read with the words
 *  around it; what fits none of V01D's kinds (e.g. buying shares: V01D holds no brokerage account) is reported, not funded. Pure. */
export function readVoice(text, weight = VOICE_WEIGHT) {
  const shares = {}, unmapped = []; let total = 0;
  // each numbered step of the answer ("1. **Build a tiny emergency buffer** – Put $20 …"): its first dollar amount, by its title
  for (const part of String(text || '').split(/\n(?=\s*\d+\.\s)/)) {
    if (!/^\s*\d+\.\s/.test(part)) continue;
    const m = part.match(/\$\s?(\d+(?:\.\d+)?)/);
    if (!m) continue;
    const amt = Number(m[1]), title = (part.match(/\*\*([^*]+)\*\*/) || [, part.slice(0, 80)])[1];
    const hit = VOICE_KINDS.find(([, re]) => re.test(title)) || VOICE_KINDS.find(([, re]) => re.test(part.slice(0, 160)));
    total += amt;
    if (hit && !/etf|shares|stock|bond|crypto/i.test(title)) shares[hit[0]] = (shares[hit[0]] || 0) + amt; else unmapped.push({ amount: amt, text: title.trim() });
  }
  // the multipliers lean on what V01D said among its own kinds; the reserve it named counts against everything it said
  const voice = {}, mapped = KINDS.reduce((n, k) => n + (shares[k] || 0), 0), reserve = total ? (shares.reserve || 0) / total : 0;
  for (const k of KINDS) { const s = mapped ? (shares[k] || 0) / mapped : 0.25; shares[k] = +s.toFixed(3); voice[k] = +Math.max(0.5, 1 + weight * (s * KINDS.length - 1)).toFixed(3); }
  return { shares, unmapped, voice, reserve: +reserve.toFixed(3) };
}

/** docs/wishlist.md's table -> [{ rank, item, value }] (the wishlist may not be merged yet: [] then). Pure. */
export function readWishlist(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    const c = line.split('|').map((s) => s.trim());
    if (c.length > 6 && /^\d+$/.test(c[1])) out.push({ rank: +c[1], item: c[2], value: (c[5].match(/^(high|medium|low)/i) || [, ''])[1].toLowerCase() });
  }
  return out;
}
const VALUE = { high: 0.9, medium: 0.5, low: 0.2 };
/** the wishlist's own value word sets a matched candidate's impact; the list's rank breaks ties. Pure. */
export function withWishlist(candidates, wish) {
  return (candidates || []).map((c) => {
    const w = c.wishlist && wish.find((x) => x.rank === c.wishlist && x.item.toLowerCase().includes(String(c.match || c.item).toLowerCase().split(' ')[0]));
    return w && VALUE[w.value] != null ? { ...c, impact: VALUE[w.value], from_wishlist: w.rank } : c;
  });
}

/** A funded proposal as the confirm line's order.place args: cost, expected payback and by when, plus the payoff test (the one
 *  metric it should move, its baseline now and the check date). Kept owner-only in D1 with the approval. Pure. */
export function toApproval(p, { baseline = null, now = Date.now(), days = CHECK_DAYS } = {}) {
  const by = new Date(now + days * 864e5).toISOString().slice(0, 10);
  return { toolName: 'order.place', stepId: 'reinvest:' + p.id, args: {
    item: p.item, cost: { amount: +(p.cost_cents / 100).toFixed(2), currency: 'USD' }, payback: p.expected, by, why: p.why,
    test: { metric: p.metric, baseline, check_by: by }, account: p.account, status: p.status, source: 'reinvest' } };
}

/** The payoff test, afterwards: the metric's value now against the baseline recorded before the spend. Only this comparison
 *  feeds learn(); no baseline, no metric or not due yet: nothing is learned. 'down' metrics (misses) count a fall as success. Pure. */
export function payoff(test, current, today = new Date().toISOString().slice(0, 10)) {
  if (!test || !test.metric || test.baseline == null || current == null || !test.check_by || today < test.check_by) return null;
  const b = Number(test.baseline), a = Number(current);
  if (!(b >= 0) || !(a >= 0)) return null;
  const down = /down is better|misses/i.test(test.metric);
  return down ? { before: a || 1, after: b || 1 } : { before: b || 1, after: a };
}
