/**
 * shop-core: the pure logic of the shopping pages (/shop/ and one page per site of the shopping lane, lib/shop-sites.js; Versus' shopping floor, leader Amazon).
 * Verse does not stock or ship goods: these pages help a person shop elsewhere. Parcel numbers are matched to their carrier by the carriers' published formats and
 * check digits and opened on that carrier's own tracking page (no carrier status is read or scraped); barcodes are checked (GS1 check digit, ISBN) and looked up in
 * the open product databases (Open Food Facts and its sister projects, ODbL); a list and cart is totalled on the device with tax and shipping by store; store
 * searches open on the stores from a closed list of address templates, each labelled with how sure its pattern is. Money is kept in whole cents. Pure: no DOM, no
 * network. Tests: tools/shop.test.mjs.
 */

// ---------- check digits ----------
const digits = (s) => [...String(s)].map(Number);
/** GS1 mod 10 (EAN-8, UPC-A, EAN-13, GTIN-14, SSCC, USPS IMpb): weights 3 and 1 from the right of the body. The check digit for a body. Pure. */
export function gs1Digit(body) { const d = digits(body).reverse(); let s = 0; d.forEach((v, i) => { s += v * (i % 2 === 0 ? 3 : 1); }); return (10 - (s % 10)) % 10; }
/** true when a whole GS1 number (body + check digit) is right. Pure. */
export const gs1Ok = (code) => /^\d{8,22}$/.test(String(code)) && gs1Digit(String(code).slice(0, -1)) === +String(code).slice(-1);
/** UPS 1Z: the 15 characters after 1Z, letters as (code - 63) mod 10, odd places once and even places twice; check = (10 - sum mod 10) mod 10. Pure. */
export function upsOk(n) {
  const m = /^1Z([0-9A-Z]{15})([0-9])$/.exec(String(n)); if (!m) return false;
  let s = 0; [...m[1]].forEach((c, i) => { const v = /\d/.test(c) ? +c : (c.charCodeAt(0) - 63) % 10; s += i % 2 === 0 ? v : v * 2; });
  return (10 - (s % 10)) % 10 === +m[2];
}
/** UPU S10 (international post: two letters, 8 digits, a check digit, the country): weights 8 6 4 2 3 5 9 7, 11 - sum mod 11, 10 -> 0, 11 -> 5. Pure. */
export function s10Ok(n) {
  const m = /^([A-Z]{2})(\d{8})(\d)([A-Z]{2})$/.exec(String(n)); if (!m) return false;
  const w = [8, 6, 4, 2, 3, 5, 9, 7]; let s = 0; digits(m[2]).forEach((v, i) => { s += v * w[i]; });
  let c = 11 - (s % 11); if (c === 10) c = 0; else if (c === 11) c = 5; return c === +m[3];
}
/** FedEx Express (12 digits): the first 11 weighted 3 1 7 from the left, sum mod 11, mod 10. Pure. */
export function fedex12Ok(n) { if (!/^\d{12}$/.test(String(n))) return false; const w = [3, 1, 7]; let s = 0; digits(String(n).slice(0, 11)).forEach((v, i) => { s += v * w[i % 3]; }); return (s % 11) % 10 === +String(n)[11]; }
/** DHL Express (10 digits): the first nine as a number, mod 7, is the last digit. Pure. */
export const dhl10Ok = (n) => /^\d{10}$/.test(String(n)) && Number(String(n).slice(0, 9)) % 7 === +String(n)[9];

