// Starboard's claim wall (lib/sponsors.js has the rules). A visitor who reads the sponsor grid may claim CLAIM.units of USDC, paid only
// from the visitor pool: the part of sponsor income, already read back on chain, that is left after the house share (HOUSE_BPS) goes to
// the treasury. The pool check, the per-visitor and per-address window and the daily cap sit in one INSERT, so two claims at the same
// moment cannot both take the last of the pool.
// GET  -> the claim rules and what the pool holds now (counts only)
// POST { address } -> the claim is recorded as owed to that Base address. Verse never signs or sends: a person with the wallet's key pays
//         the owed claims, and the treasury shows them as owed until then.
// Refused for Verse's own runs, tests, crawlers (lib/visits.js classify) and the owner (lib/guard.js ownerOk). Closed with no D1 or no SALT.
// The address a claimant gives is kept for the payout and never returned by any public read; the visitor is kept only as a salted hash.
import { ownerOk, bump } from '../../lib/guard.js';
import { classify } from '../../lib/visits.js';
import { clientKey } from '../../lib/reactions.js';
import { HOUSE_BPS, CLAIM, claimOk, poolUnits, windowStart, dayOf, centsOfUnits } from '../../lib/sponsors.js';
import { ensureSponsor, sponsorUnits, claimUnits } from '../../lib/sponsor-db.js';

// USDC from atomic units (6 decimals), with no trailing zeros: 5, 0.01
const usdcText = (u) => String(Number(BigInt(u)) / 1e6);
const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });
const off = () => json({ ok: false, error: 'the claim wall is closed for now' }, 503);

async function pool(env) {
  const s = await sponsorUnits(env), c = await claimUnits(env);
  return { left: poolUnits(s.verified, c.claimed, HOUSE_BPS), claims: c.count };
}

export async function onRequestGet({ env }) {
  if (!env || !env.DB) return off();
  try {
    await ensureSponsor(env);
    const p = await pool(env);
    return json({ ok: true, claim_usdc: usdcText(CLAIM.units), window_hours: CLAIM.windowHours, per_day: CLAIM.perDay, house_bps: HOUSE_BPS,
      pool_cents: centsOfUnits(p.left), open: p.left >= BigInt(CLAIM.units), claims: p.claims });
  } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  if (!env || !env.DB || !env.SALT) return off();
  let b = null; try { b = JSON.parse((await request.text()).slice(0, 300)); } catch (_) { return json({ ok: false, error: 'bad json' }, 400); }
  const ua = request.headers.get('user-agent') || '', now = Date.now(), day = dayOf(now), since = windowStart(now);
  const owner = await ownerOk(request, env).catch(() => false);
  const cls = classify({ ua, test: request.headers.get('x-void-test'), webdriver: !!(b && (b.w === 1 || b.w === true)) });
  const address = String((b && b.address) || '').trim().toLowerCase();
  const who = await clientKey((request.headers.get('cf-connecting-ip') || 'unknown') + '|' + ua, 'claim', env.SALT);
  if ((await bump(new URL(request.url).origin, 'claim:' + who)) > 5) return json({ ok: false, error: 'slow down' }, 429);
  try {
    await ensureSponsor(env);
    const mine = await env.DB.prepare('SELECT COUNT(*) AS c FROM void_claims WHERE who = ? AND at >= ?').bind(who, since).first();
    const addr = await env.DB.prepare('SELECT COUNT(*) AS c FROM void_claims WHERE address = ? AND at >= ?').bind(address, since).first();
    const today = await env.DB.prepare('SELECT COUNT(*) AS c FROM void_claims WHERE day = ?').bind(day).first();
    const p = await pool(env);
    const ok = claimOk({ cls, owner, address, mineInWindow: Number(mine && mine.c) || 0, addressInWindow: Number(addr && addr.c) || 0, today: Number(today && today.c) || 0, poolLeft: p.left });
    if (!ok.ok) return json({ ok: false, error: ok.error }, ok.status);
    const at = new Date(now).toISOString(), id = 'claim:' + at + ':' + who;
    const r = await env.DB.prepare(
      'INSERT INTO void_claims (id, at, day, who, address, units, status) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ' +
      "(SELECT COALESCE(SUM(CAST(units AS INTEGER)), 0) FROM void_x402 WHERE service LIKE 'sponsor-%' AND status = 'verified') * (10000 - ?) / 10000 " +
      '- (SELECT COALESCE(SUM(CAST(units AS INTEGER)), 0) FROM void_claims) >= ? ' +
      'AND NOT EXISTS (SELECT 1 FROM void_claims WHERE (who = ? OR address = ?) AND at >= ?) AND (SELECT COUNT(*) FROM void_claims WHERE day = ?) < ?')
      .bind(id, at, day, who, address, String(CLAIM.units), 'owed', HOUSE_BPS, CLAIM.units, who, address, since, day, CLAIM.perDay).run();
    if (!(r && r.meta && Number(r.meta.changes) === 1)) return json({ ok: false, error: 'the pool or a limit changed just now; nothing was recorded' }, 409);
    return json({ ok: true, owed_usdc: usdcText(CLAIM.units), note: 'recorded as owed to ' + address.slice(0, 6) + '...' + address.slice(-4) + '; it is sent from Verse\'s wallet by a person with its key, from sponsor income only' });
  } catch (_) { return off(); }
}
