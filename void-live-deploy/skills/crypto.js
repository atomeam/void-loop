/**
 * crypto skill — the price of a cryptocurrency now, from CoinGecko (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "bitcoin price", "price of ethereum in euros", "how much is solana".
 * Its card opens the Markets page on the same coin (data-page), and the Markets page's card asks for this one (lib/markets-card.js).
 */
import { COINS as LISTED } from '../lib/markets.js';
const COINS = { bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum', ether: 'ethereum', solana: 'solana', sol: 'solana', dogecoin: 'dogecoin', doge: 'dogecoin',
  cardano: 'cardano', ada: 'cardano', xrp: 'ripple', ripple: 'ripple', litecoin: 'litecoin', ltc: 'litecoin', tether: 'tether', usdt: 'tether', bnb: 'binancecoin', polkadot: 'polkadot', dot: 'polkadot', monero: 'monero', xmr: 'monero' };
const VS = { usd: 'usd', dollars: 'usd', dollar: 'usd', eur: 'eur', euros: 'eur', euro: 'eur', gbp: 'gbp', pounds: 'gbp', pound: 'gbp', jpy: 'jpy', yen: 'jpy',
  rupee: 'inr', rupees: 'inr', peso: 'mxn', pesos: 'mxn', yuan: 'cny', renminbi: 'cny', rmb: 'cny', won: 'krw', ruble: 'rub', rubles: 'rub', rouble: 'rub', roubles: 'rub',
  real: 'brl', reais: 'brl', rand: 'zar', lira: 'try', zloty: 'pln', franc: 'chf', francs: 'chf', shekel: 'ils', shekels: 'ils', baht: 'thb', ringgit: 'myr', rupiah: 'idr',
  dirham: 'aed', dirhams: 'aed', riyal: 'sar', riyals: 'sar', naira: 'ngn', hryvnia: 'uah', forint: 'huf', koruna: 'czk' };
