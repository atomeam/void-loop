// /api/store/*: Verse's own store (docs/store.md, lib/store.js). Gumroad is the checkout today; Stripe behind the same adapter.
//   GET  catalog            products, prices, previews, and the Gumroad fallback link for each
//   GET  status             which provider is live and which keys are set (true/false only, never a value)
//   POST checkout {items, email?}   -> { mode: 'gumroad', urls } | { mode: 'stripe', url }   (hosted checkout; no card data here)
//   POST webhook/stripe     Stripe-Signature verified; checkout.session.completed -> order; charge.refunded -> revoked
//   GET  order?session=cs_  the receipt: items, license keys, fresh signed download links (24 h)
//   POST lookup {email, code}  the same receipt again, by the buyer's email and the 8-letter order code
//   POST free {id}          a free download (no order saved): signed links straight away
//   GET  download?t=        verifies the token (and that the order isn't refunded), then serves the file (a share: a zip of the unlocked items)
//   POST share/claim {sale_id, email}  a Gumroad pay-a-share sale -> order, from the keyed ping already in void_sales (lib/pay-share.js)
//   POST checkout {items:[id], pay?, upgrade?}  pay: the buyer's chosen amount for ONE pay-a-share product (clamped $1..price);
//        upgrade: an order code + email; the server charges exactly the difference. The share itself is always decided from the
//        provider-verified amount (Stripe amount_total, Gumroad ping price), never from these fields.
import { isShareProduct, shareFor, itemKey, paidTotal, CREDITS_TABLE, zipStore } from '../../../lib/pay-share.js';
import { parsePing } from '../../../lib/earnings.js';
import { ownerOk } from '../../../lib/guard.js';
import { specialRails, instructions, verifyUsdcTx, usdcUnits, railsOf, USDC_BASE } from '../../../lib/alt-pay.js';
import { sellerMatches } from '../../../lib/gumroad.js';
import { gumroadUrl, STORE_PRODUCTS, productOf, publicCatalog, providerOf, signingKey, signToken, verifyToken, licenseKey, verifyStripe, ADAPTERS, ORDERS_TABLE, emailHash, orderCode } from '../../../lib/store.js';

const J = (b, s = 200, cache = 'no-store') => Response.json(b, { status: s, headers: { 'cache-control': cache } });
const DAY = 24 * 3600e3;
const db = async (env) => { if (!env.DB) return null; await env.DB.prepare(ORDERS_TABLE).run(); await env.DB.prepare(CREDITS_TABLE).run(); return env.DB; };
const usd = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
// a Gumroad order is live while no refund/dispute ping for its sale has landed (gumroad.js records every ping in void_sales)
async function gumroadLive(D, ref) {
  const sid = String(ref || '').replace(/^gumroad:/, ''); if (!sid) return false;
  const r = await D.prepare("SELECT COUNT(*) AS n FROM void_sales WHERE sale_id=? AND (resource IN ('refund','dispute') OR raw LIKE '%refunded=true%' OR raw LIKE '%chargebacked=true%')").bind(sid).first().catch(() => null);
  return !(r && r.n > 0);
}

