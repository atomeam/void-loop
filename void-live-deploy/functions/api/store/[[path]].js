// /api/store/*: V01D's own store (docs/store.md, lib/store.js). Gumroad is the checkout today; Stripe behind the same adapter.
//   GET  catalog            products, prices, previews, and the Gumroad fallback link for each
//   GET  status             which provider is live and which keys are set (true/false only, never a value)
//   POST checkout {items, email?}   -> { mode: 'gumroad', urls } | { mode: 'stripe', url }   (hosted checkout; no card data here)
//   POST webhook/stripe     Stripe-Signature verified; checkout.session.completed -> order; charge.refunded -> revoked
//   GET  order?session=cs_  the receipt: items, license keys, fresh signed download links (24 h)
//   POST lookup {email, code}  the same receipt again, by the buyer's email and the 8-letter order code
//   POST free {id}          a free download (no order saved): signed links straight away
//   GET  download?t=        verifies the token (and that the order isn't refunded), then serves the file
import { STORE_PRODUCTS, productOf, publicCatalog, providerOf, signingKey, signToken, verifyToken, licenseKey, verifyStripe, ADAPTERS, ORDERS_TABLE, emailHash, orderCode } from '../../../lib/store.js';

const J = (b, s = 200, cache = 'no-store') => Response.json(b, { status: s, headers: { 'cache-control': cache } });
const DAY = 24 * 3600e3;
const db = async (env) => { if (!env.DB) return null; await env.DB.prepare(ORDERS_TABLE).run(); return env.DB; };

