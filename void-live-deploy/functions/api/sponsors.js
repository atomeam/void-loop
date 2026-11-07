// Starboard's sponsor grid (lib/sponsors.js has the rules, lib/sponsor-db.js the tables).
// GET  -> the grid now: each slot with its live tile or the time it is free, the plans and their prices in USDC, where to buy
//         (/api/x402/sponsor/<plan>), the house share and the visitor pool from verified sponsor income, and the views of each live tile by
//         people over the last 30 days. Counts only: no visitor's address, user agent or claim address is returned.
// POST { tiles: [tile ids] } -> one view of each live tile shown. A view counts as billable only from a person (lib/visits.js classify) who
//         is not the owner (lib/guard.js ownerOk); Verse's own runs, tests, crawlers and the owner are counted as excluded. 30 a minute per
//         hashed connection; closed (503) with no D1 or no SALT.
import { ownerOk, bump } from '../../lib/guard.js';
import { classify } from '../../lib/visits.js';
import { clientKey } from '../../lib/reactions.js';
import { PLANS, SLOTS, HOUSE_BPS, CLAIM, LIMITS, grid, split, centsOfUnits, dayOf } from '../../lib/sponsors.js';
import { ensureSponsor, tileRows, standing, sponsorUnits, claimUnits } from '../../lib/sponsor-db.js';

// USDC from atomic units (6 decimals), with no trailing zeros: 5, 0.01
const usdcText = (u) => String(Number(BigInt(u)) / 1e6);
const json = (o, status = 200, cache = 'no-store') => Response.json(o, { status, headers: { 'cache-control': cache } });
const off = () => json({ ok: false, error: 'the sponsor grid is closed for now' }, 503);

/** the public read, also used by the treasury: the grid, the split and the views, from the database only */
export async function sponsorView(env, now = Date.now()) {
  const tiles = standing(await tileRows(env));
  const s = await sponsorUnits(env), c = await claimUnits(env);
  const since = dayOf(now - 29 * 864e5);
  const views = (await env.DB.prepare('SELECT tile, kind, SUM(n) AS n FROM void_sponsor_views WHERE day >= ? GROUP BY tile, kind').bind(since).all()).results || [];
  const seen = {};
  for (const v of views) { const o = seen[v.tile] || (seen[v.tile] = { people: 0, excluded: 0 }); o[v.kind === 'person' ? 'people' : 'excluded'] += Number(v.n) || 0; }
  const cells = grid(tiles, now).map((g) => (g.tile ? { ...g, views_30d: seen[g.tile.id] || { people: 0, excluded: 0 } } : g));
  return {
    slots: cells,
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, days: p.days, price_usdc: usdcText(p.units), buy: '/api/x402/sponsor/' + id })),
    split: { ...split({ sponsorCents: centsOfUnits(s.verified), claimedCents: centsOfUnits(c.claimed), paidOutCents: centsOfUnits(c.paid) }, HOUSE_BPS),
      sponsor_payments: s.payments, waiting_cents: centsOfUnits(s.waiting), claims: c.count, claims_owed: c.owed },
    claim: { usdc: usdcText(CLAIM.units), window_hours: CLAIM.windowHours, per_day: CLAIM.perDay },
    rule: 'Sponsor income counts once the chain shows it. Half goes to the treasury first; claims are paid only from the other half, and never past what came in.',
  };
}

export async function onRequestGet({ env }) {
  if (!env || !env.DB) return off();
  try { await ensureSponsor(env); return json({ ok: true, ...(await sponsorView(env)) }, 200, 'public, max-age=30'); }
  catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB || !env.SALT) return off();
  let b = null; try { b = JSON.parse((await request.text()).slice(0, 600)); } catch (_) { return json({ ok: false, error: 'bad json' }, 400); }
  const ids = Array.isArray(b && b.tiles) ? [...new Set(b.tiles.filter((x) => typeof x === 'string' && /^tile:0x[0-9a-f]{64}$/.test(x)))].slice(0, SLOTS.length) : [];
  if (!ids.length) return json({ ok: false, error: 'send { tiles: [tile ids] }' }, 400);
  const ua = request.headers.get('user-agent') || '', now = Date.now(), day = dayOf(now);
  const owner = await ownerOk(request, env).catch(() => false);
  const cls = classify({ ua, test: request.headers.get('x-void-test'), webdriver: b.w === 1 || b.w === true });
  const kind = !owner && cls === 'person' ? 'person' : 'excluded';
  const key = await clientKey((request.headers.get('cf-connecting-ip') || 'unknown') + '|' + ua, day, env.SALT);
  if ((await bump(new URL(request.url).origin, 'sponsor:v:' + key)) > LIMITS.viewsPerMinute) return json({ ok: false, error: 'slow down' }, 429);
  try {
    await ensureSponsor(env);
    const live = new Set(grid(standing(await tileRows(env)), now).filter((g) => g.tile).map((g) => g.tile.id));
    const hit = ids.filter((id) => live.has(id));
    if (hit.length) await env.DB.batch(hit.map((id) => env.DB.prepare('INSERT INTO void_sponsor_views (day, tile, kind, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, tile, kind) DO UPDATE SET n = MIN(n + 1, ?)').bind(day, id, kind, LIMITS.viewCap)));
    return json({ ok: true, counted: hit.length, billable: kind === 'person' });
  } catch (_) { return off(); }
}
