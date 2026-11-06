// Verse's other pay-per-call services for agents, over x402 (lib/x402.js SERVICES), paid in USDC on Base into Verse's own wallet
// (lib/verse-wallet.js). Owner, 2026-11-06: "so maybe verse can immediatly start charging for its code review and anything else possible".
// Code review has its own route (./review.js). Each service here is one of the site's free routes (functions/api/<route>.js), run unchanged:
//   POST /api/x402/<service> without a payment header -> 402 with the payment requirements (v1 JSON body, v2 PAYMENT-REQUIRED header)
//   POST with X-PAYMENT (v1) or PAYMENT-SIGNATURE (v2) -> the facilitator verifies it, the free route answers, and only an answer that
//        did the work (paidOk below) is settled and given, with the settlement header. Anything else (a refusal, a rate limit, a model that
//        is busy) is given back with paid: false and nothing is settled, so nothing is charged.
//   GET / HEAD -> 402 with the same requirements, so a facilitator's Bazaar probe sees a paid endpoint (docs.payai.network/x402/facilitators/bazaar).
// The free pages and their routes stay free. Verse never signs, sends or holds a key; a settled payment counts in the treasury only after it
// is read back on chain.
import { SERVICES, requirements, paymentRequired, readPayment, verify, settle, settlementHeader } from '../../../lib/x402.js';
import { walletOf, recordPayment } from '../../../lib/verse-wallet.js';
import * as answerRoute from '../answer.js';
import * as translateRoute from '../translate.js';
import * as digestRoute from '../digest.js';
import * as appraiseRoute from '../appraise.js';
import * as imageRoute from '../image.js';
import { backtestRoute, arbitrageRoute, btInput, arbInput } from '../../../lib/trading-paid.js';

const J = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store', ...h } });
const str = (v) => (typeof v === 'string' ? v : '');
const need = (cond, msg) => (cond ? true : msg);
const IMAGE = /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+=*$/;

// For each service: the free route, the body it is given (only the fields the service sells), a check made before any payment (so a call
// that cannot work costs nothing), and what counts as the work done (only that is settled).
export const PAID = {
  answer: { route: answerRoute, body: (b) => ({ ask: str(b.ask) }), check: (b) => need(str(b.ask).trim().length >= 3, 'send { ask }: a question of 3 to 600 characters'),
    paidOk: (s, j) => s === 200 && !!(j && typeof j.answer === 'string' && j.answer.trim()) },
  fix: { route: answerRoute, body: (b) => ({ mode: 'fix', ask: str(b.ask), details: str(b.details) }), check: (b) => need(str(b.ask).trim().length >= 3, 'send { ask, details? }: what broke, 3 to 600 characters'),
    paidOk: (s, j) => s === 200 && !!(j && typeof j.answer === 'string' && j.answer.trim()) },
  translate: { route: translateRoute, body: (b) => ({ text: str(b.text), to: str(b.to), from: str(b.from) || 'auto' }),
    check: (b) => need(!!(str(b.text).trim() && str(b.to).trim()), 'send { text, to, from? }'),
    paidOk: (s, j) => s === 200 && !!(j && typeof j.text === 'string' && j.text.trim() && j.via && j.via !== 'same') },
  digest: { route: digestRoute, body: (b) => ({ text: str(b.text), url: str(b.url), ask: str(b.ask) }),
    check: (b) => need(!!str(b.url).trim() || str(b.text).length >= 80, 'send { text } (a transcript, a few sentences at least) or { url }'),
    paidOk: (s, j) => s === 200 && !!(j && j.ok === true) },
  appraise: { route: appraiseRoute, body: (b) => ({ image: str(b.image), note: str(b.note) }), check: (b) => need(IMAGE.test(str(b.image).trim()), 'send { image }: a PNG, JPEG or WebP data URL'),
    paidOk: (s, j) => s === 200 && !!(j && j.value && !j.value.person) },
  image: { route: imageRoute, body: (b) => ({ prompt: str(b.prompt), negative: str(b.negative), style: str(b.style), shape: str(b.shape), seed: Number(b.seed) || 0 }),
    check: (b) => need(!!str(b.prompt).trim(), 'send { prompt }: what to paint'),
    paidOk: (s, j) => s === 200 && !!(j && j.state === 'art' && j.img) },
  // the trading bots (lib/trading-paid.js): no free POST route of their own, the pages compute in the browser; read only, nothing is traded
  backtest: { route: backtestRoute, body: (b) => b, check: (b) => { const i = btInput(b); return i.ok ? true : i.error; },
    paidOk: (s, j) => s === 200 && !!(j && j.stats && Array.isArray(j.equity)) },
  arbitrage: { route: arbitrageRoute, body: (b) => b, check: (b) => { const i = arbInput(b); return i.ok ? true : i.error; },
    paidOk: (s, j) => s === 200 && !!(j && Array.isArray(j.rows) && j.rows.length) },
};

