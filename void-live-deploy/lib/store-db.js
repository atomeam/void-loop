// The store in D1 (plan item 12): the Gumroad catalog (merged, never shrinks) and every sale ping (append-only).
// Tables are made on first use (same SQL as tools/d1/void_store.sql) because the deploy doesn't run D1 SQL.
import { CATALOG_SEED, STALE_MS, fetchStore, mergeCatalog } from './gumroad.js';

const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_catalog (slug TEXT PRIMARY KEY, data TEXT NOT NULL, available INTEGER NOT NULL, updated TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_catalog_meta (k TEXT PRIMARY KEY, v TEXT)',
  'CREATE TABLE IF NOT EXISTS void_sales (id TEXT PRIMARY KEY, resource TEXT NOT NULL, sale_id TEXT, subscription_id TEXT, product TEXT, void_id TEXT, verified INTEGER NOT NULL, effect TEXT, raw TEXT NOT NULL, at TEXT NOT NULL)',
];
const made = new WeakMap();
export function ensureStoreTables(env) {
  if (!env.DB) return Promise.reject(new Error('no DB binding'));
  let p = made.get(env.DB);
  if (!p) { p = env.DB.batch(TABLES.map((q) => env.DB.prepare(q))).catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}

export async function loadCatalog(env) {
  const rows = (await env.DB.prepare('SELECT slug, data, available FROM void_catalog').all()).results || [];
  const meta = await env.DB.prepare('SELECT v FROM void_catalog_meta WHERE k = ?').bind('refreshed').first();
  const products = [];
  for (const r of rows) { try { products.push({ ...JSON.parse(r.data), slug: r.slug, available: !!r.available }); } catch (_) {} }
  return { products, refreshed: meta ? meta.v : null };
}

// Read the live store and merge it in. Only changed rows are written (D1 daily write limits). null = the store couldn't be read.
let running = null;
export function refreshCatalog(env, { fetchImpl, now } = {}) {
  if (running) return running;
  running = (async () => {
    const fresh = await fetchStore(fetchImpl || env.GUMROAD_FETCH || fetch);
    if (!fresh) return null;
    const at = now || new Date().toISOString();
    const { products: old } = await loadCatalog(env);
    // first run: start from the seed so the history begins with what Void already knew
    const { products, changed } = mergeCatalog(old.length ? old : CATALOG_SEED.map((p) => ({ ...p, first_seen: at, last_seen: at, history: [{ at, event: 'added', price_cents: p.price_cents, recurrence: p.recurrence, name: p.name, available: true }] })), fresh, at);
    const touched = old.length ? changed : products.map((p) => p.slug);
    const stmts = products.filter((p) => touched.includes(p.slug)).map((p) => {
      const { slug, available, ...data } = p;
      return env.DB.prepare('INSERT INTO void_catalog (slug, data, available, updated) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET data = excluded.data, available = excluded.available, updated = excluded.updated').bind(slug, JSON.stringify(data), available ? 1 : 0, at);
    });
    stmts.push(env.DB.prepare('INSERT INTO void_catalog_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind('refreshed', at));
    await env.DB.batch(stmts);
    return { products, refreshed: at, changed: touched };
  })().finally(() => { running = null; });
  return running;
}
export const isStale = (refreshed, now = Date.now()) => !refreshed || !(now - Date.parse(refreshed) < STALE_MS);
