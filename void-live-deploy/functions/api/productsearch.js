// GET /api/productsearch?q=... -> { ok, products }
// Searches the Verse product catalog for matches on name or slug.

import { getCatalog } from './catalog.js';

/** Products whose name or slug contains the query. An empty query matches none. Pure. */
export function matchingProducts(products, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  return (products || []).filter((p) => String(p && p.name || '').toLowerCase().includes(q) || String(p && p.slug || '').toLowerCase().includes(q));
}

export async function onRequestGet(context) {
  const query = new URL(context.request.url).searchParams.get('q');
  if (!String(query || '').trim()) {
    return new Response(JSON.stringify({ ok: true, products: [] }), { headers: { 'Content-Type': 'application/json' } });
  }
  const { products } = await getCatalog(context);
  return new Response(JSON.stringify({ ok: true, products: matchingProducts(products, query) }), { headers: { 'Content-Type': 'application/json' } });
}