async function receipt(env, order, origin) {
  const key = signingKey(env), items = String(order.items || '').split(',').map(productOf).filter(Boolean), e = Date.now() + DAY;
  const out = [];
  const D = order.status === 'paid' && env.DB ? await db(env) : null;
  for (const p of items) {
    const row = { id: p.id, name: p.name, license: await licenseKey(key, order.id, p.id), downloads: [] };
    if (isShareProduct(p)) { // pay a share: one zip of the unlocked items, recomputed from the verified total on every download
      if (order.status !== 'paid' || !D) { out.push(row); continue; }
      const total = await paidTotal(D, order), sh = shareFor(p, total);
      row.share = { paid: total, price: p.cents, pct: sh.pct, unlocked: sh.unlocked, locked: sh.locked.length, of: sh.n, got: sh.k, upgrade: sh.upgradeCents ? { cents: sh.upgradeCents, line: 'Pay ' + usd(sh.upgradeCents) + ' more to unlock the other ' + sh.locked.length, code: orderCode(order.id) } : null };
      row.downloads.push({ name: p.id + (sh.locked.length ? '-' + sh.k + '-of-' + sh.n : '') + '.zip', url: origin + '/api/store/download?t=' + await signToken(key, { o: order.id, p: p.id, z: 1, e }) });
      out.push(row); continue;
    }
    if (order.status === 'paid' || order.status === 'free') for (let i = 0; i < (p.files || []).length; i++) row.downloads.push({ name: p.files[i].key.split('/').pop(), url: origin + '/api/store/download?t=' + await signToken(key, { o: order.id, p: p.id, f: i, e }) });
    out.push(row);
  }
  return { order: order.id, code: orderCode(order.id), status: order.status, provider: order.provider, created: order.created, items: out, expires: new Date(e).toISOString() };
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx, url = new URL(request.url), origin = url.origin;
  const path = [].concat(params.path || []).join('/'), m = request.method;
  try {
    if (path === 'catalog' && m === 'GET') return J({ products: publicCatalog().map((p) => { const r = specialRails(productOf(p.id), env); return r.length ? { ...p, special: r } : p; }), provider: providerOf(env).provider }, 200, 'public, max-age=300');
    if (path === 'status' && m === 'GET') { const s = providerOf(env); return J({ provider: s.provider, wanted: s.wanted, stripe_keys: s.stripeReady, signing_key: s.signing, orders_db: !!env.DB, files_bucket: !!env.FILMS, special_rails: Object.keys(railsOf(env)) }); }
    if (path === 'checkout' && m === 'POST') {
      const b = await request.json().catch(() => ({}));
      // product ids only: any price, amount, discount or coupon in the body is ignored, every amount comes from lib/store.js (lib/price-lock.js)
      const items = [...new Set([].concat(b.items || []).filter((x) => typeof x === 'string'))].slice(0, 20).map(productOf).filter((p) => p && !p.soon && p.cents > 0);
      if (!items.length) return J({ ok: false, error: 'nothing to buy in the cart' }, 400);
      const email = /^[^@\s]{1,64}@[^@\s]{1,190}$/.test(String(b.email || '')) ? String(b.email) : '';
      const s = providerOf(env), amounts = {}, meta = {}, share = items.filter(isShareProduct);
      if (share.length) { // a pay-a-share product checks out alone, so Stripe's amount_total is that product's verified amount
        if (items.length > 1) return J({ ok: false, error: 'a pay-what-you-want pack checks out on its own' }, 400);
        const p = share[0];
        if (b.upgrade) { // pay the difference: the server finds the order and charges exactly what is left; the buyer picks nothing
          const D = await db(env), code = String(b.upgrade).trim().toUpperCase();
          const rows = D && /^[A-Z0-9]{8}$/.test(code) && b.email ? ((await D.prepare('SELECT * FROM store_orders WHERE email_hash=? ORDER BY created DESC LIMIT 50').bind(await emailHash(signingKey(env), b.email)).all()).results || []) : [];
          const o = rows.find((r) => orderCode(r.id) === code && r.status === 'paid' && String(r.items) === p.id);
          if (!o) return J({ ok: false, error: 'no paid order of this pack with that email and code' }, 404);
          const left = shareFor(p, await paidTotal(D, o)).upgradeCents;
          if (!left) return J({ ok: false, error: 'that order already has everything' }, 400);
          amounts[p.id] = left; meta.upgrade = o.id;
          if (s.provider !== 'stripe') return J({ ok: true, mode: 'gumroad', urls: p.gumroad ? [gumroadUrl(p, 'upgrade') + '&upgrade=' + orderCode(o.id)] : [], pay: left, note: 'On Gumroad, pay ' + usd(left) + '; your order code is passed along and credited.' });
        } else {
          const pay = Math.round(Number(b.pay) * 1) || p.cents; amounts[p.id] = Math.max(100, Math.min(p.cents, pay)); // the buyer's choice, clamped
        }
        meta.share = p.id;
      }
      return J({ ok: true, ...(await ADAPTERS[s.provider].checkout(items, { env, origin, email, amounts, meta })) });
    }
    if (path === 'webhook/stripe' && m === 'POST') {
      const body = await request.text();
      if (!(await verifyStripe(env.STRIPE_WEBHOOK_SECRET, request.headers.get('stripe-signature'), body))) return J({ ok: false }, 400);
      const ev = JSON.parse(body), o = ev.data && ev.data.object || {}, D = await db(env);
      if (!D) return J({ ok: false, error: 'no orders db' }, 503);
      const md = o.metadata || {};
      if (ev.type === 'checkout.session.completed' && o.payment_status === 'paid' && md.upgrade) { // a top-up: credit the order it names
        const base = await D.prepare("SELECT * FROM store_orders WHERE id=? AND status='paid'").bind(String(md.upgrade)).first();
        if (base && String(base.items) === String(md.items)) await D.prepare('INSERT OR IGNORE INTO store_credits (ref, order_id, cents, provider, at) VALUES (?,?,?,?,?)').bind(o.id, base.id, o.amount_total || 0, 'stripe', new Date().toISOString()).run();
        return J({ ok: true, credited: !!base });
      }
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
    // special items (lib/alt-pay.js): Cash App / USDC on Base. Price and amount come from the catalog and order id only.
    if (path === 'special/start' && m === 'POST') {
      const b = await request.json().catch(() => ({})), p = productOf(String(b.id || '')), rail = String(b.rail || ''), D = await db(env);
      if (!p || !specialRails(p, env).includes(rail)) return J({ ok: false, error: 'that item has no ' + (rail || 'such') + ' option' }, 400);
      if (!D || !signingKey(env) || !/^[^@\s]{1,64}@[^@\s]{1,190}$/.test(String(b.email || ''))) return J({ ok: false, error: 'give an email for your receipt' }, 400);
      const id = 'ord_' + crypto.randomUUID().replace(/-/g, ''), o = { id };
      await D.prepare('INSERT INTO store_orders (id, provider, ref, email_hash, items, cents, status, created, pi) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, rail, 'pending:' + id, await emailHash(signingKey(env), b.email), p.id, p.cents, 'awaiting', new Date().toISOString(), '').run();
      return J({ ok: true, order: id, code: orderCode(id), status: 'awaiting', ...instructions(rail, p, o, env) });
    }
    if (path === 'special/confirm' && m === 'POST') { // the buyer's reference; crypto is checked on chain, Cash App waits for the owner
      const b = await request.json().catch(() => ({})), D = await db(env), code = String(b.code || '').trim().toUpperCase();
      if (!D || !/^[A-Z0-9]{8}$/.test(code) || !b.email) return J({ ok: false, error: 'give the email and 8-letter order code' }, 400);
      const rows = (await D.prepare("SELECT * FROM store_orders WHERE email_hash=? AND provider IN ('cashapp','usdc-base') ORDER BY created DESC LIMIT 50").bind(await emailHash(signingKey(env), b.email)).all()).results || [];
      const o = rows.find((r) => orderCode(r.id) === code);
      if (!o) return J({ ok: false, error: 'no special order with that email and code' }, 404);
      if (o.status !== 'awaiting') return J(await receipt(env, o, origin));
      const ref = String(b.ref || '').trim();
      if (o.provider === 'usdc-base') {
        const to = (railsOf(env)['usdc-base'] || {}).address; if (!to) return J({ ok: false, error: 'crypto checkout is off right now' }, 503);
        const tx = ref.toLowerCase(), v = await verifyUsdcTx(env, tx, to, usdcUnits(o.cents, o.id), env.BASE_FETCH);
        if (!v.ok) return J({ ok: false, status: 'awaiting', retry: !!v.retry, error: v.reason }, v.retry ? 202 : 400);
        if (await D.prepare('SELECT id FROM store_orders WHERE ref=?').bind('usdc-base:' + tx).first()) return J({ ok: false, error: 'that transaction already paid for an order' }, 409);
        await D.prepare("UPDATE store_orders SET status='paid', ref=?, pi=? WHERE id=? AND status='awaiting'").bind('usdc-base:' + tx, tx, o.id).run();
        return J(await receipt(env, { ...o, status: 'paid', ref: 'usdc-base:' + tx }, origin));
      }
      if (!/^[A-Za-z0-9#_-]{4,64}$/.test(ref)) return J({ ok: false, error: 'give the payment reference from your Cash App receipt' }, 400);
      await D.prepare("UPDATE store_orders SET pi=? WHERE id=? AND status='awaiting'").bind('cashapp:' + ref, o.id).run();
      return J({ ok: true, status: 'awaiting', code, note: 'Got it. The owner checks Cash App and confirms; then the same order code and email open your downloads.' }, 202);
    }
    if (path === 'special/queue' && m === 'GET') { // owner only: Cash App (and stuck crypto) orders waiting for a human
      if (!(await ownerOk(request, env))) return J({ ok: false, error: 'only the owner' }, 403);
      const D = await db(env), r = D ? (await D.prepare("SELECT id, provider, items, cents, created, pi FROM store_orders WHERE status='awaiting' ORDER BY created LIMIT 100").all()).results || [] : [];
      return J({ ok: true, awaiting: r.map((o) => ({ ...o, code: orderCode(o.id) })) });
    }
    if (path === 'special/approve' && m === 'POST') { // owner only, after seeing the money in Cash App: paid, or rejected
      if (!(await ownerOk(request, env))) return J({ ok: false, error: 'only the owner' }, 403);
      const b = await request.json().catch(() => ({})), D = await db(env), st = b.ok === false ? 'rejected' : 'paid';
      const r = D && /^ord_[a-f0-9]{32}$/.test(String(b.order || '')) ? await D.prepare("UPDATE store_orders SET status=? WHERE id=? AND status='awaiting' AND provider='cashapp'").bind(st, b.order).run() : null;
      return J({ ok: !!(r && r.meta && r.meta.changes), status: st });
    }
    // x402-style pay-per-resource (docs/payments.md), off unless X402_ENABLED=on and a USDC address is set. Receive-only:
    // no facilitator, no keys. GET -> 402 with exact requirements and an order id; pay on Base; retry with X-PAYMENT: {"order","tx"}.
    if (path.startsWith('x402/') && m === 'GET') {
      const p = productOf(path.slice(5)), to = (railsOf(env)['usdc-base'] || {}).address, D = await db(env);
      if (env.X402_ENABLED !== 'on' || !to || !D || !signingKey(env)) return J({ ok: false, error: 'x402 is off' }, 404);
      if (!p || !specialRails(p, env).includes('usdc-base')) return J({ ok: false, error: 'not sold over x402' }, 404);
      let pay = null; try { pay = JSON.parse(request.headers.get('x-payment') || 'null'); } catch (_) {}
      if (pay && /^ord_[a-f0-9]{32}$/.test(String(pay.order || ''))) {
        const o = await D.prepare("SELECT * FROM store_orders WHERE id=? AND provider='usdc-base'").bind(pay.order).first();
        if (!o || o.items !== p.id) return J({ ok: false, error: 'unknown order' }, 404);
        if (o.status === 'paid') return J(await receipt(env, o, origin));
        const tx = String(pay.tx || '').toLowerCase(), v = await verifyUsdcTx(env, tx, to, usdcUnits(o.cents, o.id), env.BASE_FETCH);
        if (!v.ok) return J({ ok: false, error: v.reason, retry: !!v.retry }, 402);
        if (await D.prepare('SELECT id FROM store_orders WHERE ref=?').bind('usdc-base:' + tx).first()) return J({ ok: false, error: 'that transaction already paid for an order' }, 409);
        await D.prepare("UPDATE store_orders SET status='paid', ref=?, pi=? WHERE id=? AND status='awaiting'").bind('usdc-base:' + tx, tx, o.id).run();
        return J(await receipt(env, { ...o, status: 'paid' }, origin));
      }
      const id = 'ord_' + crypto.randomUUID().replace(/-/g, '');
      await D.prepare('INSERT INTO store_orders (id, provider, ref, email_hash, items, cents, status, created, pi) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, 'usdc-base', 'pending:' + id, '', p.id, p.cents, 'awaiting', new Date().toISOString(), 'x402').run();
      return J({ x402Version: 1, error: 'payment required', accepts: [{ scheme: 'exact-onchain', network: 'base', asset: USDC_BASE, payTo: to, maxAmountRequired: usdcUnits(p.cents, id).toString(), resource: origin + '/api/store/x402/' + p.id, description: p.name, extra: { order: id, retryHeader: 'X-PAYMENT: {"order":"' + id + '","tx":"0x..."}', confirmations: 5 } }] }, 402);
    }
    if (path === 'share/claim' && m === 'POST') { // a Gumroad pay-a-share sale, from the keyed ping gumroad.js already stored
      const b = await request.json().catch(() => ({})), D = await db(env), sid = String(b.sale_id || '').trim();
      if (!D || !/^[A-Za-z0-9=_-]{6,80}$/.test(sid) || !b.email || !signingKey(env)) return J({ ok: false, error: 'give the Gumroad sale id from your receipt and the email you paid with' }, 400);
      const row = await D.prepare("SELECT raw FROM void_sales WHERE sale_id=? AND resource='sale' ORDER BY at LIMIT 1").bind(sid).first();
      const pg = row ? parsePing(row.raw) : null;
      const p = pg && STORE_PRODUCTS.find((x) => isShareProduct(x) && x.gumroad && [pg.product_permalink, pg.permalink].some((v) => v && (v === x.gumroad || String(v).endsWith('/' + x.gumroad))));
      if (!p || String(pg.email || '').trim().toLowerCase() !== String(b.email).trim().toLowerCase()) return J({ ok: false, error: 'no pay-what-you-want sale with that id and email yet: Gumroad pings take a few seconds' }, 404);
      let cents = Math.floor(Number(pg.price)) || 0; // Gumroad's ping: price in cents, from the keyed URL only Gumroad knows
      if (env.GUMROAD_ACCESS_TOKEN) { // with a token, the amount is read back from Gumroad itself
        const j = await (env.GUMROAD_FETCH || fetch)('https://api.gumroad.com/v2/sales/' + encodeURIComponent(sid), { headers: { authorization: 'Bearer ' + env.GUMROAD_ACCESS_TOKEN } }).then((r) => r.json()).catch(() => null);
        const sale = j && j.success && j.sale;
        if (!sale || sale.id !== sid || sale.refunded || sale.chargedback || sale.disputed) return J({ ok: false, error: 'Gumroad could not confirm that sale' }, 403);
        cents = Math.floor(Number(sale.price)) || 0;
      } else if (String(pg.test) === 'true' || !sellerMatches(pg, env.GUMROAD_SELLER_ID) || String(pg.refunded) === 'true' || String(pg.disputed) === 'true' || String(pg.chargebacked) === 'true') {
        return J({ ok: false, error: 'that sale is not trusted (test, refunded or another seller)' }, 403);
      }
      if (!(cents > 0) || !(await gumroadLive(D, sid))) return J({ ok: false, error: 'that sale is not active' }, 403);
      const eh = await emailHash(signingKey(env), b.email), up = String((pg.url_params && pg.url_params.upgrade) || '').toUpperCase();
      if (up) { // pay the difference later on Gumroad: the order code rides in url_params and the sale is credited to that order
        const rows = (await D.prepare('SELECT * FROM store_orders WHERE email_hash=? ORDER BY created DESC LIMIT 50').bind(eh).all()).results || [];
        const base = rows.find((r) => orderCode(r.id) === up && r.status === 'paid' && String(r.items) === p.id);
        if (base) { await D.prepare('INSERT OR IGNORE INTO store_credits (ref, order_id, cents, provider, at) VALUES (?,?,?,?,?)').bind('gumroad:' + sid, base.id, cents, 'gumroad', new Date().toISOString()).run(); return J(await receipt(env, base, origin)); }
      }
      await D.prepare('INSERT OR IGNORE INTO store_orders (id, provider, ref, email_hash, items, cents, status, created, pi) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind('ord_' + crypto.randomUUID().replace(/-/g, ''), 'gumroad', 'gumroad:' + sid, eh, p.id, cents, 'paid', new Date().toISOString(), '').run();
      return J(await receipt(env, await D.prepare('SELECT * FROM store_orders WHERE ref=?').bind('gumroad:' + sid).first(), origin));
    }
    if (path === 'download' && m === 'GET' && String(url.searchParams.get('t') || '').length) {
      const t0 = await verifyToken(signingKey(env), url.searchParams.get('t')), sp = t0 && t0.z && productOf(t0.p);
      if (sp && isShareProduct(sp)) { // the zip of what the verified total unlocks; the token says which order, never how much
        const D = await db(env), o = D && await D.prepare('SELECT * FROM store_orders WHERE id=?').bind(t0.o).first();
        if (!o || o.status !== 'paid' || String(o.items) !== sp.id || (o.provider === 'gumroad' && !(await gumroadLive(D, o.ref)))) return J({ ok: false, error: 'this order is not active (refunded or unknown)' }, 403);
        const sh = shareFor(sp, await paidTotal(D, o)), files = [];
        for (const name of sh.unlocked) { const obj = env.FILMS && await env.FILMS.get(itemKey(sp, name)); if (!obj) return J({ ok: false, error: 'file not uploaded yet' }, 404); files.push({ name, data: new Uint8Array(await obj.arrayBuffer()) }); }
        const fn = sp.id + (sh.locked.length ? '-' + sh.k + '-of-' + sh.n : '') + '.zip';
        return new Response(zipStore(files), { headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="' + fn + '"', 'cache-control': 'private, no-store' } });
      }
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
    return J({ ok: false, error: 'unknown store route', routes: ['catalog', 'status', 'checkout', 'webhook/stripe', 'order', 'lookup', 'free', 'download', 'share/claim', 'special/start', 'special/confirm', 'special/queue', 'special/approve'] }, 404);
  } catch (e) { return J({ ok: false, error: 'store error' }, 500); }
}
export { STORE_PRODUCTS };