// the fiat currencies CoinGecko's simple/price takes as vs_currencies, by their codes ("1 btc in inr")
const CODES = 'aed ars aud bdt bhd bmd brl cad chf clp cny czk dkk eur gbp gel hkd huf idr ils inr jpy krw kwd lkr mmk mxn myr ngn nok nzd php pkr pln rub sar sek sgd thb try twd uah usd vnd zar'.split(' ');
// the currency a word names, or null; a word it does not know is kept so the card can say the price is in dollars instead
const vsOf = (w) => (!w ? 'usd' : VS[w] || (CODES.includes(w) ? w : null));
/** the Markets page for a CoinGecko id ('/markets/?s=BTC'), or '' for a coin the page does not list. Pure. */
export function pageOfCoin(id) { const sym = Object.keys(LISTED).find((s) => LISTED[s][0] === id); return sym ? '/markets/?s=' + sym : ''; }
// other languages' price asks, said the English way ("precio del bitcoin", "prix du bitcoin", "preis von ethereum"). Pure.
export function priceEnglish(t) {
  return String(t || '').replace(/^[¿¡]+/, '')
    .replace(/^(?:(?:cu[aá]l\s+es\s+|quel\s+est\s+|qual\s+[eé]\s+|wie\s+(?:hoch\s+)?ist\s+|was\s+ist\s+)?(?:el\s+|le\s+|o\s+|il\s+|der\s+)?(?:precio|prix|pre[cç]o|prezzo|preis|kurs|cotizaci[oó]n|cours|cota[cç][aã]o)\s+(?:actual\s+|actuel\s+|atual\s+|attuale\s+|aktuelle?r?\s+)?(?:del?|du|des|de\s+la|do|da|della|dello|di|von|vom|f[uü]r)\s+(?:l[ae]?\s+|el\s+|l')?)/, 'price of ')
    .replace(/^(?:cu[aá]nto\s+(?:vale|cuesta)|combien\s+(?:vaut|co[uû]te)|quanto\s+(?:vale|custa|costa)|wie\s+viel\s+(?:kostet|ist))\s+(?:(?:el|un|le|un|o|um|il|der|ein)\s+)?/, 'how much is ')
    .replace(/^([a-z]{2,10})\s+(?:preis|precio|prix|pre[cç]o|prezzo|kurs)$/, '$1 price');
}
// a currency a word names and the coin side may skip the price word for ("eth to usd", "ethereum in dollars"): a known one only
const knownVs = (w) => (w ? VS[w] || (CODES.includes(w) ? w : null) : null);
const amountOf = (w) => (/^(?:one|a|an)$/.test(w) ? 1 : parseFloat(w));
export function coinOf(text) {
  const t = priceEnglish(String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ')).replace(/^convert\s+/, '');
  // "eth/usd", "btc-eur", "eth usd": a coin and a currency code, the way a trading pair is written
  const p = t.match(/^([a-z]{2,10})\s*[/-]\s*([a-z]{3})$|^([a-z]{2,10}) ([a-z]{3})$/);
  if (p && COINS[p[1] || p[3]] && CODES.includes(p[2] || p[4])) return { id: COINS[p[1] || p[3]], name: p[1] || p[3], vs: p[2] || p[4] };
  const m = t.match(/^(?:what(?:'s| is)\s+)?(?:the\s+)?(?:(?:current\s+)?price\s+of\s+|how\s+much\s+is\s+(?:one\s+|a\s+|1\s+)?)?([a-z]{2,10})(?:\s+(?:price|worth|value|now|today))*(?:\s+(?:in|to|into)\s+([a-z]{3,8}))?(?:\s+(?:now|today|right now))?$/);
  // "what is 1 bitcoin in dollars", "2 eth in euros", "convert 0.5 eth to usd", "how much is 3 solana": the amount is priced, not one coin
  const n = !m && t.match(/^(?:what(?:'s| is)\s+|how\s+much\s+(?:is|are)\s+)?(one|an?|\d+(?:\.\d+)?)\s+([a-z]{2,10})(?:\s+(?:in|to|into)\s+([a-z]{3,8}))?(?:\s+worth)?$/);
  if (n && COINS[n[2]] && (n[3] || /^(?:what|how)/.test(t))) {
    const amount = amountOf(n[1]), more = amount !== 1 ? { amount } : {};
    const vs = vsOf(n[3]) || vsOf(String(n[3] || '').replace(/s$/, ''));
    return vs ? { id: COINS[n[2]], name: n[2], vs, ...more } : { id: COINS[n[2]], name: n[2], vs: 'usd', unknown: n[3], ...more };
  }
  if (!m || !COINS[m[1]]) return null;
  // a price word, or a currency it is turned into ("eth to usd", "ethereum in dollars"); "what is bitcoin" names no price
  if (!/price|how much|worth|value/.test(t) && !knownVs(m[2])) return null;
  const vs = vsOf(m[2]);
  return vs ? { id: COINS[m[1]], name: m[1], vs } : { id: COINS[m[1]], name: m[1], vs: 'usd', unknown: m[2] };
}
// the ticker a CoinGecko id trades under ('ethereum' -> 'ETH'), from the Markets page's own list, or ''. Pure.
export const tickerOf = (id) => Object.keys(LISTED).find((s) => LISTED[s][0] === id) || '';
/**
 * Where a coin's price can come from, first choice first (exam prices: "how much is ethereum" hung on "…" for 17 s when CoinGecko,
 * the only source, did not answer the browser). CoinGecko from the visitor's own connection (with the 24 h change); then, 1.2 s
 * later or at once when it fails: Verse's own /api/markets (dollars only; CoinGecko from Cloudflare, else Yahoo Finance, kept two
 * minutes at the edge) and Coinbase's public spot price (no key). Each: { name, url, href, delay, read(json) -> { price, change, at } | null }. Pure.
 */
export function sourcesOf(q) {
  const sym = tickerOf(q.id), vs = q.vs, up = vs.toUpperCase();
  const list = [{ name: 'CoinGecko', href: 'https://www.coingecko.com/en/coins/' + q.id, delay: 0,
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=' + q.id + '&vs_currencies=' + vs + '&include_24hr_change=true&include_last_updated_at=true',
    read: (j) => { const row = j && j[q.id]; return row && row[vs] != null ? { price: Number(row[vs]), change: row[vs + '_24h_change'], at: row.last_updated_at ? row.last_updated_at * 1000 : 0 } : null; } }];
  if (sym && vs === 'usd') list.push({ name: 'Verse Markets', href: '/markets/?s=' + sym, delay: 1200, url: '/api/markets?w=' + sym,
    read: (j) => { const x = j && j.ok && Array.isArray(j.quotes) && j.quotes[0]; return x && x.ok ? { price: Number(x.price), change: x.source === 'CoinGecko' && Number.isFinite(x.pct) ? x.pct : null, at: Number(x.asOf) || 0, via: x.source } : null; } }); // Yahoo's move is from the last daily close, not 24 hours: not shown as one
  if (sym) list.push({ name: 'Coinbase', href: 'https://www.coinbase.com/price/' + (sym ? LISTED[sym][1].toLowerCase().replace(/\s+/g, '-') : ''), delay: 1200, url: 'https://api.coinbase.com/v2/prices/' + sym + '-' + up + '/spot',
    read: (j) => { const d = j && j.data; return d && String(d.currency || '').toUpperCase() === up ? { price: Number(d.amount), change: null, at: 0 } : null; } });
  return list;
}
/**
 * The first source that answers with a price: each starts after its delay, or at once when an earlier one failed; a source
 * that has not answered in `ms` is given up; once one wins, none of the rest is started. Resolves { price, change, at, source }
 * or rejects when every one failed. `wait(ms)` returns [promise, cancel] (a test passes its own clock).
 */
export function firstPrice(list, f, { ms = 6000, wait = (d) => { let h; return [new Promise((r) => { h = setTimeout(r, d); }), () => clearTimeout(h)]; } } = {}) {
  let done = false, kick; const kicked = new Promise((r) => { kick = r; }), stops = [];
  const one = async (s) => {
    if (s.delay) { const [w, stop] = wait(s.delay); stops.push(stop); await Promise.race([w, kicked]); }
    if (done) throw new Error('already answered');
    try {
      const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
      const r = await f(s.url, signal ? { signal } : {});
      if (r && r.ok === false) throw new Error('status ' + r.status);
      const v = s.read(await r.json());
      if (!v || !Number.isFinite(v.price) || v.price <= 0) throw new Error('no price');
      return { ...v, source: s };
    } catch (e) { kick(); throw e; }
  };
  return Promise.any(list.map(one)).then((v) => { done = true; kick(); stops.forEach((s) => s()); return v; });
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = coinOf(text);
  if (!q) return 'none';
  const nice = q.id.charAt(0).toUpperCase() + q.id.slice(1);
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(nice) + '</h2><div class="sub">…</div>'; const page = pageOfCoin(q.id); if (page && p.dataset) p.dataset.page = page; });
  try {
    const hit = await firstPrice(sourcesOf(q), (u, o) => fetch(u, o));
    if (!api._pageStill(el)) return 'crypto';
    const amount = q.amount || 1, v = hit.price * amount, ch = hit.change, src = hit.source;
    const fmt = (x) => new Intl.NumberFormat([], { style: 'currency', currency: q.vs.toUpperCase(), maximumFractionDigits: x < 1 ? 6 : 2 }).format(x);
    const at = hit.at ? new Date(hit.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    const sym = tickerOf(q.id) || nice;
    el.innerHTML = '<h2>' + esc(amount !== 1 ? amount + ' ' + sym : nice) + '</h2><div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(fmt(v)) + '</div>'
      + (amount !== 1 ? '<p>1 ' + esc(sym) + ' = ' + esc(fmt(hit.price)) + '</p>' : '')
      + (q.unknown ? '<p>Shown in US dollars: "' + esc(q.unknown) + '" is not a currency I can price in.</p>' : '')
      + (Number.isFinite(ch) ? '<p style="color:' + (ch >= 0 ? '#7fd6a0' : '#ff8a8a') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '% in 24 hours</p>' : '')
      + '<div class="src">Source: <a href="' + esc(src.href) + '" target="_blank" rel="noopener">' + esc(src.name) + '</a>' + (hit.via ? ' (' + esc(hit.via) + ')' : '') + (at ? ' · price at ' + esc(at) : '') + ' · not advice</div>';
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
