// Void's standalone products: things Void makes that people can buy on their own, each also included in paid Void
// (the $49 a month membership, lib/gumroad.js UNLOCKS). Adding a product is one row here plus its page and its API.
// A standalone purchase is a Gumroad product with license keys turned on: the buyer gets a license key by email and uses it
// directly (no Void account needed). The server checks the key with Gumroad (/v2/licenses/verify) and remembers the answer
// for a few hours, so a refund, a chargeback or a cancelled subscription turns it off soon after.
// The owner (READ_TOKEN, an owner session) always has every product, free, with no daily cap: these are built for us first.
//   gumroad.slug: the product's permalink (moonbeam846.gumroad.com/l/<slug>); empty = not on sale on its own yet.
//   gumroad.productId: Gumroad's own id for it (the long one, like ITp6zMMOC7A2h-bsSejYSA==), which its license API wants for
//   products made since 2023. Usually left empty: it is read from the store catalog (lib/store-db.js, refreshed from the live
//   storefront) by the slug. A Pages env var (envVar) set to the id overrides both.
import { ensureStoreTables, loadCatalog } from './store-db.js';

export const PRODUCTS = [
  {
    id: 'code-review',
    name: 'Void Code Review Pro',
    page: 'https://a-to-mind.com/code-review/',
    adds: 'the closer read: an AI reviewer on every pull request, on top of the free instant checks',
    includedIn: 'paid',
    gumroad: { productId: '', slug: 'dkmcjk', envVar: 'GUMROAD_REVIEW_PRODUCT_ID' }, // made 2026-10-09
    daily: 300,
  },
];
export const productById = (id) => PRODUCTS.find((p) => p.id === id) || null;
export function productIdOf(p, env) { const v = (env && p.gumroad.envVar && env[p.gumroad.envVar]) || p.gumroad.productId; return String(v || '').trim(); }
export const forSale = (p) => !!p.gumroad.slug;
// Gumroad's id for the product: the env var or the fixed one, else the store catalog's row for the slug ('' when the catalog
// hasn't seen it yet; the license check then asks Gumroad by the permalink instead). Remembered per isolate for 10 minutes.
const idCache = new Map();
export async function resolveProductId(p, env, now = Date.now()) {
  const fixed = productIdOf(p, env); if (fixed) return fixed;
  const hit = idCache.get(p.id); if (hit && now - hit.at < 600e3) return hit.v;
  let v = '';
  try {
    await ensureStoreTables(env);
    const { products } = await loadCatalog(env), s = p.gumroad.slug;
    const row = products.find((x) => x.slug === s || x.short === s || String(x.url || '').endsWith('/l/' + s));
    v = (row && row.id) ? String(row.id) : '';
  } catch (_) {}
  if (v) idCache.set(p.id, { v, at: now });
  return v;
}
export const buyUrl = (p) => 'https://moonbeam846.gumroad.com/l/' + p.gumroad.slug;

// A Gumroad license key: four groups of eight hex digits.
export const LICENSE_RE = /^[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/i;
export const LICENSE_TTL_MS = 6 * 3600e3;
export const LICENSE_TABLE = 'CREATE TABLE IF NOT EXISTS void_licenses (hash TEXT PRIMARY KEY, product TEXT NOT NULL, ok INTEGER NOT NULL, why TEXT, checked INTEGER NOT NULL, day TEXT, uses INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0)';

// Gumroad's answer about one license -> { ok, why }. Refunded, charged back, disputed, a test purchase, or a subscription that
// ended or failed to renew is not ok (a cancelled one runs to the end of what was paid for, then ends). Network trouble is { ok: null } (unknown: the caller keeps its last answer).
export async function askGumroad(productId, key, fetchImpl = fetch, permalink = '') {
  let r;
  try {
    r = await fetchImpl('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...(productId ? { product_id: productId } : { product_permalink: permalink }), license_key: key, increment_uses_count: 'false' }).toString(), signal: AbortSignal.timeout(8000) });
  } catch (_) { return { ok: null, why: 'Gumroad unreachable' }; }
  let j = null; try { j = await r.json(); } catch (_) {}
  if (r.status === 404 || (j && j.success === false)) return { ok: false, why: 'not a license for this product' };
  if (!r.ok || !j || !j.purchase) return { ok: null, why: 'Gumroad answered ' + r.status };
  const p = j.purchase, now = Date.now(), past = (t) => t && Date.parse(t) <= now;
  if (p.refunded) return { ok: false, why: 'refunded' };
  if (p.chargebacked || p.disputed) return { ok: false, why: 'charged back' };
  if (p.test) return { ok: false, why: 'a test purchase' };
  if (past(p.subscription_ended_at) || past(p.subscription_failed_at)) return { ok: false, why: 'the subscription has ended' };
  return { ok: true, why: 'licensed' };
}
