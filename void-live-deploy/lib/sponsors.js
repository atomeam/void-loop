// Starboard's sponsor grid and claim wall, the pure half (functions/api/sponsors.js, functions/api/claim.js and
// functions/api/x402/sponsor/[plan].js use it; tools/sponsors.test.mjs checks it).
//
// THE MONEY RULE. A sponsor buys a tile on the grid for a set number of days and pays in USDC on Base over x402, into Verse's own wallet
// (lib/verse-wallet.js walletOf: the treasury payTo). A sponsor payment counts only after the chain shows it (void_x402 status 'verified').
// Of that verified sponsor income, HOUSE_BPS (5000 = half) is the house share and stays with the treasury. Only the rest is the visitor
// pool, and a claim is accepted only while the pool still holds the claim's amount after every claim already accepted. So the claim wall
// can never owe more than the sponsors paid in. Verse never signs or sends: an accepted claim is recorded as owed, and a person with the
// wallet's key sends it.
//
// THE GUARD. A view or a claim counts only when it comes from a person (lib/visits.js classify) and not from the owner (lib/guard.js
// ownerOk). Verse's own agents, browser tests, crawlers and the owner's sessions are counted as excluded and never as billable.

export const HOUSE_BPS = 5000; // the house share of sponsor income, in basis points of 10000

export const PLANS = Object.freeze({
  day: { days: 1, units: 1000000 },    // 1 USDC for 1 day
  week: { days: 7, units: 5000000 },   // 5 USDC for 7 days
  month: { days: 30, units: 15000000 }, // 15 USDC for 30 days
});

export const SLOTS = Object.freeze(['s1', 's2', 's3', 's4', 's5', 's6']);

export const CLAIM = Object.freeze({
  units: 10000,      // 0.01 USDC for one claim
  windowHours: 24,   // one claim per connection and per address in each window
  perDay: 100,       // claims accepted in all, each UTC day
});

export const LIMITS = Object.freeze({ title: 40, text: 90, url: 200, viewsPerMinute: 30, viewCap: 9999999 });

const DAY_MS = 864e5;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const CTRL_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

/** whole cents in a USDC amount of atomic units (6 decimals); a micro-remainder is never rounded up. Pure. */
export const centsOfUnits = (units) => { try { return Number(BigInt(units) / 10000n); } catch (_) { return 0; } };

/** the x402 service spec for a plan, in the shape lib/x402.js requirementsOf takes. Pure. */
export function planSpec(plan) {
  const p = PLANS[plan];
  if (!p) return null;
  return {
    path: '/api/x402/sponsor/' + plan, method: 'POST', units: p.units,
    description: 'A tile on Verse\'s Starboard sponsor grid at a-to-mind.com/starboard/ for ' + p.days + (p.days === 1 ? ' day' : ' days') + ': a short title, one line of text and an https link.',
    input: {
      slot: { type: 'string', description: 'the tile: ' + SLOTS.join(', '), required: true },
      title: { type: 'string', description: 'plain text, 2 to ' + LIMITS.title + ' characters', required: true },
      url: { type: 'string', description: 'an https link to a public host, at most ' + LIMITS.url + ' characters', required: true },
      text: { type: 'string', description: 'plain text, at most ' + LIMITS.text + ' characters', required: false },
    },
    output: { ok: 'true', tile: '{ id, slot, title, text, url, starts, ends }' },
    tags: ['advertising', 'sponsorship'],
    example: { input: { slot: 's1', title: 'Your project here', url: 'https://example.com/', text: 'One line about it.' }, output: { ok: true, tile: { slot: 's1', title: 'Your project here' } } },
  };
}

const clean = (v, max) => String(typeof v === 'string' ? v : '').replace(CTRL_RE, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** an https link to a public host name, or '' (no user and password, no port, no IP address, no local or single-label host). Pure. */
export function cleanUrl(v) {
  const s = String(typeof v === 'string' ? v : '').trim();
  if (!s || s.length > LIMITS.url) return '';
  let u; try { u = new URL(s); } catch (_) { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || /(^|\.)(localhost|local|internal|invalid|test)$/.test(h)) return '';
  return u.toString();
}

/** a sponsor's request body -> { ok, slot, title, text, url } or { ok: false, error } with a fixed message. Pure. */
export function checkTile(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, error: 'send { slot, title, url, text? }' };
  const slot = String(b.slot || '');
  if (!SLOTS.includes(slot)) return { ok: false, error: 'slot is one of ' + SLOTS.join(', ') };
  const title = clean(b.title, LIMITS.title);
  if (title.length < 2) return { ok: false, error: 'title is plain text, 2 to ' + LIMITS.title + ' characters' };
  const url = cleanUrl(b.url);
  if (!url) return { ok: false, error: 'url is an https link to a public host, at most ' + LIMITS.url + ' characters' };
  return { ok: true, slot, title, text: clean(b.text, LIMITS.text), url };
}