const nameOf = (params) => String((params && params.service) || '').toLowerCase();

async function priced(request, env, name) {
  let w = null; try { w = await walletOf(env); } catch (_) {}
  if (!w) return { error: J({ error: 'Verse has no wallet set up yet, so paid calls are closed; nothing is charged' }, 503) };
  return { w, req: requirements(name, w.address, new URL(request.url).origin) };
}

// A facilitator's Bazaar probe (HEAD, then GET) and any agent that looks first: the same 402 a POST without payment gets.
export async function onRequestGet({ request, env, params }) {
  const name = nameOf(params);
  if (!PAID[name] || !SERVICES[name]) return J({ error: 'no such paid service; GET /api/x402 lists them' }, 404);
  const p = await priced(request, env, name);
  return p.error || paymentRequired(p.req, 'X-PAYMENT header is required: POST ' + SERVICES[name].path + ' with a JSON body');
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };

export async function onRequestPost({ request, env, params, waitUntil }) {
  const name = nameOf(params), svc = PAID[name];
  if (!svc || !SERVICES[name]) return J({ error: 'no such paid service; GET /api/x402 lists them' }, 404);
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return J({ error: 'bad json' }, 400); }
  if (!b || typeof b !== 'object') return J({ error: 'bad json' }, 400);
  const ok = svc.check(b);
  if (ok !== true) return J({ error: ok }, 400); // asked before any payment, so a bad call never costs anything
  const p = await priced(request, env, name);
  if (p.error) return p.error;
  const { w, req } = p;
  const pay = readPayment(request, req);
  if (!pay) return paymentRequired(req, 'X-PAYMENT header is required');
  if (pay.bad) return paymentRequired(req, pay.bad);
  let v; try { v = await verify(env, pay); } catch (_) { return J({ error: 'the payment could not be checked just now; nothing was charged, try again' }, 503); }
  if (!v.ok) return paymentRequired(req, 'payment not valid: ' + v.reason);

  // the free route, run for this caller: the same headers (its per-connection limits still apply), only the fields this service sells
  const headers = new Headers(request.headers); headers.delete('x-payment'); headers.delete('payment-signature'); headers.set('content-type', 'application/json');
  const inner = new Request(new URL(request.url).origin + '/api/' + SERVICES[name].route, { method: 'POST', headers, body: JSON.stringify(svc.body(b)) });
  let res; try { res = await svc.route.onRequestPost({ request: inner, env, params: {}, waitUntil: waitUntil || (() => {}) }); }
  catch (_) { return J({ error: 'the service failed; no payment was taken', paid: false }, 502); }
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch (_) {}
  if (!svc.paidOk(res.status, j)) return J({ ...(j && typeof j === 'object' ? j : { error: text.slice(0, 300) }), paid: false, note: 'no payment was taken' }, res.status === 200 ? 200 : res.status);

  let s; try { s = await settle(env, pay); } catch (_) { s = { ok: false, reason: 'the facilitator did not answer' }; }
  if (!s.ok) return J({ paid: false, error: 'the payment did not settle (' + s.reason + '), so the answer is not given and nothing was taken; try again' }, 402);
  const value = String(pay.payload.payload.authorization.value);
  try { await recordPayment(env, { tx: s.transaction, service: name, units: value, network: s.network, payTo: w.address }); }
  catch (e) { console.log('[x402] settled ' + s.transaction + ' but not recorded: ' + String((e && e.message) || e).slice(0, 200)); }
  const [h, val] = settlementHeader(pay.version, s);
  return new Response(text, { status: 200, headers: { 'content-type': res.headers.get('content-type') || 'application/json', 'cache-control': 'no-store', [h]: val } });
}
