// Verse's pay-per-call API, checked on the live site (.github/workflows/x402-live.yml, after every main deploy): the catalog, an
// unpaid call (402 with requirements that pay Verse's wallet, or 503 when no wallet exists yet: nothing is charged either way) and the
// treasury's wallet view, then every paid service in the catalog: GET (the Bazaar probe) answers 402 paying the same wallet on Base,
// and an empty POST is refused with 400 before any payment. Read-only: no payment is made, nothing is written. Exit 1 only when an
// answer is wrong.
import { VERSE_WALLET } from '../void-live-deploy/lib/verse-wallet-address.js';
const base = process.argv[2] || 'https://a-to-mind.com';
const BUGGY = 'function f(x) {\n  if (x = 5) { return eval(x); }\n}';
const bad = [];
const cat = await (await fetch(base + '/api/x402')).json();
const r = await fetch(base + '/api/x402/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: BUGGY }) });
const body = await r.json().catch(() => ({}));
const t = await (await fetch(base + '/api/treasury')).json().catch(() => ({}));
const out = { catalog: { pay_to: cat.pay_to, facilitator: cat.facilitator, services: (cat.services || []).map((s) => ({ id: s.id, price_usdc: s.price_usdc, open: s.open })) },
  unpaid_call: { status: r.status, error: body.error || null }, treasury_wallet: t.wallet || null, treasury_usdc: (t.revenue || {}).usdc || null };
if (r.status === 402) {
  const a = (body.accepts || [])[0] || {};
  out.unpaid_call.requirements = { network: a.network, amount: a.maxAmountRequired, asset: a.asset, payTo: a.payTo };
  if (!r.headers.get('payment-required')) bad.push('402 without the v2 PAYMENT-REQUIRED header');
  if (a.network !== 'base' || a.scheme !== 'exact') bad.push('402 does not ask for exact USDC on Base');
  if (!cat.pay_to || String(a.payTo).toLowerCase() !== String(cat.pay_to).toLowerCase()) bad.push('402 pays an address the catalog does not name');
  if (!t.wallet || String(t.wallet.address).toLowerCase() !== String(cat.pay_to).toLowerCase()) bad.push('the treasury shows a different wallet');
} else if (r.status === 503) {
  if (cat.pay_to && /wallet/.test(body.error || '')) bad.push('503 says no wallet, but the catalog names one');
} else bad.push('unpaid call answered ' + r.status + ' (want 402, or 503 before a wallet exists)');
if (VERSE_WALLET && cat.pay_to && cat.pay_to.toLowerCase() !== VERSE_WALLET.toLowerCase()) bad.push('the catalog pays ' + cat.pay_to + ', not the repo address ' + VERSE_WALLET);
out.services = [];
for (const s of cat.services || []) {
  const g = await fetch(s.url), row = { id: s.id, get: g.status };
  if (g.status === 402) {
    let v2 = null; try { v2 = JSON.parse(atob(g.headers.get('payment-required') || '')); } catch (_) {}
    const a = (v2 && v2.accepts && v2.accepts[0]) || {};
    row.payTo = a.payTo; row.network = a.network; row.amount = a.amount; row.bazaar = !!(v2 && v2.extensions && v2.extensions.bazaar);
    if (!cat.pay_to || String(a.payTo).toLowerCase() !== cat.pay_to.toLowerCase() || a.network !== 'eip155:8453') bad.push(s.id + ': GET 402 does not pay the catalog wallet on Base');
  } else if (!(g.status === 503 && !cat.pay_to)) bad.push(s.id + ': GET answered ' + g.status + ' (want 402)');
  const e = await fetch(s.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  row.empty_post = e.status;
  if (s.id !== 'review' && e.status !== 400) bad.push(s.id + ': an empty POST answered ' + e.status + ' (want 400, refused before any payment)');
  out.services.push(row);
}
console.log(JSON.stringify(out, null, 2));
if (bad.length) { console.error('x402 live: ' + bad.join('; ')); process.exit(1); }
console.log('x402 live: ok (' + (r.status === 402 ? 'open, paying ' + cat.pay_to : 'closed until Verse has a wallet') + ')');
