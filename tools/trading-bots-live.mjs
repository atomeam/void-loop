// The trading bots and the arbitrage scanner, checked on the live site (.github/workflows/trading-bots-live.yml, started by hand or by the
// thread that ships a change): the pages answer, the price history is there, the free scan reads real venues, and an unpaid call to each paid
// service answers 402 paying the wallet the catalog names. Read only: no payment is made, nothing is written. Exit 1 when an answer is wrong.
const base = process.argv[2] || 'https://a-to-mind.com';
const bad = [], out = {};
const get = async (p) => { const r = await fetch(base + p, { headers: { 'user-agent': 'Verse live check' } }); return { status: r.status, r }; };
for (const p of ['/trading-bots/', '/trading-bots/trend-50-200/', '/trading-bots/breakout-20-10/', '/trading-bots/dip-rsi2/', '/trading-bots/arbitrage/', '/trading-bots/kit/bot.mjs', '/trading-bots/kit/strategy.js', '/trading-bots/kit/arb.js']) {
  const { status } = await get(p); out[p] = status; if (status !== 200) bad.push(p + ' answered ' + status);
}
for (const pair of ['BTC-USD', 'ETH-USD']) {
  const { status, r } = await get('/trading-bots/data/' + pair + '.json');
  if (status !== 200) { bad.push(pair + ' data answered ' + status); continue; }
  const j = await r.json(); out[pair] = { days: j.rows.length, first: j.first, asOf: j.asOf, source: j.source };
  if (j.rows.length < 1000 || Date.now() - Date.parse(j.asOf) > 4 * 86400000) bad.push(pair + ' data is short or stale');
}
const a = await get('/api/arbitrage?coin=ETH'); const aj = await a.r.json().catch(() => ({}));
out.arbitrage = a.status === 200 ? { venues: Object.keys((aj.spread || {}).mids || {}), missing: aj.missing, best: aj.rows && aj.rows[0] && { buy: aj.rows[0].buy, sell: aj.rows[0].sell, net: aj.rows[0].net.toFixed(2) }, gasUsd: aj.gasUsd } : { status: a.status, error: aj.error };
if (a.status !== 200) bad.push('free scan answered ' + a.status);
const cat = await (await fetch(base + '/api/x402')).json();
for (const [id, body] of [['backtest', { bot: 'trend-50-200', pair: 'BTC-USD' }], ['arbitrage', { coin: 'BTC' }]]) {
  const s = (cat.services || []).find((x) => x.id === id); if (!s) { bad.push(id + ' is not in the catalog'); continue; }
  const r = await fetch(base + '/api/x402/' + id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})), acc = (j.accepts || [])[0] || {};
  out[id] = { status: r.status, price_usdc: s.price_usdc, payTo: acc.payTo || null, network: acc.network || null, amount: acc.maxAmountRequired || null };
  if (r.status !== 402) bad.push(id + ' unpaid call answered ' + r.status + ' (want 402)');
  else if (!cat.pay_to || String(acc.payTo).toLowerCase() !== String(cat.pay_to).toLowerCase() || acc.network !== 'base' || acc.maxAmountRequired !== '50000') bad.push(id + ' 402 does not ask for 0.05 USDC on Base to the catalog wallet');
}
console.log(JSON.stringify(out, null, 2));
if (bad.length) { console.error('trading bots live: ' + bad.join('; ')); process.exit(1); }
console.log('trading bots live: ok');