// ---------- carriers ----------
// `check` says how sure the tracking address pattern is: 'partly' where the path was found in the carrier's own help or a guide on 2026-10-26 but the parameter was not,
// 'unconfirmed' where neither was (the builder's network was closed; a search was the only source). Each opens the carrier's own page with the number in it; nothing is read back.
const e = encodeURIComponent;
export const CARRIERS = Object.freeze({
  ups: { name: 'UPS', url: (n) => 'https://www.ups.com/track?tracknum=' + e(n), check: 'partly', note: 'the /track path is UPS\'s own tracking page; the tracknum parameter is not confirmed' },
  usps: { name: 'USPS', url: (n) => 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + e(n), check: 'partly', note: 'the TrackConfirmAction page is USPS\'s own; the tLabels parameter is not confirmed' },
  fedex: { name: 'FedEx', url: (n) => 'https://www.fedex.com/fedextrack/?trknbr=' + e(n), check: 'partly', note: 'the fedextrack path is FedEx\'s own; the trknbr parameter is not confirmed' },
  dhl: { name: 'DHL Express', url: (n) => 'https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  dhlde: { name: 'DHL Paket / Deutsche Post', url: (n) => 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  royalmail: { name: 'Royal Mail', url: (n) => 'https://www.royalmail.com/track-your-item#/tracking-results/' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  canadapost: { name: 'Canada Post', url: (n) => 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  amazon: { name: 'Amazon Logistics', url: (n) => 'https://track.amazon.com/tracking/' + e(n), check: 'unconfirmed', note: 'not confirmed; Amazon also shows it under Your Orders' },
  ontrac: { name: 'OnTrac', url: (n) => 'https://www.ontrac.com/tracking/?number=' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  dpd: { name: 'DPD', url: (n) => 'https://tracking.dpd.de/status/en_US/parcel/' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  gls: { name: 'GLS', url: (n) => 'https://gls-group.com/track/' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  evri: { name: 'Evri', url: (n) => 'https://www.evri.com/track/parcel/' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  postnl: { name: 'PostNL', url: (n) => 'https://jouw.postnl.nl/track-and-trace/' + e(n), check: 'unconfirmed', note: 'not confirmed; PostNL may ask for the postcode' },
  auspost: { name: 'Australia Post', url: (n) => 'https://auspost.com.au/mypost/track/details/' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  chinapost: { name: 'China Post / EMS', url: (n) => 'https://www.ems.com.cn/qps/yjcx?mailNum=' + e(n), check: 'unconfirmed', note: 'not confirmed' },
  laposte: { name: 'La Poste / Colissimo', url: (n) => 'https://www.laposte.fr/outils/suivre-vos-envois?code=' + e(n), check: 'unconfirmed', note: 'not confirmed' },
});
// the post of the country an S10 number ends with (the sender's post; the receiving country's post usually tracks it too)
const S10_POST = { US: 'usps', GB: 'royalmail', CA: 'canadapost', DE: 'dhlde', AU: 'auspost', CN: 'chinapost', FR: 'laposte', NL: 'postnl' };
/** a tracking number as typed, cleaned: spaces, dashes and dots out, upper case. Pure. */
export const cleanNumber = (s) => String(s || '').toUpperCase().replace(/[\s\-.]/g, '').replace(/[^0-9A-Z]/g, '').slice(0, 40);
/**
 * the carriers a tracking number can belong to, best first: [{ id, name, url, check, sure, why }]. `sure` is 'check digit' when the number's own check digit is right
 * for that carrier, 'format' when only its shape fits, 'bad check digit' when the shape fits but the check digit does not (likely a typo). [] when nothing fits. Pure.
 */
export function detectCarrier(raw) {
  const n = cleanNumber(raw), out = [], add = (id, sure, why) => { if (!out.some((x) => x.id === id)) out.push({ id, name: CARRIERS[id].name, url: CARRIERS[id].url(n), check: CARRIERS[id].check, note: CARRIERS[id].note, sure, why }); };
  if (n.length < 8) return [];
  let m;
  if (/^1Z[0-9A-Z]{16}$/.test(n)) add('ups', upsOk(n) ? 'check digit' : 'bad check digit', 'UPS numbers are 1Z and 16 letters or digits');
  if ((m = /^[A-Z]{2}\d{9}([A-Z]{2})$/.exec(n))) { const post = S10_POST[m[1]]; const ok = s10Ok(n); if (post) add(post, ok ? 'check digit' : 'bad check digit', 'an international postal number (UPU S10) from ' + m[1]); else add('usps', ok ? 'format' : 'bad check digit', 'an international postal number (UPU S10) from ' + m[1] + ': track it with the post of either country'); }
  if (/^TB[ACM]\d{12}$/.test(n)) add('amazon', 'format', 'Amazon Logistics numbers are TBA, TBC or TBM and 12 digits');
  if (/^[CD]\d{14}$/.test(n)) add('ontrac', 'format', 'OnTrac numbers are C or D and 14 digits');
  if (/^\d+$/.test(n)) {
    const L = n.length;
    // USPS Intelligent Mail package barcode: 20 to 22 digits starting 91 to 95 (or 420 and a ZIP code before it), GS1 mod 10
    const body = /^420\d{5}(\d{20,22})$/.exec(n) ? n.replace(/^420\d{5}/, '') : /^420\d{9}(\d{20,22})$/.exec(n) ? n.replace(/^420\d{9}/, '') : n;
    if (/^9[1-5]\d{18,20}$/.test(body)) add('usps', gs1Ok(body) ? 'check digit' : 'bad check digit', 'USPS package numbers are 20 to 22 digits starting 91 to 95');
    if (L === 12) add('fedex', fedex12Ok(n) ? 'check digit' : 'format', 'FedEx Express numbers are 12 digits');
    if (L === 15 || (L === 20 && /^96/.test(n)) || (L === 22 && /^96/.test(n))) add('fedex', 'format', 'FedEx Ground numbers are 15 digits (or 20 or 22 starting 96)');
    if (L === 10) add('dhl', dhl10Ok(n) ? 'check digit' : 'format', 'DHL Express waybills are 10 digits');
    if (L === 16) { add('canadapost', 'format', 'Canada Post domestic numbers are 16 digits'); add('evri', 'format', 'Evri numbers are 16 characters'); }
    if (L === 14) add('dpd', 'format', 'DPD parcel numbers are 14 digits');
    if (L === 11 || L === 12) add('gls', 'format', 'GLS parcel numbers are 11 or 12 digits');
    if (L === 12 || L === 20) add('dhlde', 'format', 'DHL Paket numbers are 12 or 20 digits');
  }
  if (/^3S[A-Z]{4}\d{6,10}$/.test(n)) add('postnl', 'format', 'PostNL numbers start 3S');
  const rank = { 'check digit': 0, format: 1, 'bad check digit': 2 };
  return out.map((x, i) => [x, i]).sort((a, b) => rank[a[0].sure] - rank[b[0].sure] || a[1] - b[1]).map((p) => p[0]);
}

// ---------- barcodes ----------
/**
 * a barcode as typed, read: { code (the GTIN, 8, 12, 13 or 14 digits, an ISBN-10 turned into its ISBN-13), kind, valid, want (the right check digit), isbn10? }, or
 * null when it is not a barcode. Pure.
 */
export function readBarcode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
  if (/^\d{9}[\dX]$/.test(s)) { // ten characters: only an ISBN-10 is written that way (no GTIN has ten digits)
    const ok = isbn10Ok(s), b = '978' + s.slice(0, 9), code = b + gs1Digit(b); return { code, kind: 'ISBN-10', valid: ok, want: null, isbn10: s };
  }
  if (!/^\d{8}$|^\d{12,14}$/.test(s)) return null;
  const kind = s.length === 8 ? 'EAN-8' : s.length === 12 ? 'UPC-A' : s.length === 14 ? 'GTIN-14' : /^97[89]/.test(s) ? 'ISBN-13' : 'EAN-13';
  const want = gs1Digit(s.slice(0, -1)); return { code: s, kind, valid: want === +s.slice(-1), want };
}
/** ISBN-10: weights 10 down to 1, X is 10, the sum divides by 11. Pure. */
export function isbn10Ok(s) { const t = String(s).toUpperCase(); if (!/^\d{9}[\dX]$/.test(t)) return false; let sum = 0; [...t].forEach((c, i) => { sum += (c === 'X' ? 10 : +c) * (10 - i); }); return sum % 11 === 0; }
/** the codes to ask a product database for: the code, and for a UPC-A its EAN-13 with a leading 0 (Open Food Facts files many under 13 digits). Pure. */
export const lookupCodes = (b) => (!b ? [] : b.kind === 'UPC-A' ? [b.code, '0' + b.code] : b.kind === 'EAN-13' && b.code[0] === '0' ? [b.code, b.code.slice(1)] : [b.code]);
// the open product databases: one API (Open Food Facts' Product Opener), ODbL for the database, Database Contents License for each row, images CC BY-SA. Their rate
// limits (product reads 15 a minute, searches 10 a minute, per address) are the visitor's own, since the visitor's browser asks.
export const PRODUCT_DBS = Object.freeze([
  { id: 'off', name: 'Open Food Facts', host: 'https://world.openfoodfacts.org', kind: 'food' },
  { id: 'opf', name: 'Open Products Facts', host: 'https://world.openproductsfacts.org', kind: 'products' },
  { id: 'obf', name: 'Open Beauty Facts', host: 'https://world.openbeautyfacts.org', kind: 'beauty' },
]);
export const PRODUCT_FIELDS = 'code,product_name,generic_name,brands,quantity,categories,image_small_url,image_front_small_url,nutriscore_grade,labels,countries,stores';
/** the address that reads one product from a database. Pure. */
export const productUrl = (db, code) => db.host + '/api/v2/product/' + encodeURIComponent(code) + '.json?fields=' + PRODUCT_FIELDS;
/** the address that searches a database by name (its simple full-text search, 12 rows). Pure. */
export const searchUrl = (db, q) => db.host + '/cgi/search.pl?search_terms=' + encodeURIComponent(String(q).slice(0, 80)) + '&search_simple=1&action=process&json=1&page_size=12&fields=' + PRODUCT_FIELDS;
/** the product's own page on the database (where it can be corrected or added). Pure. */
export const productPage = (db, code) => db.host + '/product/' + encodeURIComponent(code);
/** a product row from a database's answer, cleaned: { code, name, brand, qty, category, image, grade, db } or null. Only https images from the database's own image host. Pure. */
export function productOf(row, db) {
  if (!row || typeof row !== 'object') return null;
  const s = (v, n = 120) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const name = s(row.product_name || row.generic_name), code = s(row.code, 20).replace(/\D/g, '');
  if (!name && !code) return null;
  const img = s(row.image_front_small_url || row.image_small_url, 300), okImg = /^https:\/\/(?:images|static)\.open(?:food|products|beauty|petfood)facts\.org\//.test(img) ? img : '';
  return { code, name: name || '(no name yet)', brand: s(row.brands, 80).split(',')[0].trim(), qty: s(row.quantity, 40), category: s(row.categories, 200).split(',').pop().trim(), image: okImg, grade: /^[a-e]$/.test(row.nutriscore_grade || '') ? row.nutriscore_grade : '', db: db ? db.id : '' };
}
/** a pack size read from text ("500 g", "1.5 l", "6 x 330 ml", "12 pcs"): { amount in the base unit (g, ml or item), base }, or null. Pure. */
export function sizeOf(text) {
  const t = String(text || '').toLowerCase().replace(',', '.');
  let m = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|ml|oz|fl ?oz|lb)\b/.exec(t), mult = 1, v, u;
  if (m) { mult = +m[1]; v = +m[2]; u = m[3]; } else if ((m = /(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|ml|fl ?oz|oz|lbs?|pcs|pieces|count|ct|pack|items?|rolls?|sheets?)\b/.exec(t))) { v = +m[1]; u = m[2]; } else return null;
  const k = UNITS[u.replace(/\s/g, '')] || UNITS[u]; if (!k) return null;
  return { amount: mult * v * k[0], base: k[1] };
}
// unit -> [factor to the base, base]
export const UNITS = Object.freeze({ kg: [1000, 'g'], g: [1, 'g'], mg: [0.001, 'g'], lb: [453.59237, 'g'], lbs: [453.59237, 'g'], oz: [28.349523125, 'g'], l: [1000, 'ml'], cl: [10, 'ml'], ml: [1, 'ml'], floz: [29.5735295625, 'ml'], 'fl oz': [29.5735295625, 'ml'], pcs: [1, 'item'], pieces: [1, 'item'], count: [1, 'item'], ct: [1, 'item'], pack: [1, 'item'], item: [1, 'item'], items: [1, 'item'], roll: [1, 'item'], rolls: [1, 'item'], sheet: [1, 'item'], sheets: [1, 'item'] });

// ---------- money ----------
/** a price typed in any common way ("3,99", "€3.99", "1.299,00", "$1,299.00") as whole cents, or null. Pure. */
export function cents(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  let s = String(v == null ? '' : v).replace(/[^\d.,]/g, ''); if (!s) return null;
  const lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
  if (lastC > lastD) s = /,\d{3}$/.test(s) && lastD < 0 && s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = Number(s); return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) : null;
}
/** whole cents as money text in a currency and language. Pure. */
export const money = (c, cur = 'USD', lang = 'en-US') => { try { return new Intl.NumberFormat(lang, { style: 'currency', currency: cur }).format((c || 0) / 100); } catch (_) { return ((c || 0) / 100).toFixed(2) + ' ' + cur; } };

// ---------- the list and cart ----------
/** one list row, cleaned: { id, name, qty (1 to 999), price (cents or null), store, unit (text), done, note, code (a barcode), url (http or https only) }. Pure. */
export function itemOf(x, i = 0) {
  if (!x || typeof x !== 'object') return null;
  const name = String(x.name || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!name) return null;
  const qty = Math.min(999, Math.max(1, Math.round(+x.qty || 1)));
  const price = x.price === null || x.price === undefined || x.price === '' ? null : typeof x.price === 'number' && Number.isInteger(x.price) ? Math.max(0, x.price) : cents(x.price);
  return { id: String(x.id || 'i' + i).replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'i' + i, name, qty, price, store: String(x.store || '').replace(/\s+/g, ' ').trim().slice(0, 40), unit: String(x.unit || '').slice(0, 30), done: !!x.done, note: String(x.note || '').slice(0, 200), code: String(x.code || '').replace(/\D/g, '').slice(0, 14), url: /^https?:\/\/[^\s<>"']+$/i.test(String(x.url || '').trim()) ? String(x.url).trim().slice(0, 300) : '' };
}
/**
 * the list's totals, split by store: { stores: [{ store, items, count, subtotal, tax, shipping, total, free }], count, priced, unpriced, subtotal, tax, shipping, total }.
 * opts: { taxPct (percent on goods, 0 to 30), ship: { [store]: { cost: whole cents, freeOver: whole cents or null } }, onlyOpen: leave out what is ticked off }. Tax is worked out per store,
 * rounded half up to the cent; shipping is free once the store's goods reach freeOver. Pure.
 */
export function cartTotals(items, opts = {}) {
  const rate = Math.min(30, Math.max(0, +opts.taxPct || 0)), ship = opts.ship || {}, by = new Map();
  const rows = (items || []).map(itemOf).filter(Boolean).filter((x) => !(opts.onlyOpen && x.done));
  for (const x of rows) { const k = x.store || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  const stores = [...by].map(([store, list]) => {
    const subtotal = list.reduce((s, x) => s + (x.price == null ? 0 : x.price * x.qty), 0), count = list.reduce((s, x) => s + x.qty, 0);
    const tax = Math.round(subtotal * rate / 100), sh = ship[store] || {}, cost = Number.isInteger(sh.cost) && sh.cost > 0 ? sh.cost : 0, freeOver = Number.isInteger(sh.freeOver) && sh.freeOver >= 0 ? sh.freeOver : null;
    const free = freeOver != null && subtotal >= freeOver, shipping = list.length && !free ? cost : 0;
    return { store, items: list, count, subtotal, tax, shipping, total: subtotal + tax + shipping, free, toFree: freeOver != null && !free ? freeOver - subtotal : 0 };
  }).sort((a, b) => (a.store === '') - (b.store === '') || a.store.localeCompare(b.store));
  const sum = (k) => stores.reduce((s, x) => s + x[k], 0);
  return { stores, count: sum('count'), priced: rows.filter((x) => x.price != null).length, unpriced: rows.filter((x) => x.price == null).length, subtotal: sum('subtotal'), tax: sum('tax'), shipping: sum('shipping'), total: sum('total') };
}
// a CSV cell: quoted when it must be, and a cell a spreadsheet would run as a formula (=, +, -, @ first) kept as text with a leading apostrophe
const cell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const CSV_HEAD = ['name', 'qty', 'price', 'line_total', 'store', 'unit', 'done', 'barcode', 'note'];
/** the list as CSV (prices as plain decimals), with a total row per store and a grand total when there are prices. Pure. */
export function listCsv(items, opts = {}) {
  const t = cartTotals(items, opts), d = (c) => (c == null ? '' : (c / 100).toFixed(2)), lines = [CSV_HEAD.join(',')];
  for (const s of t.stores) for (const x of s.items) lines.push([x.name, x.qty, d(x.price), x.price == null ? '' : d(x.price * x.qty), x.store, x.unit, x.done ? 'yes' : '', x.code, x.note].map(cell).join(','));
  if (t.priced) { for (const s of t.stores) lines.push(['total ' + (s.store || 'no store') + ' (goods + tax + shipping)', s.count, '', d(s.total), s.store, '', '', '', 'goods ' + d(s.subtotal) + ', tax ' + d(s.tax) + ', shipping ' + d(s.shipping)].map(cell).join(',')); lines.push(['grand total', t.count, '', d(t.total), '', '', '', '', ''].map(cell).join(',')); }
  return lines.join('\r\n') + '\r\n';
}
/** CSV text split into rows of cells (quotes, doubled quotes and new lines inside quotes). Pure. */
export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false; const t = String(text || '');
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}
/** list rows from a CSV this page wrote (or any with a name column), total rows left out. Pure. */
export function listFromCsv(text) {
  const rows = parseCsv(text); if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase()), at = (k) => head.indexOf(k), ni = at('name') >= 0 ? at('name') : 0, un = (s) => String(s || '').replace(/^'(?=[=+\-@])/, '');
  return rows.slice(at('name') >= 0 ? 1 : 0).filter((r) => r[ni] && !/^(?:total |grand total)/i.test(r[ni])).map((r, i) => itemOf({ id: 'c' + i + Date.now().toString(36).slice(-4), name: un(r[ni]), qty: r[at('qty')], price: at('price') >= 0 && r[at('price')] !== '' ? r[at('price')] : null, store: at('store') >= 0 ? r[at('store')] : '', unit: at('unit') >= 0 ? r[at('unit')] : '', done: at('done') >= 0 && /^(?:yes|true|1|x)$/i.test(r[at('done')] || ''), code: at('barcode') >= 0 ? r[at('barcode')] : '', note: at('note') >= 0 ? un(r[at('note')]) : '' }, i)).filter(Boolean).slice(0, 500);
}
// ---------- a list in a link (#list=...): base64url of a small JSON, never more than 200 rows ----------
const b64u = (s) => { const b = typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(String.fromCharCode(...new TextEncoder().encode(s))); return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const b = String(s).replace(/-/g, '+').replace(/_/g, '/'); return typeof Buffer !== 'undefined' ? Buffer.from(b, 'base64').toString('utf8') : new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))); };
/** a list (and its title) as a link token. Pure. */
export const listToToken = (items, title = '') => b64u(JSON.stringify({ t: String(title).slice(0, 60), i: (items || []).map(itemOf).filter(Boolean).slice(0, 200).map((x) => [x.name, x.qty, x.price, x.store, x.done ? 1 : 0, x.unit, x.code, x.url]) }));
/** a link token back into { title, items }, or null for one that is not ours. Pure. */
export function listFromToken(tok) {
  try { const j = JSON.parse(unb64u(String(tok || '').slice(0, 60000))); if (!j || !Array.isArray(j.i)) return null; return { title: String(j.t || '').slice(0, 60), items: j.i.slice(0, 200).map((r, i) => itemOf({ id: 's' + i, name: r[0], qty: r[1], price: Number.isInteger(r[2]) ? r[2] : null, store: r[3], done: !!r[4], unit: r[5], code: r[6], url: r[7] }, i)).filter(Boolean) }; } catch (_) { return null; }
}

// ---------- stores: search a product on a store (a closed list of address templates) ----------
// `check` as for the carriers: 'partly' where the pattern was seen in a third party's documentation on 2026-10-26 (not the store's own), 'unconfirmed' otherwise.
export const STORES = Object.freeze([
  { id: 'amazon', name: 'Amazon', url: (q) => 'https://www.amazon.com/s?k=' + e(q), check: 'partly', region: 'us' },
  { id: 'ebay', name: 'eBay', url: (q) => 'https://www.ebay.com/sch/i.html?_nkw=' + e(q), check: 'partly', region: 'us' },
  { id: 'walmart', name: 'Walmart', url: (q) => 'https://www.walmart.com/search?q=' + e(q), check: 'partly', region: 'us' },
  { id: 'target', name: 'Target', url: (q) => 'https://www.target.com/s?searchTerm=' + e(q), check: 'unconfirmed', region: 'us' },
  { id: 'bestbuy', name: 'Best Buy', url: (q) => 'https://www.bestbuy.com/site/searchpage.jsp?st=' + e(q), check: 'unconfirmed', region: 'us' },
  { id: 'etsy', name: 'Etsy', url: (q) => 'https://www.etsy.com/search?q=' + e(q), check: 'unconfirmed', region: 'world' },
  { id: 'aliexpress', name: 'AliExpress', url: (q) => 'https://www.aliexpress.com/wholesale?SearchText=' + e(q), check: 'unconfirmed', region: 'world' },
  { id: 'amazonuk', name: 'Amazon UK', url: (q) => 'https://www.amazon.co.uk/s?k=' + e(q), check: 'partly', region: 'uk' },
  { id: 'amazonde', name: 'Amazon.de', url: (q) => 'https://www.amazon.de/s?k=' + e(q), check: 'partly', region: 'de' },
  { id: 'ebayde', name: 'eBay.de', url: (q) => 'https://www.ebay.de/sch/i.html?_nkw=' + e(q), check: 'partly', region: 'de' },
  { id: 'otto', name: 'Otto', url: (q) => 'https://www.otto.de/suche/' + e(q) + '/', check: 'unconfirmed', region: 'de' },
  { id: 'idealo', name: 'idealo', url: (q) => 'https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=' + e(q), check: 'unconfirmed', region: 'de' },
]);
/** the store searches for a query (a name or a barcode): [{ id, name, url, check, region }]; region 'all' or one of us, uk, de, world. Pure. */
export function storeLinks(q, region = 'all') {
  const s = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!s) return [];
  return STORES.filter((x) => region === 'all' || x.region === region || x.region === 'world').map((x) => ({ id: x.id, name: x.name, url: x.url(s), check: x.check, region: x.region }));
}

// ---------- unit price ----------
/** price per base unit for each offer [{ label, price, size }] (size as text like "500 g" or { amount, unit }): [{ label, per100 (cents per 100 g / 100 ml / 1 item), base, best }], cheapest first. Pure. */
export function unitPrices(offers) {
  const rows = (offers || []).map((o, i) => { const p = typeof o.price === 'number' && Number.isInteger(o.price) ? o.price : cents(o.price); const sz = typeof o.size === 'object' && o.size ? (UNITS[o.size.unit] ? { amount: +o.size.amount * UNITS[o.size.unit][0], base: UNITS[o.size.unit][1] } : null) : sizeOf(o.size);
    if (p == null || !sz || !(sz.amount > 0)) return null; const per = sz.base === 'item' ? p / sz.amount : p / sz.amount * 100; return { label: String(o.label || 'Offer ' + (i + 1)).slice(0, 60), price: p, amount: sz.amount, base: sz.base, per, i }; }).filter(Boolean);
  const bases = new Set(rows.map((r) => r.base));
  const best = rows.length ? Math.min(...rows.map((r) => r.per)) : null;
  return rows.sort((a, b) => a.per - b.per || a.i - b.i).map((r) => ({ ...r, best: bases.size === 1 && r.per === best, mixed: bases.size > 1, more: best ? Math.round((r.per / best - 1) * 1000) / 10 : 0 }));
}
/** the unit a per price is shown in: 'per 100 g', 'per 100 ml', 'each'. Pure. */
export const perLabel = (base) => (base === 'item' ? 'each' : 'per 100 ' + base);

// ---------- price log, watches and reminders ----------
/** what a product's logged prices say: { n, lowest, highest, latest, first, change (latest - first, cents), targetMet }. Pure. */
export function priceStats(entries, target = null) {
  const rows = (entries || []).filter((x) => x && Number.isInteger(x.price) && x.price >= 0).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  if (!rows.length) return { n: 0, lowest: null, highest: null, latest: null, first: null, change: 0, targetMet: false };
  const ps = rows.map((x) => x.price), latest = rows[rows.length - 1];
  return { n: rows.length, lowest: Math.min(...ps), highest: Math.max(...ps), latest: latest.price, latestAt: latest.at, latestStore: latest.store || '', first: rows[0].price, change: latest.price - rows[0].price, targetMet: Number.isInteger(target) && latest.price <= target };
}
/** the days between two ISO dates (b - a), whole days. Pure. */
export const daysBetween = (a, b) => Math.round((Date.parse(String(b).slice(0, 10) + 'T12:00:00Z') - Date.parse(String(a).slice(0, 10) + 'T12:00:00Z')) / 864e5);
/** an ISO date plus n days. Pure. */
export const addDays = (d, n) => new Date(Date.parse(String(d).slice(0, 10) + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/** a returns window: { due (last day to send it back), left (days from today; negative once past), state: 'open' | 'soon' (7 days or fewer) | 'today' | 'closed' }. Pure. */
export function returnWindow(bought, days, today) {
  const n = Math.max(0, Math.min(3650, Math.round(+days || 0))); if (!/^\d{4}-\d{2}-\d{2}/.test(String(bought || ''))) return null;
  const due = addDays(bought, n), left = daysBetween(today, due);
  return { due, left, state: left < 0 ? 'closed' : left === 0 ? 'today' : left <= 7 ? 'soon' : 'open' };
}
/** a calendar file's events for the dates a person keeps (parcels expected, return deadlines, price checks): [{ title, at, allDay }] for lib/ics.js. Pure. */
export function reminderEvents(list) {
  return (list || []).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '')).map((x) => ({ id: String(x.id || ''), title: String(x.title || '').slice(0, 160), at: x.date + 'T09:00:00', allDay: true }));
}
