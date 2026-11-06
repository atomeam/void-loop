// Verse's pay-per-call API, checked on the live site (.github/workflows/x402-live.yml, after every main deploy): the catalog, an
// unpaid call (402 with requirements that pay Verse's wallet, or 503 when no wallet exists yet: nothing is charged either way) and the
// treasury's wallet view. Read-only: no payment is made, nothing is written. Exit 1 only when an answer is wrong.
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
console.log(JSON.stringify(out, null, 2));
if (bad.length) { console.error('x402 live: ' + bad.join('; ')); process.exit(1); }
console.log('x402 live: ok (' + (r.status === 402 ? 'open, paying ' + cat.pay_to : 'closed until Verse has a wallet') + ')');
