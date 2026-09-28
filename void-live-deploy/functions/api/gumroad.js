// Gumroad Ping for every product in Atom's store (plan item 12). Set the Ping URL in Gumroad (Settings -> Advanced -> Ping) to
//   https://a-to-mind.com/api/gumroad?k=<GUMROAD_PING_KEY>
// and subscribe the same URL to sale, refund, dispute, dispute_won, cancellation, subscription_ended, subscription_restarted.
// Every ping is recorded in D1 void_sales (append-only: nothing is ever deleted; duplicates are recognised by resource + id).
// Unlocks (lib/gumroad.js UNLOCKS; Void Monthly -> the paid tier):
//   sale                        -> read the sale back from Gumroad's API (GUMROAD_ACCESS_TOKEN, view_sales) and only then set
//                                  void_accounts.tier = 'paid' for the passkey account in url_params[void] (the page adds ?void=<id>)
//   refund, dispute, cancellation, subscription_ended          -> back to 'free' (found by subscription_id or sale_id)
//   subscription_restarted, dispute_won                        -> 'paid' again, only for an account a verified sale already linked
// Pings are unsigned, so the key in the URL is required and an upgrade is never taken on the ping's word alone.
import { unlockFor } from '../../lib/gumroad.js';
import { ensureStoreTables } from '../../lib/store-db.js';
import { ensureTables } from '../../lib/void-me.js';

const DOWN = ['refund', 'dispute', 'cancellation', 'subscription_ended'];
const UP_AGAIN = ['subscription_restarted', 'dispute_won'];
const reply = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

// x-www-form-urlencoded with bracketed keys (url_params[void], custom_fields[Name]) -> nested object
export function parsePing(text) {
  const o = {};
  for (const [k, v] of new URLSearchParams(String(text || ''))) {
    const m = /^([a-z_]+)\[([^\]]*)\]$/i.exec(k);
    if (m) { o[m[1]] = o[m[1]] && typeof o[m[1]] === 'object' ? o[m[1]] : {}; o[m[1]][m[2]] = v; } else o[k] = v;
  }
  return o;
}

async function verifySale(env, p, unlock) {
  if (!env.GUMROAD_ACCESS_TOKEN) return { ok: false, why: 'not verified: no GUMROAD_ACCESS_TOKEN' };
  let j = null;
  try {
    const r = await (env.GUMROAD_FETCH || fetch)('https://api.gumroad.com/v2/sales/' + encodeURIComponent(p.sale_id), { headers: { authorization: 'Bearer ' + env.GUMROAD_ACCESS_TOKEN } });
    j = await r.json();
  } catch (_) { return { ok: false, why: 'not verified: Gumroad API unreachable' }; }
  const s = j && j.success && j.sale;
  if (!s || s.id !== p.sale_id) return { ok: false, why: 'not verified: sale not found' };
  if (!unlockFor({ product_permalink: s.product_permalink, product_name: s.product_name }) || unlockFor({ product_permalink: s.product_permalink, product_name: s.product_name }) !== unlock) return { ok: false, why: 'not verified: different product' };
  if (s.refunded || s.chargedback || s.disputed) return { ok: false, why: 'not verified: refunded or disputed' };
  return { ok: true, subscription_id: s.subscription_id || p.subscription_id || null };
}

export async function onRequestPost({ request, env }) {
  const key = new URL(request.url).searchParams.get('k') || '';
  if (!env.GUMROAD_PING_KEY) return reply(503, { ok: false, error: 'ping not configured' });
  if (key !== env.GUMROAD_PING_KEY) return reply(403, { ok: false, error: 'wrong key' });
  const raw = (await request.text()).slice(0, 50000);
  const p = parsePing(raw);
  const resource = String(p.resource_name || 'sale');
  const ref = p.sale_id || p.subscription_id || '';
  if (!ref) return reply(400, { ok: false, error: 'no sale_id or subscription_id' });
  const id = resource + ':' + ref + ':' + (p.sale_timestamp || p.cancelled_at || p.ended_at || p.updated_at || p.restarted_at || '');
  const product = p.product_permalink || p.permalink || p.product_name || '';
  const voidId = p.url_params && /^[A-Za-z0-9_-]{16,64}$/.test(p.url_params.void || '') ? p.url_params.void : null;
  const now = new Date().toISOString();
  try {
    await ensureStoreTables(env); await ensureTables(env);
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)')
      .bind(id, resource, p.sale_id || null, p.subscription_id || null, String(product).slice(0, 200), voidId, 'recorded', raw, now).run();
    if (!ins.meta || ins.meta.changes !== 1) return reply(200, { ok: true, note: 'already recorded' });
    const unlock = unlockFor(p);
    let effect = 'recorded', verified = 0;
    if (unlock && resource === 'sale' && String(p.refunded) !== 'true') {
      const v = await verifySale(env, p, unlock);
      if (!v.ok) effect = v.why;
      else if (voidId) {
        verified = 1;
        try {
          await env.DB.prepare("INSERT INTO void_accounts (user_id, tier, sale_id, subscription_id, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, sale_id = excluded.sale_id, subscription_id = excluded.subscription_id, updated = excluded.updated")
            .bind(voidId, unlock.tier, p.sale_id, v.subscription_id, now).run();
          effect = 'tier ' + unlock.tier;
        } catch (e) { effect = /UNIQUE|constraint/i.test(String(e && e.message)) ? 'sale already linked to another Void' : 'tier not set'; }
      } else if (v.subscription_id) { // a renewal: the account this subscription already belongs to stays paid
        verified = 1;
        const u = await env.DB.prepare('UPDATE void_accounts SET tier = ?, updated = ? WHERE subscription_id = ? OR sale_id = ?').bind(unlock.tier, now, v.subscription_id, p.sale_id).run();
        effect = u.meta && u.meta.changes ? 'tier ' + unlock.tier + ' (renewal)' : 'verified, no Void id: link by hand';
      } else { verified = 1; effect = 'verified, no Void id: link by hand'; }
    } else if (unlock && (DOWN.includes(resource) || (resource === 'sale' && String(p.refunded) === 'true'))) {
      const u = await env.DB.prepare('UPDATE void_accounts SET tier = ?, updated = ? WHERE subscription_id = ? OR sale_id = ?').bind('free', now, p.subscription_id || '-', p.sale_id || '-').run();
      effect = u.meta && u.meta.changes ? 'tier free (' + resource + ')' : resource + ': no linked Void';
    } else if (unlock && UP_AGAIN.includes(resource)) {
      const u = await env.DB.prepare('UPDATE void_accounts SET tier = ?, updated = ? WHERE subscription_id = ? OR sale_id = ?').bind(unlock.tier, now, p.subscription_id || '-', p.sale_id || '-').run();
      effect = u.meta && u.meta.changes ? 'tier ' + unlock.tier + ' (' + resource + ')' : resource + ': no linked Void';
    }
    await env.DB.prepare('UPDATE void_sales SET verified = ?, effect = ?, void_id = ? WHERE id = ?').bind(verified, effect, voidId, id).run();
    return reply(200, { ok: true, effect });
  } catch (_) { return reply(503, { ok: false, error: 'not recorded, Gumroad will retry' }); }
}
