// GET /api/productsearch?q=... -> { ok, products }
// Searches the Verse product catalog for matches on name or slug.

import { getCatalog } from './catalog.js';

export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();

  if (!query) {
    return new Response(JSON.stringify({ ok: true, products: [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { products } = await getCatalog(context);
  const matches = products.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.slug.toLowerCase().includes(query)
  );

  return new Response(JSON.stringify({ ok: true, products: matches }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
