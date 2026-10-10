/**
 * services skill — what Void sells, with prices, and a Buy link for what is on sale.
 * "pricing", "what do you sell", "hire you", "fix my automation", "what does void cost".
 * The rows come from lib/products.js (the ones with a price: the hands-on services). A row with a Gumroad slug links
 * to the checkout; one without says it is not on sale yet and gives the email. Prices stay manual: Adam sets them.
 */
import { PRODUCTS, forSale, buyUrl } from '../lib/products.js';

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

// One service as a card row. esc is the page's own escaper (api.esc).
export function rowHtml(p, esc) {
  const base = '<b>' + esc(p.name) + '</b> · ' + esc(p.price) + ' — ' + esc(p.adds);
  if (forSale(p)) return base + ' · <a href="' + esc(buyUrl(p)) + '" target="_blank" rel="noopener">Buy</a>';
  return base + ' · not on sale yet, email <a href="mailto:' + CONTACT + '">' + CONTACT + '</a>';
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = servicesOf(text);
  if (!q) return 'none';
  const lis = SERVICES.map((p) => '<li>' + rowHtml(p, esc) + '</li>').join('');
  showPage((p) => {
    p.innerHTML = '<h2>What Void sells</h2><ul>' + lis + '</ul>'
      + '<p class="sub">Also: <a href="https://a-to-mind.com/code-review/" target="_blank" rel="noopener">Void Code Review Pro</a>,'
      + ' and your own custom Void for $49 a month. A fix starts when you reply to your receipt with what broke.</p>';
  });
  return 'services';
}

export default {
  name: 'services',
  examples: ['pricing', 'what do you sell', 'hire you', 'fix my automation', 'what does void cost'],
  nearMisses: ['price of gold', 'fix my code', 'hire a plumber', 'what can you do', 'price of bitcoin'],
  match(lower, text) { return !!servicesOf(text); },
  run
};
