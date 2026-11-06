// One paid call over x402, for any service in lib/x402.js SERVICES: the same flow as the code review's (functions/api/x402/review.js), shared.
// No payment header -> 402 with what to pay. With one: the facilitator verifies it, the work runs, the facilitator settles it, and only then is
// the answer given, with the settlement header. Work that fails is never charged: nothing is settled, and the answer says so.
// Verse never signs, sends or holds a key; a settled payment is recorded through lib/verse-wallet.js like every other.
import { requirements, paymentRequired, readPayment, verify, settle, settlementHeader } from './x402.js';
import { walletOf, recordPayment } from './verse-wallet.js';

const J = (b, s = 200, h = {}) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store', ...h } });

/** run(): -> { ok: true, body } (the paid answer) or { ok: false, status, error } (nothing is charged). Checked inputs should fail before this is called. */
export async function paidCall({ request, env, name, run, walletFn = walletOf, settleFn = settle, verifyFn = verify }) {
  let w = null; try { w = await walletFn(env); } catch (_) {}
  if (!w) return J({ error: 'Verse has no wallet set up yet, so paid calls are closed; nothing is charged' }, 503);
  const req = requirements(name, w.address, new URL(request.url).origin);
  const pay = readPayment(request, req);
  if (!pay) return paymentRequired(req, 'X-PAYMENT header is required');
  if (pay.bad) return paymentRequired(req, pay.bad);
  let v; try { v = await verifyFn(env, pay); } catch (_) { return J({ error: 'the payment could not be checked just now; nothing was charged, try again' }, 503); }
  if (!v.ok) return paymentRequired(req, 'payment not valid: ' + v.reason);
  let out; try { out = await run(); } catch (e) { out = { ok: false, status: 502, error: String(e && e.message || e).slice(0, 200) }; }
  if (!out || !out.ok) return J({ error: (out && out.error) || 'the work failed', paid: false, note: 'no payment was taken' }, (out && out.status) || 502);
  let s; try { s = await settleFn(env, pay); } catch (e) { s = { ok: false, reason: String(e && e.message || e) }; }
  if (!s.ok) return J({ error: 'the payment did not settle: ' + s.reason, paid: false, note: 'no payment was taken: try again' }, 402);
  try { await recordPayment(env, { tx: s.transaction, service: name, units: String(pay.payload.payload.authorization.value), network: s.network, payTo: w.address }); }
  catch (e) { console.log('[x402] settled ' + s.transaction + ' but not recorded: ' + String(e && e.message || e).slice(0, 200)); }
  const [h, val] = settlementHeader(pay.version, s);
  return J({ ...out.body, paid: true, transaction: s.transaction }, 200, { [h]: val });
}
