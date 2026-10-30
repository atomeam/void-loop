// Verse's own store (docs/store.md). Phase 1: our catalog, our cart, our receipts, signed downloads and license keys,
// with the payment provider behind an adapter. Gumroad is the primary checkout today (owner, 2026-10-15); Stripe Checkout
// switches on later by setting Pages secrets, no rebuild. We never see or touch a card number: every provider is hosted.
//   STORE_PROVIDER      'gumroad' (default) | 'stripe'   which adapter checkout uses
//   STRIPE_SECRET_KEY   + STRIPE_WEBHOOK_SECRET          needed before 'stripe' is used; without them checkout stays on Gumroad
//   CASHAPP_CASHTAG / CRYPTO_USDC_BASE_ADDR   special items: Cash App and USDC-on-Base rails, manual or on-chain verified (lib/alt-pay.js)
//   STORE_SIGNING_KEY   HMAC key for download tokens and license keys (falls back to SALT)
// The catalog lives in domains/store.products.json (tools/store-publish.mjs adds products and regenerates ./store-products.js).
// status: live | soon | needs-gumroad (paid, waiting for Adam to list it on Gumroad: shown as coming soon) | unpublished (hidden).
import CATALOG from './store-products.js';
import { isShareProduct, publicShare } from './pay-share.js';
export { railsOf, specialRails, instructions as specialInstructions, verifyUsdcTx, usdcUnits } from './alt-pay.js';
export const ALL_PRODUCTS = CATALOG;
export const STORE_PRODUCTS = CATALOG.filter((p) => p.status !== 'unpublished').map((p) => ({ ...p, soon: p.status === 'soon' || p.status === 'needs-gumroad' }));
export const productOf = (id) => STORE_PRODUCTS.find((p) => p.id === id) || null;
// UTM on every link we hand out, so Gumroad's analytics show which Verse surface sold it
export const gumroadUrl = (p, medium = 'store') => 'https://moonbeam846.gumroad.com/l/' + p.gumroad + '?utm_source=a-to-mind&utm_medium=' + medium + '&utm_campaign=v01d-store';
export const price = (p) => (p.pwyw && p.cents > 0 ? 'Pay what you want · ' + '$' + (p.cents / 100).toFixed(p.cents % 100 ? 2 : 0) + ' gets it all' : p.pwyw && !p.cents ? 'Free · pay what you want' : p.cents ? '$' + (p.cents / 100).toFixed(p.cents % 100 ? 2 : 0) + (p.every ? ' a ' + p.every : '') : 'Free');
export const publicCatalog = () => STORE_PRODUCTS.map(({ files, ...p }) => ({ ...p, price: price(p), buy: p.gumroad ? gumroadUrl(p) : null, files: files ? files.length : 0, ...(isShareProduct(p) ? { share: publicShare(p) } : {}) }));

