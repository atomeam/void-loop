// A tile on Starboard's sponsor grid (a-to-mind.com/starboard/), bought over x402 in USDC on Base, into Verse's own wallet
// (lib/verse-wallet.js walletOf, the treasury payTo). lib/sponsors.js has the plans, the checks and the money rule.
//   GET / HEAD /api/x402/sponsor/<day|week|month>  -> 402 with the payment requirements, so an agent or a facilitator can see the price
//   POST with no payment header                     -> the tile is checked first (a bad tile costs nothing), then 402
//   POST with X-PAYMENT (v1) or PAYMENT-SIGNATURE (v2) -> the facilitator verifies it, the payment is settled, and only then the tile is
//        written, queued after any tile already bought for that slot, so a buyer always gets the days paid for.
// The payment counts in the treasury and in the claim pool only after it is read back on chain (status 'verified'); a payment the chain
// does not show takes the tile off the grid. Verse never signs, sends or holds a key.
import { requirementsOf, paymentRequired, readPayment, verify, settle, settlementHeader } from '../../../../lib/x402.js';
import { walletOf, recordPayment } from '../../../../lib/verse-wallet.js';
import { PLANS, planSpec, checkTile, startOf, endOf } from '../../../../lib/sponsors.js';
import { ensureSponsor, tileRows, standing } from '../../../../lib/sponsor-db.js';

const J = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store', ...h } });
const planOf = (params) => String((params && params.plan) || '').toLowerCase();

async function priced(request, env, plan) {
  if (!env || !env.DB) return { error: J({ error: 'the sponsor grid is closed for now; nothing is charged' }, 503) };
  let w = null; try { w = await walletOf(env); } catch (_) {}
  if (!w) return { error: J({ error: 'Verse has no wallet set up yet, so the grid is closed; nothing is charged' }, 503) };
  const req = requirementsOf(planSpec(plan), w.address, new URL(request.url).origin);
  return req ? { w, req } : { error: J({ error: 'the sponsor grid is closed for now; nothing is charged' }, 503) };
}

export async function onRequestGet({ request, env, params }) {
  const plan = planOf(params);
  if (!PLANS[plan]) return J({ error: 'no such plan: day, week or month (GET /api/sponsors lists the grid)' }, 404);
  const p = await priced(request, env, plan);
  return p.error || paymentRequired(p.req, 'X-PAYMENT header is required: POST /api/x402/sponsor/' + plan + ' with { slot, title, url, text? }');
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };

export async function onRequestPost({ request, env, params }) {
  const plan = planOf(params);
  if (!PLANS[plan]) return J({ error: 'no such plan: day, week or month (GET /api/sponsors lists the grid)' }, 404);
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return J({ error: 'bad json' }, 400); }
  const t = checkTile(b);
  if (!t.ok) return J({ error: t.error }, 400); // checked before any payment, so a bad tile never costs anything
  const p = await priced(request, env, plan);
  if (p.error) return p.error;
  const { w, req } = p;
  const pay = readPayment(request, req);
  if (!pay) return paymentRequired(req, 'X-PAYMENT header is required');
  if (pay.bad) return paymentRequired(req, pay.bad);
  let v; try { v = await verify(env, pay); } catch (_) { return J({ error: 'the payment could not be checked just now; nothing was charged, try again' }, 503); }
  if (!v.ok) return paymentRequired(req, 'payment not valid: ' + v.reason);
  let rows = []; try { rows = standing(await tileRows(env)); } catch (_) { return J({ error: 'the sponsor grid is closed for now; nothing was charged' }, 503); }

  let s; try { s = await settle(env, pay); } catch (_) { s = { ok: false, reason: 'the facilitator did not answer' }; }
  if (!s.ok) return J({ paid: false, error: 'the payment did not settle (' + s.reason + '), so no tile was written and nothing was taken; try again' }, 402);
  const units = String(pay.payload.payload.authorization.value), days = PLANS[plan].days;
  const starts = startOf(rows, t.slot), ends = endOf(starts, days), tx = s.transaction.toLowerCase(), now = new Date().toISOString();
  const tile = { id: 'tile:' + tx, slot: t.slot, title: t.title, text: t.text, url: t.url, plan, days, starts, ends };
  try { await recordPayment(env, { tx, service: 'sponsor-' + plan, units, network: s.network, payTo: w.address }); }
  catch (e) { console.log('[sponsor] settled ' + tx + ' but not recorded: ' + String((e && e.message) || e).slice(0, 200)); }
  try {
    await ensureSponsor(env);
    await env.DB.prepare('INSERT OR IGNORE INTO void_sponsor (id, at, slot, title, text, url, plan, days, units, starts, ends, tx, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(tile.id, now, tile.slot, tile.title, tile.text, tile.url, plan, days, units, starts, ends, tx, 'paid').run();
  } catch (e) {
    console.log('[sponsor] settled ' + tx + ' but the tile was not saved: ' + String((e && e.message) || e).slice(0, 200));
    const [h, val] = settlementHeader(pay.version, s);
    return J({ ok: false, paid: true, tx, error: 'the payment settled and is recorded, but the tile was not saved; it is kept under this transaction for the owner to put up' }, 500, { [h]: val });
  }
  const [h, val] = settlementHeader(pay.version, s);
  return J({ ok: true, paid: true, tx, tile, note: 'the tile shows on a-to-mind.com/starboard/ from ' + starts + '; it stays only if the chain shows the payment' }, 200, { [h]: val });
}
