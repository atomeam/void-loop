/**
 * crypto skill — the price of a cryptocurrency now, from CoinGecko (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "bitcoin price", "price of ethereum in euros", "how much is solana".
 */
const COINS = { bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', ether: 'ethereum', solana: 'solana', sol: 'solana', dogecoin: 'dogecoin', doge: 'dogecoin',
  cardano: 'cardano', ada: 'cardano', xrp: 'ripple', ripple: 'ripple', litecoin: 'litecoin', ltc: 'litecoin', tether: 'tether', usdt: 'tether', bnb: 'binancecoin', polkadot: 'polkadot', dot: 'polkadot', monero: 'monero', xmr: 'monero' };
const VS = { usd: 'usd', dollars: 'usd', dollar: 'usd', eur: 'eur', euros: 'eur', euro: 'eur', gbp: 'gbp', pounds: 'gbp', pound: 'gbp', jpy: 'jpy', yen: 'jpy' };
export function coinOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:what(?:'s| is)\s+)?(?:the\s+)?(?:(?:current\s+)?price\s+of\s+|how\s+much\s+is\s+(?:one\s+|a\s+|1\s+)?)?([a-z]{2,10})(?:\s+(?:price|worth|value|now|today))*(?:\s+in\s+([a-z]{3,7}))?$/);
  if (!m || !COINS[m[1]]) return null;
  if (!/price|how much|worth|value/.test(t)) return null;
  return { id: COINS[m[1]], name: m[1], vs: VS[m[2]] || 'usd' };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = coinOf(text);
  if (!q) return 'none';
  const nice = q.id.charAt(0).toUpperCase() + q.id.slice(1);
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(nice) + '</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + q.id + '&vs_currencies=' + q.vs + '&include_24hr_change=true&include_last_updated_at=true').then((r) => r.json());
    if (!api._pageStill(el)) return 'crypto';
    const row = j && j[q.id];
    if (!row || row[q.vs] == null) throw 0;
    const v = row[q.vs], ch = row[q.vs + '_24h_change'];
    const money = new Intl.NumberFormat([], { style: 'currency', currency: q.vs.toUpperCase(), maximumFractionDigits: v < 1 ? 6 : 2 }).format(v);
    const at = row.last_updated_at ? new Date(row.last_updated_at * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    el.innerHTML = '<h2>' + esc(nice) + '</h2><div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(money) + '</div>'
      + (ch != null ? '<p style="color:' + (ch >= 0 ? '#7fd6a0' : '#ff8a8a') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '% in 24 hours</p>' : '')
      + '<div class="src">Source: <a href="https://www.coingecko.com/en/coins/' + q.id + '" target="_blank" rel="noopener">CoinGecko</a>' + (at ? ' · price at ' + esc(at) : '') + ' · not advice</div>';
    return 'crypto';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(nice) + '</h2><p>The price service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'crypto',
  examples: ['bitcoin price', 'how much is bitcoin', 'what is ethereum worth in euros'],
  nearMisses: ['what is bitcoin', 'who invented bitcoin', '100 usd in eur'],
  match(lower, text) { return !!coinOf(text); },
  run
};
