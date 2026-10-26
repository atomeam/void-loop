/**
 * shop skill - made with tools/new-skill.mjs (docs/UPGRADING.md); Versus' shopping floor (2026-10-26). "shopping", "track 1Z999AA10123456784", "barcode 3017624010701",
 * "compare prices of oat milk", "wish list" answer with a card that opens the shopping page that does it, with the number or the words in the link (lib/shop-sites.js
 * shopAskOf, the same ask the tool pages' ask bar routes). A tracking number is matched to its carrier on the card itself, from its format and check digit. Verse does not
 * stock or ship goods and the card says so; "store" and "shopping list" stay with the store and list cards, which answer before this one.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { shopAskOf } from '../lib/shop-sites.js';
import { detectCarrier } from '../lib/shop-core.js';
const TOOLS = [['/shop/', 'Shopping', 'product lookup, store searches, list and cart, parcels, prices'], ['/shop/track/', 'Package tracker', 'the carrier from the number, its own page'], ['/shop/barcode/', 'Barcode lookup', 'UPC, EAN, ISBN and the open product databases'], ['/shop/product/', 'Product lookup', 'by name, then on the stores'], ['/shop/list/', 'Shopping list', 'quantities, prices, totals by store'], ['/shop/wishlist/', 'Wish lists', 'shared by link, marked as bought'], ['/shop/parcels/', 'Parcel tracking', 'many numbers, return windows']];
function run(text, api) {
  const { showPage, esc } = api, to = shopAskOf(String(text || '').trim()) || '/shop/', n = (to.match(/[?&]track=([^&#]+)/) || [])[1], c = n ? detectCarrier(decodeURIComponent(n))[0] : null;
  showPage((el) => {
    el.dataset.page = to.replace(/[?#].*$/, '');
    el.innerHTML = '<h2>Shopping</h2>' // void-review: ok: fixed text
      + (c ? '<p><b>' + esc(decodeURIComponent(n)) + '</b> is ' + esc(c.name) + ' (' + esc(c.sure === 'check digit' ? 'its check digit is right' : c.sure === 'bad check digit' ? 'but its check digit is wrong: a typo?' : 'by its format') + '). <a href="' + esc(c.url) + '" rel="noopener noreferrer" target="_blank">Track it on ' + esc(c.name) + ' →</a></p>' : '') // void-review: ok: escaped
      + '<p>Verse does not stock or ship goods: it finds products in the open product databases, opens your search on the stores, keeps your list, cart, parcels and prices on your device, and opens each parcel on its carrier’s own page.</p>'
      + '<p><a href="' + esc(to) + '" style="font-weight:600">Open the page →</a></p><ul style="padding-left:18px;margin:6px 0">' + TOOLS.map(([h, nm, d]) => '<li><a href="' + h + '">' + esc(nm) + '</a>: ' + esc(d) + '</li>').join('') + '</ul>' // void-review: ok: fixed text and escaped
      + '<div class="src">Made by Verse · product data from Open Food Facts and its sister projects (ODbL) · as of 2026-10</div>';
  });
  return 'shop';
}
export default {
  name: 'shop',
  examples: ['shopping', 'track 1Z999AA10123456784', 'barcode 3017624010701', 'compare prices of oat milk', 'wish list'],
  nearMisses: ['a store', 'shopping list', 'track my run', 'what is a barcode'],
  match(lower) { const t = String(lower || '').trim(); return !/^(?:shopping|grocery) list$/i.test(t) && !!shopAskOf(t); }, // the list card keeps "shopping list"
  run,
};