// which provider is live, without ever reading a secret's value out
export function providerOf(env = {}) {
  const want = String(env.STORE_PROVIDER || 'gumroad').toLowerCase();
  const stripeReady = !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  return { provider: want === 'stripe' && stripeReady ? 'stripe' : 'gumroad', stripeReady, wanted: want, signing: !!signingKey(env) };
}
export const signingKey = (env = {}) => env.STORE_SIGNING_KEY || env.SALT || '';

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(key, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return crypto.subtle.sign('HMAC', k, enc.encode(msg)); }
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// a download token: base64url(json).sig, expiring. { o: order id, p: product, f: file index, e: expiry ms }
export async function signToken(key, payload) { const body = b64u(enc.encode(JSON.stringify(payload))); return body + '.' + b64u(await hmac(key, body)); }
export async function verifyToken(key, token, now = Date.now()) {
  const [body, sig] = String(token || '').split('.'); if (!body || !sig || !key) return null;
  if (!same(sig, b64u(await hmac(key, body)))) return null;
  let p; try { p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { return null; }
  return p && p.e > now ? p : null;
}
// a license key for one order and product: Verse-XXXX-XXXX-XXXX-XXXX, recomputable from the order, so it needs no lookup to check
export async function licenseKey(key, order, product) {
  const h = hex(await hmac(key, 'license:' + order + ':' + product)).toUpperCase().slice(0, 16);
  return 'Verse-' + h.match(/.{4}/g).join('-'); // license keys keep their Verse- prefix through the rename to Verse: keys already sold must keep working
}
export const LICENSE_Verse_RE = /^Verse-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

// Stripe-Signature: t=<unix>,v1=<hex hmac of "t.body">; 5 minute tolerance (Stripe's own default)
export async function verifyStripe(secret, header, body, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const t = +parts.t; if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const want = hex(await hmac(secret, t + '.' + body));
  return String(header).split(',').some((kv) => { const [k, v] = kv.split('='); return k.trim() === 'v1' && same(v.trim(), want); });
}

// The adapters. checkout(items, ctx) -> { mode, url?, urls? }. Gumroad has no multi-item cart, so it opens one link per item.
export const ADAPTERS = {
  gumroad: { async checkout(items) { return { mode: 'gumroad', urls: items.filter((p) => p.gumroad).map((p) => gumroadUrl(p, 'checkout')) }; } },
  stripe: {
    async checkout(items, { env, origin, email, amounts = {}, meta = {}, fetchImpl = fetch }) {
      const f = new URLSearchParams({ mode: items.some((p) => p.every) ? 'subscription' : 'payment', success_url: origin + '/store/receipt/?session={CHECKOUT_SESSION_ID}', cancel_url: origin + '/store/', 'automatic_tax[enabled]': env.STRIPE_TAX === 'on' ? 'true' : 'false' });
      if (email) f.set('customer_email', email);
      f.set('metadata[items]', items.map((p) => p.id).join(','));
      for (const [k, v] of Object.entries(meta)) f.set('metadata[' + k + ']', String(v)); // server-made only (share / upgrade order id)
      // amounts: only a pay-a-share amount the server clamped (functions/api/store), never a client price
      items.forEach((p, i) => {
        f.set(`line_items[${i}][quantity]`, '1'); f.set(`line_items[${i}][price_data][currency]`, 'usd');
        f.set(`line_items[${i}][price_data][unit_amount]`, String(amounts[p.id] ?? p.cents)); f.set(`line_items[${i}][price_data][product_data][name]`, p.name);
        if (p.every) f.set(`line_items[${i}][price_data][recurring][interval]`, p.every);
      });
      const r = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) return { mode: 'gumroad', urls: items.filter((p) => p.gumroad).map((p) => gumroadUrl(p, 'checkout')), note: 'Stripe did not answer; Gumroad instead' };
      return { mode: 'stripe', url: j.url };
    },
  },
};

export const ORDERS_TABLE = 'CREATE TABLE IF NOT EXISTS store_orders (id TEXT PRIMARY KEY, provider TEXT, ref TEXT UNIQUE, email_hash TEXT, items TEXT, cents INTEGER, status TEXT, created TEXT, refunded TEXT, pi TEXT)';
export async function emailHash(key, email) { return hex(await hmac(key, 'email:' + String(email || '').trim().toLowerCase())); }
export const orderCode = (id) => String(id).slice(-8).toUpperCase();

// "what can I buy": Verse's answer, from the catalog
export function buyAnswer() {
  const live = STORE_PRODUCTS.filter((p) => p.gumroad && !p.soon);
  const made = STORE_PRODUCTS.filter((p) => !p.gumroad && !p.soon && p.files).map((p) => ({ id: p.id, name: p.name, price: p.pwyw ? 'Free · pay what you want' : price(p), blurb: p.blurb, url: '/store/#' + p.id }));
  return { lead: 'What Verse sells · support Verse', rows: live.map((p) => ({ id: p.id, name: p.tip ? p.name + ' (tip jar)' : p.name, price: price(p), blurb: p.blurb, url: gumroadUrl(p, 'void-card') })), made, more: 'Everything is at a-to-mind.com/store.' };
}

