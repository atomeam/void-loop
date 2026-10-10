// A sale of a hands-on service becomes work on the board (operator, 2026-10-10). When the Gumroad Ping reports a
// purchase of one of the four services (lib/products.js rows with a `send` list), this writes one execution record
// (kind sale.service — the actions card is the owner's notification: the deploy has no email route and nothing here
// writes to the owner's stage) and queues one job on the build queue, the same void_queue builders already claim.
// Everything keys on Gumroad's sale id: a retried Ping adds nothing (the job's target is sale:<id>, checked before
// queueing, on top of the handler's own void_sales dedupe), and a refund Ping cancels a still-open job with its own
// record (kind sale.service.refund). The buyer's address never enters a record or a job: only its domain.
import { PRODUCTS } from './products.js';
import { track } from './actions.js';
import { sellerMatches } from './gumroad.js';

export const domainOf = (email) => {
  const m = String(email || '').trim().match(/@([A-Za-z0-9][A-Za-z0-9.-]{0,78}[A-Za-z0-9])$/);
  return m ? m[1].toLowerCase() : 'unknown';
};

// The service a ping names, by its Gumroad permalink (or product id when the row carries one). Only rows with a
// `send` list count: those are the hands-on services; a membership or software sale is not a job for the crew.
export function serviceFor(p) {
  const perma = String(p.product_permalink || p.permalink || '').split('/l/').pop().split(/[?#/]/)[0];
  return PRODUCTS.find((x) => Array.isArray(x.send) && x.gumroad.slug
    && (x.gumroad.slug === perma || (p.product_id && x.gumroad.productId && x.gumroad.productId === p.product_id))) || null;
}

// The same trust the handler's keyed branch gives an unlock sale: the ping already carried the secret key, so what is
// left is that it is a real sale from Atom's seller account. A test ping or a disputed one never becomes a job.
export function trustedServiceSale(p, env) {
  if (String(p.test) === 'true') return { ok: false, why: 'test ping' };
  if (!sellerMatches(p, env && env.GUMROAD_SELLER_ID)) return { ok: false, why: 'different seller' };
  if (String(p.disputed) === 'true' || String(p.chargebacked) === 'true') return { ok: false, why: 'disputed' };
  return { ok: true };
}

export const jobTarget = (saleId) => 'sale:' + String(saleId).slice(0, 80);
export const jobAsk = (svc, dom) => ('serve ' + svc.name + ' for ' + dom + ': wait for their reply to the receipt, then — ' + svc.send.join(' · ')).slice(0, 900);

const REFUNDISH = ['refund', 'dispute', 'cancellation', 'subscription_ended'];

// The whole flow for one ping. Returns a short line for the handler's reply ('' when this ping is not a service's),
// and throws only when the record itself could not be written (no record, no action).
export async function saleToJob(env, p, resource) {
  const svc = serviceFor(p);
  const saleId = p.sale_id || '';
  if (!svc || !saleId) return '';
  const target = jobTarget(saleId);
  const dom = domainOf(p.email);
  const refunded = REFUNDISH.includes(resource) || (resource === 'sale' && String(p.refunded) === 'true');
  if (resource === 'sale' && !refunded) {
    const t = trustedServiceSale(p, env);
    if (!t.ok) return 'no job: ' + t.why;
    const open = await env.DB.prepare('SELECT id FROM void_queue WHERE target = ? LIMIT 1').bind(target).first();
    if (open) return 'job already queued';
    const { value } = await track(env, { owner: 'gumroad', kind: 'sale.service', ref: svc.id + ' for ' + dom }, async () => {
      const id = Date.now().toString(36), at = new Date().toISOString();
      await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, jobAsk(svc, dom), target, 'queued', 'from a Gumroad sale', at, at).run();
      return 'queued job ' + id + ': ' + svc.name + ' for ' + dom;
    });
    return value;
  }
  if (refunded) {
    const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target = ? AND state IN ('queued','building') LIMIT 1").bind(target).first();
    if (!open) return '';
    const { value } = await track(env, { owner: 'gumroad', kind: 'sale.service.refund', ref: svc.id + ' for ' + dom }, async () => {
      await env.DB.prepare('UPDATE void_queue SET state = ?, note = ?, updated = ? WHERE id = ?')
        .bind('cancelled', 'refunded on Gumroad (' + resource + ')', new Date().toISOString(), open.id).run();
      return 'cancelled job ' + open.id + ': ' + svc.name + ' for ' + dom + ' (' + resource + ')';
    });
    return value;
  }
  return '';
}
