// Treasury & Faucet: autonomous reward pools, staking and allocation for Verse's agent nodes.
// Local-first, pure over the ledger handed in. No chain calls here; the real (Kraken-style) payouts are settled by
// the server (lib/gumroad.js, functions/api/); this module keeps the books and the rules.
//   createPool(name, seed)        a new reward pool with `seed` units
//   stake(pool, node, amount)     node stakes `amount` into the pool (returns the pool)
//   allocate(pool, winners)       split the pool among `winners` ({ node, weight })
//   claim(pool, node)             node claims its allocation (returns { amount, pool })
//   balances(pool)                { node: amount } of unclaimed allocations
//   audit(pool)                   { total, staked, allocated, claimed, unclaimed, nodes }

export const MIN_STAKE = 1;
export const MAX_NODES = 1000;

export function createPool(name, seed = 0) {
  const n = String(name || '').trim();
  if (!n) return null;
  const s = Number(seed);
  if (!Number.isFinite(s) || s < 0) return null;
  return { name: n, seed: s, staked: {}, allocations: {}, claimed: {}, total: s, createdAt: Date.now() };
}

export function stake(pool, node, amount) {
  if (!pool || typeof pool !== 'object') return pool;
  const id = String(node || '').trim();
  const a = Number(amount);
  if (!id || !Number.isFinite(a) || a < MIN_STAKE) return pool;
  if (Object.keys(pool.staked).length >= MAX_NODES && !(id in pool.staked)) return pool;
  pool.staked[id] = (pool.staked[id] || 0) + a;
  pool.total += a;
  return pool;
}

export function allocate(pool, winners) {
  if (!pool || !Array.isArray(winners) || !winners.length) return pool;
  const valid = winners.filter((w) => w && w.node && Number.isFinite(+w.weight) && +w.weight > 0);
  if (!valid.length) return pool;
  const wsum = valid.reduce((a, w) => a + +w.weight, 0);
  if (wsum <= 0) return pool;
  const available = Math.max(0, pool.total - Object.values(pool.allocated || {}).reduce((a, b) => a + b, 0));
  for (const w of valid) {
    const share = Math.floor((available * +w.weight) / wsum);
    pool.allocations[w.node] = (pool.allocations[w.node] || 0) + share;
  }
  return pool;
}

export function claim(pool, node) {
  if (!pool) return { amount: 0, pool };
  const id = String(node || '').trim();
  const owed = (pool.allocations[id] || 0) - (pool.claimed[id] || 0);
  if (owed <= 0) return { amount: 0, pool };
  pool.claimed[id] = (pool.claimed[id] || 0) + owed;
  pool.total -= owed;
  return { amount: owed, pool };
}

export function balances(pool) {
  if (!pool) return {};
  const out = {};
  for (const id of Object.keys(pool.allocations)) {
    const owed = (pool.allocations[id] || 0) - (pool.claimed[id] || 0);
    if (owed > 0) out[id] = owed;
  }
  return out;
}

export function audit(pool) {
  if (!pool) return null;
  const staked = Object.values(pool.staked || {}).reduce((a, b) => a + b, 0);
  const allocated = Object.values(pool.allocations || {}).reduce((a, b) => a + b, 0);
  const claimed = Object.values(pool.claimed || {}).reduce((a, b) => a + b, 0);
  return {
    name: pool.name,
    total: pool.total,
    seed: pool.seed,
    staked,
    allocated,
    claimed,
    unclaimed: allocated - claimed,
    nodes: Object.keys(pool.staked || {}).length,
  };
}

export function leaderboard(pool) {
  if (!pool) return [];
  return Object.keys(pool.allocations || {})
    .map((id) => ({ node: id, allocated: pool.allocations[id] || 0, claimed: pool.claimed[id] || 0, owed: (pool.allocations[id] || 0) - (pool.claimed[id] || 0) }))
    .sort((a, b) => b.owed - a.owed || a.node.localeCompare(b.node));
}