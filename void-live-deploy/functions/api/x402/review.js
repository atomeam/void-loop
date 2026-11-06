// Verse's pay-per-call API for agents, over x402 (lib/x402.js), paid in USDC on Base into Verse's own wallet (lib/verse-wallet.js).
// GET  /api/x402            what Verse sells per call, the price, where it is paid and whether it is open right now (public)
// POST /api/x402/review     { code | diff, lang?, ask? }: without a payment header -> 402 with the payment requirements (v1 body,
//                           v2 PAYMENT-REQUIRED header); with X-PAYMENT (v1) or PAYMENT-SIGNATURE (v2) -> the facilitator verifies it,
//                           the closer read runs, the facilitator settles it, and only then is the read given, with the settlement
//                           header. No settlement, no read and no charge (a signed authorization that is never settled moves nothing).
// Verse never signs, sends or holds a key. A settled payment is counted in the treasury only after it is read back on chain.
import { SERVICES, requirements, paymentRequired, readPayment, verify, settle, settlementHeader, facilitatorOf, usdcText, NET, USDC_BASE } from '../../../lib/x402.js';
import { walletOf, recordPayment } from '../../../lib/verse-wallet.js';
import { reviewWith, reviewOpen, modelsOn } from '../review.js';

const J = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store', ...h } });

export async function catalog({ request, env }) {
  const origin = new URL(request.url).origin;
  let w = null; try { w = await walletOf(env); } catch (_) {}
  return J({
    protocol: 'x402 (https://docs.x402.org), versions 1 and 2', network: { v1: NET.v1, v2: NET.v2 }, asset: { symbol: 'USDC', address: USDC_BASE },
    facilitator: facilitatorOf(env), pay_to: w ? w.address : null, wallet: w ? w.note : 'not set up yet: paid calls are closed until Verse has a wallet',
    services: Object.entries(SERVICES).map(([id, s]) => ({ id, method: s.method, url: origin + s.path, price_usdc: usdcText(s.units), description: s.description,
      open: !!w && (id === 'review' ? modelsOn(env) : id === 'appraise' ? !!(env && env.AI) : true), input: s.input, output: s.output, example: s.example ? s.example.input : undefined })),
  }, 200, { 'cache-control': 'public, max-age=60' });
}

// A facilitator's Bazaar probe (HEAD, then GET: docs.payai.network/x402/facilitators/bazaar) and any agent that looks first: the 402.
export async function onRequestGet({ request, env }) {
  let w = null; try { w = await walletOf(env); } catch (_) {}
  if (!w) return J({ error: 'Verse has no wallet set up yet, so paid calls are closed; nothing is charged' }, 503);
  return paymentRequired(requirements('review', w.address, new URL(request.url).origin), 'X-PAYMENT header is required: POST /api/x402/review with { code } or { diff }');
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };

export async function onRequestPost({ request, env }) {
  const name = 'review';
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return J({ error: 'bad json' }, 400); }
  if (!reviewOpen(b)) return J({ error: 'send { code } or { diff }' }, 400); // asked before any payment, so a bad call never costs anything
  if (!modelsOn(env)) return J({ error: 'the closer read is off right now; no payment is taken' }, 503);
  let w = null; try { w = await walletOf(env); } catch (_) {}
  if (!w) return J({ error: 'Verse has no wallet set up yet, so paid calls are closed; nothing is charged' }, 503);
  const origin = new URL(request.url).origin, req = requirements(name, w.address, origin);
  const pay = readPayment(request, req);
  if (!pay) return paymentRequired(req, 'X-PAYMENT header is required');
  if (pay.bad) return paymentRequired(req, pay.bad);
  let v; try { v = await verify(env, pay); } catch (_) { return J({ error: 'the payment could not be checked just now; nothing was charged, try again' }, 503); }
  if (!v.ok) return paymentRequired(req, 'payment not valid: ' + v.reason);
  let settled = null;
  const a = { tier: 'x402', left: 1, spend: async () => {
    const s = await settle(env, pay);
    if (!s.ok) throw new Error('not settled: ' + s.reason);
    settled = s;
    const value = String(pay.payload.payload.authorization.value);
    try { await recordPayment(env, { tx: s.transaction, service: name, units: value, network: s.network, payTo: w.address }); } catch (e) { console.log('[x402] settled ' + s.transaction + ' but not recorded: ' + String(e && e.message || e).slice(0, 200)); }
  } };
  const res = await reviewWith(b, a, env);
  if (!settled) { // the read did not happen (model busy) or the payment did not settle: nothing was taken, and the answer says so
    const body = await res.json().catch(() => ({}));
    return J({ ...body, paid: false, note: (body.note ? body.note + '; ' : '') + 'no payment was taken: try again' }, 200);
  }
  const out = new Response(res.body, res);
  const [h, val] = settlementHeader(pay.version, settled);
  out.headers.set(h, val);
  out.headers.set('cache-control', 'no-store');
  return out;
}
