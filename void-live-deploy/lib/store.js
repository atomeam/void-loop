// V01D's own store (docs/store.md). Phase 1: our catalog, our cart, our receipts, signed downloads and license keys,
// with the payment provider behind an adapter. Gumroad is the primary checkout today (owner, 2026-10-15); Stripe Checkout
// switches on later by setting Pages secrets, no rebuild. We never see or touch a card number: every provider is hosted.
//   STORE_PROVIDER      'gumroad' (default) | 'stripe'   which adapter checkout uses
//   STRIPE_SECRET_KEY   + STRIPE_WEBHOOK_SECRET          needed before 'stripe' is used; without them checkout stays on Gumroad
//   STORE_SIGNING_KEY   HMAC key for download tokens and license keys (falls back to SALT)
export const STORE_PRODUCTS = [
  { id: 'void-monthly', name: 'Void Monthly', cents: 4900, every: 'month', kind: 'membership', gumroad: 'yinmj', blurb: 'Paid Void: every pro skill, films, code review, priority.' },
  { id: 'code-review-pro', name: 'Void Code Review Pro', cents: 1000, every: 'month', kind: 'license', gumroad: 'void-code-review', alt: ['dkmcjk'], blurb: 'An AI reviewer on every pull request, with a license key.' },
  { id: 'one-time-fix', name: 'Automation Cleanup (One-Time Fix)', cents: 2500, kind: 'service', gumroad: 'eozcma', blurb: 'One broken Zap, Make or n8n flow fixed, with proof.' },
  { id: 'first-automation-setup', name: 'First Automation Setup', cents: 10000, kind: 'service', gumroad: 'first-automation-setup', blurb: 'Your first automation built for you, end to end.' },
  { id: 'full-stack-audit', name: 'Full Stack Audit', cents: 30000, kind: 'service', gumroad: 'full-stack-audit', blurb: 'Every automation reviewed, with a ranked repair plan.' },
  { id: 'keep-it-running', name: 'Keep-It-Running Plan', cents: 4900, kind: 'service', gumroad: 'keep-it-running-membership', blurb: 'Automations watched around the clock, fixed when they break.' },
  { id: 'big-board', name: 'The Big Board', cents: 2500, every: 'month', kind: 'membership', gumroad: 'gqsgib', blurb: 'Real jobs that pay real money.' },
  { id: 'join-the-team', name: 'Join the Team', cents: 100, kind: 'support', gumroad: 'join-the-team', blurb: 'The tip jar: a dollar to back the crew.', tip: true },
  // Digital downloads. The chess set is the free sample that runs the whole signed-download path live.
  { id: 'chess-set-glb', name: 'V01D Wooden Chess Set (GLB)', cents: 0, kind: 'download', files: [{ key: 'chess-set-wood-v1-2k.glb', asset: '/models/chess-set-wood-v1-2k.glb' }],
    preview: '/models/chess-set-wood-v1-1k.glb', license: 'CC0 (Poly Haven, re-textured by V01D)', blurb: 'Free: the 3D set V01D plays chess on. Drop it in Blender, a game or a slicer.' },
  { id: 'voidquest-minis', name: 'VoidQuest Miniatures Pack (STL + 3MF)', cents: 900, kind: 'download', soon: true, preview: '/models/chess-set-wood-v1-1k.glb', files: [{ key: 'store/voidquest-minis-v1.zip' }],
    blurb: 'Printable VoidQuest heroes and monsters. Coming soon: preview shown is the chess set.' },
];
export const productOf = (id) => STORE_PRODUCTS.find((p) => p.id === id) || null;
// UTM on every link we hand out, so Gumroad's analytics show which V01D surface sold it
export const gumroadUrl = (p, medium = 'store') => 'https://moonbeam846.gumroad.com/l/' + p.gumroad + '?utm_source=a-to-mind&utm_medium=' + medium + '&utm_campaign=v01d-store';
export const price = (p) => (p.cents ? '$' + (p.cents / 100).toFixed(p.cents % 100 ? 2 : 0) + (p.every ? ' a ' + p.every : '') : 'Free');
export const publicCatalog = () => STORE_PRODUCTS.map(({ files, ...p }) => ({ ...p, price: price(p), buy: p.gumroad ? gumroadUrl(p) : null, files: files ? files.length : 0 }));

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
// a license key for one order and product: V01D-XXXX-XXXX-XXXX-XXXX, recomputable from the order, so it needs no lookup to check
export async function licenseKey(key, order, product) {
  const h = hex(await hmac(key, 'license:' + order + ':' + product)).toUpperCase().slice(0, 16);
  return 'V01D-' + h.match(/.{4}/g).join('-');
}
export const LICENSE_V01D_RE = /^V01D-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

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
    async checkout(items, { env, origin, email, fetchImpl = fetch }) {
      const f = new URLSearchParams({ mode: items.some((p) => p.every) ? 'subscription' : 'payment', success_url: origin + '/store/receipt/?session={CHECKOUT_SESSION_ID}', cancel_url: origin + '/store/', 'automatic_tax[enabled]': env.STRIPE_TAX === 'on' ? 'true' : 'false' });
      if (email) f.set('customer_email', email);
      f.set('metadata[items]', items.map((p) => p.id).join(','));
      items.forEach((p, i) => {
        f.set(`line_items[${i}][quantity]`, '1'); f.set(`line_items[${i}][price_data][currency]`, 'usd');
        f.set(`line_items[${i}][price_data][unit_amount]`, String(p.cents)); f.set(`line_items[${i}][price_data][product_data][name]`, p.name);
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

// "what can I buy": V01D's answer, from the catalog
export function buyAnswer() {
  const live = STORE_PRODUCTS.filter((p) => p.gumroad && !p.soon);
  return { lead: 'What V01D sells · support V01D', rows: live.map((p) => ({ id: p.id, name: p.tip ? p.name + ' (tip jar)' : p.name, price: price(p), blurb: p.blurb, url: gumroadUrl(p, 'void-card') })), more: 'Everything is at a-to-mind.com/store.' };
}