/** when a new tile in `slot` starts: now, or the end of the last tile already bought for it (a paid tile is queued, never refused). Pure. */
export function startOf(tiles, slot, now = Date.now()) {
  let at = now;
  for (const t of Array.isArray(tiles) ? tiles : []) if (t && t.slot === slot && t.status === 'paid') { const e = Date.parse(t.ends); if (e > at) at = e; }
  return new Date(at).toISOString();
}

/** the grid at `now`: each slot with its live tile, or open with the time it is free from. Pure over rows. */
export function grid(tiles, now = Date.now()) {
  const paid = (Array.isArray(tiles) ? tiles : []).filter((t) => t && t.status === 'paid');
  return SLOTS.map((slot) => {
    const mine = paid.filter((t) => t.slot === slot);
    const live = mine.find((t) => Date.parse(t.starts) <= now && now < Date.parse(t.ends));
    const free = startOf(mine, slot, now);
    return live ? { slot, open: false, tile: { id: live.id, title: live.title, text: live.text || '', url: live.url, ends: live.ends }, free_from: free }
      : { slot, open: Date.parse(free) <= now, free_from: free };
  });
}

/** the split of verified sponsor income into the house share and the visitor pool, and what the pool still holds. Integers, cents. Pure. */
export function split({ sponsorCents = 0, claimedCents = 0, paidOutCents = 0 } = {}, bps = HOUSE_BPS) {
  const income = Math.max(0, Math.floor(Number(sponsorCents) || 0));
  const house = Math.floor((income * bps) / 10000);
  const pool = income - house;
  const claimed = Math.max(0, Math.floor(Number(claimedCents) || 0));
  return { house_bps: bps, sponsor_cents: income, house_cents: house, pool_cents: pool, claimed_cents: claimed,
    paid_out_cents: Math.max(0, Math.floor(Number(paidOutCents) || 0)), available_cents: Math.max(0, pool - claimed) };
}

/** the claim pool in units, so a claim of less than a cent still counts against it exactly: pool units minus claimed units. Pure. */
export function poolUnits(sponsorUnits, claimedUnits, bps = HOUSE_BPS) {
  let s = 0n, c = 0n; try { s = BigInt(sponsorUnits || 0); c = BigInt(claimedUnits || 0); } catch (_) {}
  const pool = s - (s * BigInt(bps)) / 10000n;
  return pool > c ? pool - c : 0n;
}

/** may this claim go in? -> { ok } or { ok: false, status, error }. Every count comes from the database; nothing from the request but the class. Pure. */
export function claimOk({ cls, owner, address, mineInWindow = 0, addressInWindow = 0, today = 0, poolLeft = 0n } = {}) {
  if (owner || cls !== 'person') return { ok: false, status: 409, error: 'only a visitor\'s own claim counts: Verse\'s own runs, bots and the owner are left out' };
  if (!ADDR_RE.test(String(address || ''))) return { ok: false, status: 400, error: 'send { address }: a Base address, 0x and 40 hex characters' };
  if (mineInWindow > 0 || addressInWindow > 0) return { ok: false, status: 429, error: 'one claim per visitor and per address every ' + CLAIM.windowHours + ' hours' };
  if (today >= CLAIM.perDay) return { ok: false, status: 429, error: 'the claim wall is full today' };
  if (BigInt(poolLeft) < BigInt(CLAIM.units)) return { ok: false, status: 409, error: 'the pool is empty: claims are paid only from sponsor income already received' };
  return { ok: true };
}

/** the start of the claim window that `now` falls in, as an ISO time. Pure. */
export const windowStart = (now = Date.now()) => new Date(now - CLAIM.windowHours * 3600e3).toISOString();
/** the UTC day of `now`, YYYY-MM-DD. Pure. */
export const dayOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
/** a tile's end: `days` after its start. Pure. */
export const endOf = (starts, days) => new Date(Date.parse(starts) + days * DAY_MS).toISOString();