async function receipt(env, order, origin) {
  const key = signingKey(env), items = String(order.items || '').split(',').map(productOf).filter(Boolean), e = Date.now() + DAY;
  const out = [];
  for (const p of items) {
    const row = { id: p.id, name: p.name, license: await licenseKey(key, order.id, p.id), downloads: [] };
    if (order.status === 'paid' || order.status === 'free') for (let i = 0; i < (p.files || []).length; i++) row.downloads.push({ name: p.files[i].key.split('/').pop(), url: origin + '/api/store/download?t=' + await signToken(key, { o: order.id, p: p.id, f: i, e }) });
    out.push(row);
  }
  return { order: order.id, code: orderCode(order.id), status: order.status, provider: order.provider, created: order.created, items: out, expires: new Date(e).toISOString() };
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx, url = new URL(request.url), origin = url.origin;
  const path = [].concat(params.path || []).join('/'), m = request.method;
  try {
    if (path === 'catalog' && m === 'GET') return J({ products: publicCatalog(), provider: providerOf(env).provider }, 200, 'public, max-age=300');
    if (path === 'status' && m === 'GET') { const s = providerOf(env); return J({ provider: s.provider, wanted: s.wanted, stripe_keys: s.stripeReady, signing_key: s.signing, orders_db: !!env.DB, files_bucket: !!env.FILMS }); }
    if (path === 'checkout' && m === 'POST') {
      const b = await request.json().catch(() => ({}));
      // product ids only: any price, amount, discount or coupon in the body is ignored, every amount comes from lib/store.js (lib/price-lock.js)
      const items = [...new Set([].concat(b.items || []).filter((x) => typeof x === 'string'))].slice(0, 20).map(productOf).filter((p) => p && !p.soon && p.cents > 0);
      if (!items.length) return J({ ok: false, error: 'nothing to buy in the cart' }, 400);
      const email = /^[^@\s]{1,64}@[^@\s]{1,190}$/.test(String(b.email || '')) ? String(b.email) : '';
      const s = providerOf(env);
      return J({ ok: true, ...(await ADAPTERS[s.provider].checkout(items, { env, origin, email })) });
    }
    if (path === 'webhook/stripe' && m === 'POST') {
      const body = await request.text();
      if (!(await verifyStripe(env.STRIPE_WEBHOOK_SECRET, request.headers.get('stripe-signature'), body))) return J({ ok: false }, 400);
      const ev = JSON.parse(body), o = ev.data && ev.data.object || {}, D = await db(env);
      if (!D) return J({ ok: false, error: 'no orders db' }, 503);
      if (ev.type === 'checkout.session.completed' && o.payment_status === 'paid') {
        const id = 'ord_' + crypto.randomUUID().replace(/-/g, '');
        const email = (o.customer_details && o.customer_details.email) || o.customer_email || '';
        await D.prepare('INSERT OR IGNORE INTO store_orders (id, provider, ref, email_hash, items, cents, status, created, pi) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(id, 'stripe', o.id, await emailHash(signingKey(env), email), (o.metadata && o.metadata.items) || '', o.amount_total || 0, 'paid', new Date().toISOString(), o.payment_intent || '').run();
      }
      if (ev.type === 'charge.refunded' && o.payment_intent) await D.prepare("UPDATE store_orders SET status='refunded', refunded=? WHERE pi=?").bind(new Date().toISOString(), o.payment_intent).run();
      return J({ ok: true });
    }
    if (path === 'order' && m === 'GET') {
      const D = await db(env), s = url.searchParams.get('session') || '';
      const o = D && /^cs_[A-Za-z0-9_]{8,200}$/.test(s) ? await D.prepare('SELECT * FROM store_orders WHERE ref=?').bind(s).first() : null;
      return o ? J(await receipt(env, o, origin)) : J({ ok: false, pending: true, error: 'not found yet: payment confirmations take a few seconds' }, 404);
    }
    if (path === 'lookup' && m === 'POST') {
      const b = await request.json().catch(() => ({})), D = await db(env), code = String(b.code || '').trim().toUpperCase();
      if (!D || !/^[A-Z0-9]{8}$/.test(code) || !b.email) return J({ ok: false, error: 'give the email you paid with and the 8-letter order code from your receipt' }, 400);
      const rows = (await D.prepare('SELECT * FROM store_orders WHERE email_hash=? ORDER BY created DESC LIMIT 50').bind(await emailHash(signingKey(env), b.email)).all()).results || [];
      const o = rows.find((r) => orderCode(r.id) === code);
      return o ? J(await receipt(env, o, origin)) : J({ ok: false, error: 'no order with that email and code' }, 404);
    }
    if (path === 'free' && m === 'POST') {
      const b = await request.json().catch(() => ({})), p = productOf(b.id);
      if (!p || p.cents !== 0 || !p.files || !signingKey(env)) return J({ ok: false, error: 'not a free download' }, 400);
      return J(await receipt(env, { id: 'free_' + crypto.randomUUID().replace(/-/g, ''), items: p.id, status: 'free', provider: 'free', created: new Date().toISOString() }, origin));
    }
    if (path === 'download' && m === 'GET') {
      const t = await verifyToken(signingKey(env), url.searchParams.get('t'));
      const p = t && productOf(t.p), f = p && p.files && p.files[t.f];
      if (!f) return J({ ok: false, error: 'this link has expired or is not valid: open your receipt for a fresh one' }, 403);
      if (!String(t.o).startsWith('free_')) {
        const D = await db(env), o = D && await D.prepare('SELECT status FROM store_orders WHERE id=?').bind(t.o).first();
        if (!o || o.status !== 'paid') return J({ ok: false, error: 'this order is not active (refunded or unknown)' }, 403);
      }
      const headers = { 'content-disposition': 'attachment; filename="' + f.key.split('/').pop() + '"', 'cache-control': 'private, no-store' };
      if (f.asset) { const r = await env.ASSETS.fetch(new Request(new URL(f.asset, origin))); return new Response(r.body, { status: r.status, headers: { ...headers, 'content-type': 'model/gltf-binary' } }); }
      const obj = env.FILMS && await env.FILMS.get(f.key); // R2: paid files live under store/ in the existing bucket (10 GB free)
      return obj ? new Response(obj.body, { headers: { ...headers, 'content-type': 'application/octet-stream' } }) : J({ ok: false, error: 'file not uploaded yet' }, 404);
    }
    return J({ ok: false, error: 'unknown store route', routes: ['catalog', 'status', 'checkout', 'webhook/stripe', 'order', 'lookup', 'free', 'download'] }, 404);
  } catch (e) { return J({ ok: false, error: 'store error' }, 500); }
}
export { STORE_PRODUCTS };
