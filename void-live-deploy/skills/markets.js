/**
 * markets skill - Verse's crypto board: live prices and 7-day sparklines for the top coins, from Verse's own edge-cached
 * /api/markets (CoinGecko underneath, two-minute cache, no KV), and a read-only Bitcoin address lookup by public address
 * (mempool.space public API). Read-only by design: no wallets held, no keys or seed phrases, no trades, no advice.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }. Single-coin asks ("bitcoin price") stay with crypto.js.
 */
export const BTC_ADDR = /^(?:bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
export const SEED_WORDS = /\b(?:seed\s+phrase|private\s+key|recovery\s+phrase|mnemonic)\b/;
/** { board: true } | { addr } | { refuse } | null. Pure. */
export function marketsAsk(text) {
  const raw = String(text || '').trim(), t = raw.toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (SEED_WORDS.test(t) && /\b(?:my|here|is|store|keep|save|import|enter)\b/.test(t)) return { refuse: true };
  const a = raw.replace(/[?!.]+$/, '').match(/^(?:(?:look\s*up|check|show|lookup)\s+)?(?:(?:btc|bitcoin)\s+)?(?:wallet|address|balance(?:\s+of)?)\s+([a-zA-Z0-9]{26,64})$/i);
  if (a && BTC_ADDR.test(a[1])) return { addr: a[1] };
  if (/^(?:(?:show|open|give)\s+(?:me\s+)?)?(?:the\s+|a\s+)?(?:crypto(?:currency)?|coin|crypto\s+market|markets?)\s*(?:prices?|board|card|chart|charts|tracker|ticker|dashboard)?$/.test(t) && /crypto|coin|market/.test(t)) return { board: true };
  if (/^(?:how\s+(?:is|are)\s+(?:crypto|the\s+crypto\s+market)\s+(?:doing\s+)?(?:today)?|top\s+(?:crypto|coins|cryptocurrencies))$/.test(t)) return { board: true };
  return null;
}
export const DEFAULT_IDS = 'bitcoin,ethereum,solana,ripple,dogecoin,cardano,litecoin,binancecoin';
/** CoinGecko's row cut to what the card needs (the same cut as functions/api/markets.js slim). Pure. */
export function slimRow(row) {
  const sp = (row && row.sparkline_in_7d && row.sparkline_in_7d.price) || [], step = Math.max(1, Math.ceil(sp.length / 56));
  return { id: row.id, symbol: String(row.symbol || '').toUpperCase(), name: row.name, price: row.current_price, change24h: row.price_change_percentage_24h, spark: sp.filter((_, i) => i % step === 0) };
}
/** an SVG polyline path for a sparkline in a w×h box. Pure. */
export function sparkPath(vals, w = 120, h = 32) {
  const v = (vals || []).filter(Number.isFinite); if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  return v.map((x, i) => (i ? 'L' : 'M') + (i * w / (v.length - 1)).toFixed(1) + ' ' + (h - (x - lo) / span * (h - 2) - 1).toFixed(1)).join(' ');
}
const money = (v) => v == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: v < 1 ? 5 : 2 }).format(v);
async function run(text, api) {
  const { showPage, esc } = api; const q = marketsAsk(text);
  if (!q) return 'none';
  if (q.refuse) { showPage((el) => { el.innerHTML = '<h2>Keep that to yourself</h2><p>Never type a seed phrase or private key into any site, Verse included. Verse only reads public prices and public addresses; it never holds keys or funds.</p>'; }); return 'markets'; }
  if (q.addr) {
    const el = showPage((p) => { p.innerHTML = '<h2>Bitcoin address</h2><p class="g-sub">looking up…</p>'; }) || document.querySelector('.vpage');
    try {
      const j = await fetch('https://mempool.space/api/address/' + q.addr).then((r) => { if (!r.ok) throw 0; return r.json(); });
      const c = j.chain_stats || {}, sats = (c.funded_txo_sum || 0) - (c.spent_txo_sum || 0);
      el.innerHTML = '<h2>Bitcoin address</h2><p style="word-break:break-all;font-size:12px">' + esc(q.addr) + '</p><div style="font-size:40px;font-weight:300">' + (sats / 1e8).toLocaleString('en-US', { maximumFractionDigits: 8 }) + ' BTC</div><p>' + (c.tx_count || 0) + ' confirmed transactions</p><div class="src">Source: <a href="https://mempool.space/address/' + esc(q.addr) + '" target="_blank" rel="noopener">mempool.space</a> · public data, read-only · not advice</div>';
    } catch (_) { el.innerHTML = '<h2>Bitcoin address</h2><p>The lookup service didn\'t answer. Try again in a moment.</p>'; }
    return 'markets';
  }
  showPage((p) => { p.className += ' markets-card'; p.innerHTML = '<h2>Crypto</h2><p class="g-sub">loading prices…</p>'; });
  const el = document.querySelector('.vpage.markets-card') || document.querySelector('.vpage');
  try {
    let j = await fetch('/api/markets').then((r) => r.json()).catch(() => null);
    // CoinGecko refuses some calls from Cloudflare's network (live 2026-10-21: /api/markets got nothing); then the page asks
    // CoinGecko's same keyless public API itself, from the visitor's own connection (CORS is open), and slims it the same way
    if (!j || !j.ok || !j.coins || !j.coins.length) j = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + DEFAULT_IDS + '&sparkline=true&price_change_percentage=24h').then((r) => r.json()).then((rows) => ({ ok: Array.isArray(rows), coins: (Array.isArray(rows) ? rows : []).map(slimRow) }));
    if (!j.ok || !j.coins.length) throw 0;
    el.innerHTML = '<h2>Crypto</h2><div class="mk-rows">' + j.coins.map((c) => { const up = (c.change24h || 0) >= 0, col = up ? '#7fd6a0' : '#ff8a8a';
      return '<div class="mk-row" style="display:flex;align-items:center;gap:10px;margin:6px 0"><span style="width:52px;font-weight:600">' + esc(c.symbol) + '</span><span style="flex:1">' + esc(money(c.price)) + '</span>'
        + '<svg width="120" height="32" viewBox="0 0 120 32" aria-hidden="true"><path d="' + sparkPath(c.spark) + '" fill="none" stroke="' + col + '" stroke-width="1.5"/></svg>'
        + '<span style="width:64px;text-align:right;color:' + col + '">' + (c.change24h == null ? '' : (up ? '+' : '') + c.change24h.toFixed(2) + '%') + '</span></div>'; }).join('')
      + '</div><p class="g-sub" style="font-size:12px">7-day lines · 24-hour change · ask "bitcoin wallet &lt;address&gt;" to read a public address</p><div class="src">Source: <a href="https://www.coingecko.com/" target="_blank" rel="noopener">CoinGecko</a> · refreshed every 2 minutes · read-only · not financial advice</div>';
  } catch (_) { el.innerHTML = '<h2>Crypto</h2><p>The price service didn\'t answer just now. Ask again in a moment.</p>'; }
  return 'markets';
}
export default {
  name: 'markets',
  examples: ['crypto prices', 'crypto board', 'crypto card', 'top coins', 'bitcoin wallet bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'here is my seed phrase'],
  nearMisses: ['bitcoin price', 'stock market', 'what is crypto', 'price of ethereum in euros'],
  match(lower, text) { return !!marketsAsk(text || lower); },
  run,
};
