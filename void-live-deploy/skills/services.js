/**
 * services skill — what Void sells, with prices, and a Buy link for what is on sale.
 * "pricing", "what do you sell", "hire you", "fix my automation", "what does void cost".
 * The rows come from lib/products.js (the ones with a price: the hands-on services). The card reads the live store
 * (/api/catalog) for each row it can match by slug, so the shown price and link are Gumroad's own and never drift;
 * the row's price is the fallback when the catalog is unreachable. A row with no slug and no live match is not on
 * sale yet and gives the email. Prices stay manual: Adam sets them on Gumroad.
 */
import { PRODUCTS, forSale, buyUrl } from '../lib/products.js';
import { priceText } from '../lib/gumroad.js';

export const SERVICES = PRODUCTS.filter((p) => p.price);
export const CONTACT = 'atom@a-to-mind.com';

export function servicesOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (!t) return null;
  if (/^(?:(?:your |the |show (?:me )?(?:your |the )?)?pricing|price list|prices|what do you sell|what do you offer|what(?:'s| is) for sale|what can i buy(?: here)?)$/.test(t)) return { why: 'pricing' };
  if (/^(?:what does void cost|how much (?:does void|is void|do you) cost|how much is void|what do you cost)$/.test(t)) return { why: 'cost' };
  if (/^(?:(?:can|how do) i hire you|hire you|i(?: want|'d like) to hire you|hire void)$/.test(t)) return { why: 'hire' };
  if (/^(?:fix my automations?|(?:my|our) automations? (?:is |are )?(?:broken?|stopped(?: working)?|down)|repair my automation|my (?:zap|workflow) (?:broke|is broken|stopped working)|fix my zap)$/.test(t)) return { why: 'fix' };
  return null;
}

// The live store's row for a service, matched by its Gumroad slug (the catalog may know it by slug or by its /l/ url).
export function liveRowFor(p, products) {
  const s = p.gumroad.slug;
  if (!s || !Array.isArray(products)) return null;
  return products.find((x) => x && (x.slug === s || String(x.url || '').endsWith('/l/' + s))) || null;
}

// One service as a card row: the live price and link when the store answered, the row's own as fallback.
// esc is the page's own escaper (api.esc).
export function rowHtml(p, esc, live) {
  const price = live ? priceText(live) : p.price;
  const url = live && live.available !== false && live.url ? live.url : (!live && forSale(p) ? buyUrl(p) : '');
  const base = '<b>' + esc(p.name) + '</b> · ' + esc(price) + ' — ' + esc(p.adds);
  if (url) return base + ' · <a href="' + esc(url) + '" target="_blank" rel="noopener">Buy</a>';
  return base + ' · not on sale yet, email <a href="mailto:' + CONTACT + '">' + CONTACT + '</a>';
}

export function cardHtml(esc, catalog) {
  const lis = SERVICES.map((p) => '<li>' + rowHtml(p, esc, liveRowFor(p, catalog)) + '</li>').join('');
  return '<h2>What Void sells</h2><ul>' + lis + '</ul>'
    + '<p class="sub">Also: <a href="https://a-to-mind.com/code-review/" target="_blank" rel="noopener">Void Code Review Pro</a>,'
    + ' and your own custom Void for $49 a month. A fix starts when you reply to your receipt with what broke.</p>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = servicesOf(text);
  if (!q) return 'none';
  // the fallback card first, so the page never waits on the store; the live prices land over it when the catalog answers
  const el = showPage((p) => { p.innerHTML = cardHtml(esc, null); });
  try {
    const r = await fetch('/api/catalog');
    const j = r.ok ? await r.json() : null;
    const catalog = j && Array.isArray(j.products) ? j.products : null;
    if (catalog && api._pageStill(el)) el.innerHTML = cardHtml(esc, catalog);
  } catch (_) { /* offline or no catalog: the fallback card stands */ }
  return 'services';
}

export default {
  name: 'services',
  examples: ['pricing', 'what do you sell', 'hire you', 'fix my automation', 'what does void cost'],
  nearMisses: ['price of gold', 'fix my code', 'hire a plumber', 'what can you do', 'price of bitcoin'],
  match(lower, text) { return !!servicesOf(text); },
  run
};
