// Atom's Gumroad products, as Void knows them (plan item 12). The page asks for this only when someone asks for something a
// product covers; nothing about it is ever shown on the empty surface.
// GET                              -> { products: [{ slug, name, price_cents, currency, recurrence, url, available }], refreshed, source }
//                                     refreshed from moonbeam846.gumroad.com when older than 6 hours (merged: nothing is ever dropped)
// POST (Bearer READ_TOKEN)         -> refresh now (for a scheduled task; Pages Functions have no cron trigger) -> { refreshed, changed }
// If D1 or the store can't be reached, the saved catalog (or the built-in seed) is served: asks still get an answer.
import { CATALOG_SEED, publicProduct } from '../../lib/gumroad.js';
import { ensureStoreTables, loadCatalog, refreshCatalog, isStale } from '../../lib/store-db.js';

const out = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'public, max-age=300' } });

export async function onRequestGet({ env, waitUntil }) {
  let products = [], refreshed = null, db = true;
  try { await ensureStoreTables(env); ({ products, refreshed } = await loadCatalog(env)); } catch (_) { db = false; }
  if (db && isStale(refreshed)) {
    const job = refreshCatalog(env).catch(() => null);
    if (products.length && typeof waitUntil === 'function') waitUntil(job); // serve what's saved, refresh behind it
    else { const r = await job; if (r) ({ products, refreshed } = r); }
  }
  const source = products.length ? 'store' : 'seed';
  return out({ products: (products.length ? products : CATALOG_SEED).map(publicProduct), refreshed, source });
}

export async function onRequestPost({ request, env }) {
  const tok = (request.headers.get('authorization') || '').replace(/^Bearer\s+/, '');
  if (!env.READ_TOKEN || tok !== env.READ_TOKEN) return out({ ok: false, error: 'owner only' }, 401);
  try {
    await ensureStoreTables(env);
    const r = await refreshCatalog(env);
    if (!r) return out({ ok: false, error: "couldn't read the store, catalog kept as it was" }, 502);
    return out({ ok: true, refreshed: r.refreshed, changed: r.changed, products: r.products.length });
  } catch (_) { return out({ ok: false, error: 'catalog unavailable' }, 503); }
}
