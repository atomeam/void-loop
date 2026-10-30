/**
 * stocks skill: the price of a stock, an ETF or a market index now, from Verse's own /api/markets (the same quote the Markets page shows).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "apple stock price", "TSLA stock", "stock price of nvidia", "aapl price", "how is the s&p 500 today". The card opens the Markets page on the
 * same symbol (data-page), and the Markets page's card asks for this one (lib/markets-card.js). Coins stay with crypto.js, currency pairs with
 * convert. A word that is only a ticker by accident ("beef stock" is broth) is a stock only when it is a name Markets knows or is typed as a
 * ticker (TSLA, $tsla). Read-only: no trades, no advice.
 */
import { resolve, NAMES, fmtPrice, fmtMove, fmtDay, sparkD } from '../lib/markets.js';

const SYMS = new Set(NAMES.map(([s]) => s));
// tickers that are also everyday words ("spot price" of gold, "uber price" of a ride, "cost price"): a stock only with a stock word or typed as a ticker
const WORDY = new Set(['COIN', 'SPOT', 'SHOP', 'DIS', 'SPY', 'UBER', 'META', 'COST', 'CRM']);
const STOCK_WORDS = '(?:stocks?|shares?|share price|stock price|stock quote|stock chart|stock value)';
const LEAD = "(?:what(?:'s| is| are)\\s+|how(?:'s| is| are)\\s+|show(?:\\s+me)?\\s+|check\\s+|look\\s*up\\s+)?(?:the\\s+)?(?:current\\s+|latest\\s+)?";
const TAIL = '(?:\\s+(?:price|quote|chart|now|today|right now|doing(?:\\s+today)?|trading at))*';
const FORMS = [
  new RegExp('^' + LEAD + '(?:stock|share)\\s+(?:price|quote|chart|value)\\s+(?:of|for)\\s+(.+?)' + TAIL + '$', 'i'),
  new RegExp('^' + LEAD + '(?:price|quote)\\s+(?:of|for)\\s+(.+?)\\s+(?:stock|shares?)' + TAIL + '$', 'i'),
  new RegExp('^' + LEAD + '(.+?)(?:\'s)?\\s+' + STOCK_WORDS + TAIL + '$', 'i'),
];
const TICKER_PRICE = new RegExp('^' + LEAD + '(\\$?[a-z]{1,5}(?:-[a-z])?(?:\\.[a-z]{1,2})?)\\s+(?:price|quote)' + TAIL + '$', 'i');
const INDEX_ASK = new RegExp('^' + LEAD + '(.+?)(?:\\s+index)?(?:\\s+(?:price|level|now|today|right now|doing(?:\\s+today)?|points|chart))+$', 'i');

// a typed ticker: TSLA, BRK-B, VOD.L, or any case after a dollar sign ($tsla)
const typedTicker = (w) => /^\$[a-z]{1,5}(?:-[a-z])?(?:\.[a-z]{1,2})?$/i.test(w) || /^[A-Z]{1,5}(?:-[A-Z])?(?:\.[A-Z]{1,2})?$/.test(w);

/** the stock or index a name in an ask means, or null: an index Markets lists, a company or ETF Markets knows by name, or a typed ticker. Pure. */
function stockOf(word, { tickerOnly = false } = {}) {
  const w = String(word || '').trim(); if (!w || w.length > 40) return null;
  const r = resolve(w.replace(/^\$/, '')); if (!r) return null;
  if (r.kind === 'index') return tickerOnly ? null : r;
  if (r.kind !== 'stock') return null; // coins and currency pairs belong to other cards
  if (typedTicker(w)) return r;
  if (!SYMS.has(r.sym)) return null; // a lowercase word that is only shaped like a ticker ("beef")
  // "apple price" can be fruit and "tesla price" a car: without a stock word only the ticker itself counts ("aapl price"), three letters up
  if (tickerOnly) return w.toUpperCase() === r.sym && r.sym.length >= 3 && !WORDY.has(r.sym) ? r : null;
  return r;
}

/** what a stock ask reads as: the resolved symbol ({ kind, sym, name, currency }), or null. Pure. */
export function stockAsk(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim(); if (!t || t.length > 80) return null;
  for (const re of FORMS) { const m = re.exec(t); if (m) { const r = stockOf(m[1]); if (r) return r; } }
  const p = TICKER_PRICE.exec(t); if (p) { const r = stockOf(p[1], { tickerOnly: true }); if (r) return r; }
  const i = INDEX_ASK.exec(t); if (i) { const r = resolve(i[1]); if (r && r.kind === 'index') return r; }
  return null;
}

/** the Markets page on the symbol ('/markets/?s=AAPL'). Pure. */
export const pageOfStock = (r) => '/markets/?s=' + encodeURIComponent(r.sym);
const KIND = { stock: 'Stock or ETF', index: 'Index' };

/** the card's inner HTML for a /api/markets answer. Pure. */
export function cardHtml(r, j, esc) {
  const name = (j && j.ok && j.name) || r.name || r.sym, head = '<h2>' + esc(name) + '</h2>';
  const sub = '<div class="sub">' + esc(r.sym + ' · ' + KIND[r.kind] + (r.currency && r.currency !== 'pts' ? ' · ' + ((j && j.currency) || r.currency) : '')) + '</div>';
  if (!j || !j.ok || j.price == null) {
    const say = j && j.ok && j.note ? j.note : (j && j.say) || 'The price sources did not answer just now. Ask again in a moment, or open Markets for the chart.';
    return head + sub + '<p>' + esc(say) + '</p>';
  }
  const up = (j.change || 0) >= 0, col = up ? '#7fd6a0' : '#ff8a8a', vals = (j.points || []).map((p) => p[1]), d = sparkD(vals, 240, 48);
  return head + sub
    + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(fmtPrice(j.price)) + '</div>'
    + (j.change != null ? '<p style="color:' + col + '">' + (up ? '▲ ' : '▼ ') + esc(fmtMove(j.change, j.pct)) + ' on the day</p>' : '')
    + (d ? '<svg width="240" height="48" viewBox="0 0 240 48" role="img" aria-label="The last five days"><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.5"/></svg>' : '')
    + '<div class="src">Source: ' + esc(j.source || 'Markets') + ' · data may be delayed' + (j.asOf ? ' · as of ' + esc(fmtDay(j.asOf)) : '') + ' · not advice</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const r = stockAsk(text);
  if (!r) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(r.name || r.sym) + '</h2><div class="sub">…</div>'; if (p.dataset) p.dataset.page = pageOfStock(r); });
  let j = null;
  try { j = await fetch('/api/markets?s=' + encodeURIComponent(r.sym) + '&r=5d').then((x) => x.json()); } catch (_) { j = null; }
  if (!api._pageStill(el)) return 'stocks';
  el.innerHTML = cardHtml(r, j, esc);
  return j && j.ok && j.price != null ? 'stocks' : 'none';
}

export default {
  name: 'stocks',
  examples: ['apple stock price', 'TSLA stock', 'stock price of nvidia', 'aapl price', 'how is the s&p 500 today', 'how is the dow doing'],
  nearMisses: ['stock market', 'beef stock', 'chicken stock recipe', 'apple price', 'bitcoin price', 'buy stock', 'what is a stock', 'eur usd'],
  match(lower, text) { return !!stockAsk(text || lower); },
  run,
};
