/**
 * beacon: random numbers anyone can check (owner, 2026-10-24: "hyperfocus on the unbeaten aspects one at a time"; random.org's last unbeaten
 * aspect was 'true randomness': it draws from atmospheric noise, which a visitor has to take on trust). Here the numbers come from drand, the
 * public randomness beacon a group of independent organisations runs (the League of Entropy: Cloudflare, Protocol Labs, universities): every
 * 3 seconds it publishes a round whose randomness no one of them could choose or foresee, signed by a threshold of them. Each number is
 * SHA-256 of "<randomness>:<index>:<try>" read as a 32-bit integer, with unbiased rejection, so anyone holding the round number can fetch the
 * same round and get the same numbers: the link carries the round, and opening it re-derives them. Pure but for crypto.subtle and fetch.
 * Tests: tools/beacon.test.mjs.
 */
// drand's "quicknet" chain (3-second rounds, unchained, BLS signatures), served by several public relays
export const CHAIN = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
export const RELAYS = Object.freeze(['https://api.drand.sh', 'https://drand.cloudflare.com', 'https://api2.drand.sh']);
export const roundUrl = (round, relay = RELAYS[0]) => relay + '/' + CHAIN + '/public/' + (round ? String(Math.floor(round)) : 'latest');

/** a round from the first relay that answers: { round, randomness } (64 hex), or throws. */
export async function fetchRound(round = 0, get = fetch) {
  let last = null;
  for (const relay of RELAYS) {
    try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 5000);
      const r = await get(roundUrl(round, relay), { signal: c.signal }).finally(() => clearTimeout(t));
      if (!r.ok) { last = new Error('relay ' + r.status); continue; }
      const j = await r.json();
      if (j && Number.isInteger(j.round) && /^[0-9a-f]{64}$/.test(String(j.randomness)) && (!round || j.round === round)) return { round: j.round, randomness: j.randomness };
      last = new Error('relay gave no round');
    } catch (e) { last = e; }
  }
  throw last || new Error('no relay answered');
}

const enc = new TextEncoder();
/** the 32-bit number SHA-256("<randomness>:<i>:<k>") starts with. */
async function u32(randomness, i, k) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(randomness + ':' + i + ':' + k))); return ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0; }
/** the i-th number in [a, b] from a round's randomness: unbiased (draws past the last whole multiple of the span are skipped). */
export async function nth(randomness, i, a, b) {
  const span = b - a + 1; if (!(span >= 1 && span <= 4294967296)) throw new Error('range too wide for one 32-bit draw');
  const lim = Math.floor(4294967296 / span) * span;
  for (let k = 0; k < 64; k++) { const x = await u32(randomness, i, k); if (x < lim) return a + (x % span); }
  throw new Error('no unbiased draw in 64 tries'); // odds below 2^-64
}
/** `n` numbers in [a, b] from a round's randomness, the same for anyone; with `unique`, an index already seen draws the next index instead. */
export async function numbers(randomness, a, b, n, unique = false) {
  if (a > b) [a, b] = [b, a];
  const span = b - a + 1; if (unique && n > span) n = span;
  const out = [], seen = new Set();
  for (let i = 0; out.length < n && i < n * 50 + 1000; i++) { const v = await nth(randomness, i, a, b); if (unique && seen.has(v)) continue; seen.add(v); out.push(v); }
  return out;
}