// ---- the store as the shopping floor (owner, 2026-10-26: "need a /store page that beats amazons"): a cart a person can
// read and check, the money worked out in one place, and a delivery story for digital goods. Pure: no fetch, no clock.

// parse a cart spec ("id", "id:2", separated by commas); unknown ids, bad counts and soon items are dropped, not errors
export function cartLines(products, spec = '') {
  const out = [];
  for (const part of String(spec || '').split(',')) {
    const m = /^\s*([a-z0-9-]+)\s*(?::\s*|\s+x\s*)?([1-9])?\s*$/i.exec(part);
    if (!m) continue;
    const p = products.find((x) => x.id === m[1]);
    if (!p || p.soon || !p.cents) continue; // paid products only: a free one checks out by itself
    const qty = Math.min(9, m[2] ? +m[2] : 1);
    const line = out.find((l) => l.id === p.id);
    if (line) line.qty = Math.min(9, line.qty + qty); else out.push({ id: p.id, name: p.name, cents: p.cents, every: p.every || '', qty });
  }
  return out;
}

// the money in one place, whole cents in and out. The payment page (Gumroad or Stripe) is the final word before anyone
// pays: it adds whatever tax applies where the buyer is, and the page says so instead of guessing a tax here
export function cartTotals(lines) { const subtotal = lines.reduce((a, l) => a + l.cents * l.qty, 0); return { subtotal, total: subtotal }; }
export const usdCents = (c) => '$' + (c / 100).toFixed(2);

// a link that carries the whole cart, so a cart can be shared, bookmarked, or handed to another device
export function cartUrl(lines) { const spec = lines.map((l) => l.id + (l.qty > 1 ? ':' + l.qty : '')).join(','); return '/store/' + (spec ? '?cart=' + encodeURIComponent(spec) : ''); }

// the catalogue controls: search, kinds, sort; a search that matches nothing is an empty result, never an error
export function searchProducts(products, q = '') { const w = String(q || '').trim().toLowerCase(); return w ? products.filter((p) => ((p.name || '') + ' ' + (p.blurb || '') + ' ' + (p.kind || '')).toLowerCase().includes(w)) : products.slice(); }
export function kindsOf(products) { const m = new Map(); for (const p of products) { const k = p.kind || 'other'; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
export function sortProducts(products, by = 'featured') {
  const s = products.slice();
  if (by === 'price-asc') s.sort((a, b) => (a.cents || 0) - (b.cents || 0));
  else if (by === 'price-desc') s.sort((a, b) => (b.cents || 0) - (a.cents || 0));
  else if (by === 'newest') s.sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));
  return s;
}

// the catalogue as a price list anyone can take away: one row per product, no login and no API key
export function catalogCsv(products) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return ['id,name,kind,cents,price,every,availability'].concat(products.map((p) => [p.id, p.name, p.kind || '', p.cents || 0, ((p.cents || 0) / 100).toFixed(2), p.every || '', p.soon ? 'coming soon' : 'available now'].map(q).join(','))).join('\r\n');
}

// how a digital order travels, told in advance and marked on the receipt; these are digital goods, nothing ships
export const DELIVERY_STEPS = ['Ordered', 'Paid (on Gumroad or Stripe)', 'Signed downloads ready: links last 24 hours, re-open them any time', 'License key issued', 'Support window opens'];
export function deliveryDone(order) {
  const items = (order && order.items) || [];
  const placed = !!(order && order.code) && items.length > 0;
  const keys = placed && items.every((i) => i.license);
  const files = placed && items.some((i) => (i.downloads || []).length);
  return { 'Ordered': placed, 'Paid (on Gumroad or Stripe)': !!(order && order.status && order.status !== 'pending'), 'Signed downloads ready: links last 24 hours, re-open them any time': files, 'License key issued': keys, 'Support window opens': keys };
}
