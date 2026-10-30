// Gumroad Ping for every product in Atom's store (plan item 12). Set the Ping URL in Gumroad (Settings -> Advanced -> Ping) to
//   https://a-to-mind.com/api/gumroad?k=<GUMROAD_PING_KEY>
// and subscribe the same URL to sale, refund, dispute, dispute_won, cancellation, subscription_ended, subscription_restarted.
// Every ping is recorded in D1 void_sales (append-only: nothing is ever deleted; duplicates are recognised by resource + id).
// Unlocks (lib/gumroad.js UNLOCKS, by Gumroad product id / permalink so a rename changes nothing; the paid membership -> the paid tier):
//   sale                        -> set void_accounts.tier = 'paid' for the passkey account in url_params[void] (the page adds ?void=<id>)
//                                  once the sale is trusted: with GUMROAD_ACCESS_TOKEN set, it's read back from Gumroad's API
//                                  (view_sales); without a token, the ping itself is trusted only when it came with the right ?k=,
//                                  carries Atom's seller_id (lib/gumroad.js SELLER_IDS) and is for
//                                  the membership that unlocks paid Verse. A test ping counts here: Gumroad makes one only when
//                                  the creator buys their own product (owner, 2026-10-30: "i joined and still got this page only"),
//                                  so it unlocks the owner's own Verse; it is still never money (lib/earnings.js) or a job.
//   later                       -> a recorded sale the rules above now trust is applied when its Verse next loads (relinkRecorded)
//   refund, dispute, cancellation, subscription_ended          -> back to 'free' (found by subscription_id or sale_id)
//   subscription_restarted, dispute_won                        -> 'paid' again, only for an account a verified sale already linked
// Pings are unsigned, so the key in the URL is always required; one sale links to one Verse only (void_accounts.sale_id is unique).
// After each ping the running total is recomputed (lib/earnings.js) and any milestone crossed is recorded once (void_milestones).
import { sameSecret, ownerAccount } from '../../lib/guard.js';
import { unlockFor, sellerMatches } from '../../lib/gumroad.js';
import { ensureStoreTables } from '../../lib/store-db.js';
import { ensureTables } from '../../lib/void-me.js';
import { parsePing, readEarnings, recordMilestones } from '../../lib/earnings.js';
import { saleToJob } from '../../lib/sale-jobs.js';

const DOWN = ['refund', 'dispute', 'cancellation', 'subscription_ended'];
const UP_AGAIN = ['subscription_restarted', 'dispute_won'];
const reply = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export { parsePing };

async function verifySale(env, p, unlock) {
  if (!env.GUMROAD_ACCESS_TOKEN) { // no API token: the keyed ping is trusted on its own, but only from Atom's seller account
    if (!sellerMatches(p, env.GUMROAD_SELLER_ID)) return { ok: false, why: 'not trusted: different seller' };
    if (String(p.disputed) === 'true' || String(p.chargebacked) === 'true') return { ok: false, why: 'not trusted: disputed' };
    return { ok: true, subscription_id: p.subscription_id || null, how: String(p.test) === 'true' ? 'owner test purchase' : 'keyed ping' };
  }
  let j = null;
  try {
    const r = await (env.GUMROAD_FETCH || fetch)('https://api.gumroad.com/v2/sales/' + encodeURIComponent(p.sale_id), { headers: { authorization: 'Bearer ' + env.GUMROAD_ACCESS_TOKEN } });
    j = await r.json();
  } catch (_) { return { ok: false, why: 'not verified: Gumroad API unreachable' }; }
  const s = j && j.success && j.sale;
  if (!s || s.id !== p.sale_id) return { ok: false, why: 'not verified: sale not found' };
  if (unlockFor({ product_permalink: s.product_permalink, product_id: s.product_id }) !== unlock) return { ok: false, why: 'not verified: different product' };
  if (s.refunded || s.chargedback || s.disputed) return { ok: false, why: 'not verified: refunded or disputed' };
  return { ok: true, subscription_id: s.subscription_id || p.subscription_id || null };
}

export async function onRequestPost({ request, env }) {
  const key = new URL(request.url).searchParams.get('k') || '';
  if (!env.GUMROAD_PING_KEY) return reply(503, { ok: false, error: 'ping not configured' });
  if (!(await sameSecret(key, env.GUMROAD_PING_KEY))) return reply(403, { ok: false, error: 'wrong key' });
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
        } catch (e) { effect = /UNIQUE|constraint/i.test(String(e && e.message)) ? 'sale already linked to another Verse' : 'tier not set'; }
      } else if (v.subscription_id) { // a renewal: the account this subscription already belongs to stays paid
        verified = 1;
        const u = await env.DB.prepare('UPDATE void_accounts SET tier = ?, updated = ? WHERE subscription_id = ? OR sale_id = ?').bind(unlock.tier, now, v.subscription_id, p.sale_id).run();
        effect = u.meta && u.meta.changes ? 'tier ' + unlock.tier + ' (renewal)' : 'verified, no Verse id: link by hand';
      } else { verified = 1; effect = 'verified, no Verse id: link by hand'; }
    } else if (unlock && (DOWN.includes(resource) || (resource === 'sale' && String(p.refunded) === 'true'))) {
      const u = await env.DB.prepare('UPDATE void_accounts SET tier = ?, updated = ? WHERE subscription_id = ? OR sale_id = ?').bind('free', now, p.subscription_id || '-', p.sale_id || '-').run();
      effect = u.meta && u.meta.changes ? 'tier free (' + resource + ')' : resource + ': no linked Verse';
    } else if (unlock && UP_AGAIN.includes(resource)) {
      const u = await env.DB.prepare('UPDATE void_accounts SET tier = ?, updated = ? WHERE subscription_id = ? OR sale_id = ?').bind(unlock.tier, now, p.subscription_id || '-', p.sale_id || '-').run();
      effect = u.meta && u.meta.changes ? 'tier ' + unlock.tier + ' (' + resource + ')' : resource + ': no linked Verse';
    }
    await env.DB.prepare('UPDATE void_sales SET verified = ?, effect = ?, void_id = ? WHERE id = ?').bind(verified, effect, voidId, id).run();
    // a service sale becomes work on the board (lib/sale-jobs.js): one record, one job, keyed on the sale id. Its
    // failure never breaks the ping (a 503 here would make Gumroad retry a sale that was recorded).
    let service = '';
    try { service = await saleToJob(env, p, resource); } catch (e) { service = 'job not queued: ' + ((e && e.message) || e); }
    // the running total (all products, net of refunds); a milestone is recorded the first time it's crossed, never again
    let crossed = [];
    try { crossed = await recordMilestones(env, await readEarnings(env)); } catch (_) {}
    return reply(200, { ok: true, effect, ...(service ? { service } : {}), ...(crossed.length ? { milestones: crossed } : {}) });
  } catch (_) { return reply(503, { ok: false, error: 'not recorded, Gumroad will retry' }); }
}

// A sale recorded for this Verse that was not trusted then (a ping from before a rule changed) is applied now, under today's rules.
// Only keyed pings are ever recorded, so this is the same as the ping arriving again; a sale with a later refund, dispute, cancellation
// or end on record is left alone, as is one already linked to another Verse. -> the tier set, or null. Called by /api/members.
export async function relinkRecorded(env, voidId) {
  if (!voidId) return null;
  await ensureStoreTables(env);
  const rows = (await env.DB.prepare("SELECT s.id, s.raw FROM void_sales s WHERE s.void_id = ? AND s.resource = 'sale' AND s.verified = 0 AND NOT EXISTS (SELECT 1 FROM void_sales d WHERE d.resource IN ('refund', 'dispute', 'cancellation', 'subscription_ended') AND (d.sale_id = s.sale_id OR (s.subscription_id IS NOT NULL AND d.subscription_id = s.subscription_id))) ORDER BY s.at DESC LIMIT 5").bind(voidId).all()).results || [];
  let hit = null;
  for (const r of rows) {
    const p = parsePing(r.raw);
    const unlock = unlockFor(p);
    if (!unlock || !p.sale_id || String(p.refunded) === 'true') continue;
    const v = await verifySale(env, p, unlock);
    if (v.ok) { hit = { id: r.id, p, unlock, v }; break; }
  }
  if (!hit) return null;
  const now = new Date().toISOString();
  try {
    await env.DB.prepare('INSERT INTO void_accounts (user_id, tier, sale_id, subscription_id, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, sale_id = excluded.sale_id, subscription_id = excluded.subscription_id, updated = excluded.updated')
      .bind(voidId, hit.unlock.tier, hit.p.sale_id, hit.v.subscription_id, now).run();
  } catch (_) { return null; } // that sale is already linked to another Verse
  await env.DB.prepare('UPDATE void_sales SET verified = 1, effect = ? WHERE id = ?').bind('tier ' + hit.unlock.tier + ' (applied later)', hit.id).run();
  return hit.unlock.tier;
}

// A buyer links their own purchase to their own Verse, with the Order ID from the Gumroad receipt and the email they paid with
// (owner, 2026-10-30: "i paid and everything just now and it went nowhere"). This covers a purchase made with no ?void= on the
// link (bought signed out, from another page, or from Gumroad itself). The sale must be a keyed ping already in void_sales, or,
// with GUMROAD_ACCESS_TOKEN set, a sale Gumroad's API returns. The same rules as the ping apply: verifySale, no later refund,
// dispute, cancellation or end, and one sale links to one Verse only. A ping made for another Verse (url_params.void) stays
// with that Verse. -> { ok: true, tier } or { ok: false, status, why }. Called by POST /api/members { do: 'claim' }.
const DOWN_SQL = "SELECT COUNT(*) AS n FROM void_sales d WHERE d.resource IN ('refund', 'dispute', 'cancellation', 'subscription_ended') AND (d.sale_id = ? OR (? IS NOT NULL AND d.subscription_id = ?))";
export async function claimSale(env, voidId, ref, email) {
  const sid = String(ref || '').trim(), mail = String(email || '').trim().toLowerCase();
  if (!voidId) return { ok: false, status: 401, why: 'sign in with your passkey first' };
  if (!/^[A-Za-z0-9=_+/-]{6,80}$/.test(sid) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, status: 400, why: 'give the Order ID from your Gumroad receipt and the email you paid with' };
  await ensureStoreTables(env); await ensureTables(env);
  let rows = (await env.DB.prepare("SELECT id, raw FROM void_sales WHERE resource = 'sale' AND sale_id = ? ORDER BY at DESC LIMIT 5").bind(sid).all()).results || [];
  if (!rows.length && /^\d{4,20}$/.test(sid)) { // the receipt can show the order number in place of the sale id
    const recent = (await env.DB.prepare("SELECT id, raw FROM void_sales WHERE resource = 'sale' ORDER BY at DESC LIMIT 500").all()).results || [];
    rows = recent.filter((r) => String(parsePing(r.raw).order_number || '') === sid);
  }
  let p = null, rowId = null;
  for (const r of rows) { const q = parsePing(r.raw); if (unlockFor(q)) { p = q; rowId = r.id; break; } }
  if (!p && env.GUMROAD_ACCESS_TOKEN && !/^\d+$/.test(sid)) { // no ping on record: read the sale back from Gumroad itself
    let j = null;
    try { j = await (await (env.GUMROAD_FETCH || fetch)('https://api.gumroad.com/v2/sales/' + encodeURIComponent(sid), { headers: { authorization: 'Bearer ' + env.GUMROAD_ACCESS_TOKEN } })).json(); } catch (_) { j = null; }
    const s = j && j.success && j.sale;
    if (s && s.id === sid) p = { sale_id: s.id, email: s.email, product_id: s.product_id, product_permalink: s.product_permalink, subscription_id: s.subscription_id || '', refunded: String(!!(s.refunded || s.chargedback || s.disputed)) };
  }
  if (!p) return { ok: false, status: 404, why: 'Verse has no record of that order yet. Gumroad sends it a minute after you pay, so try again soon.' };
  const unlock = unlockFor(p);
  if (!unlock) return { ok: false, status: 404, why: 'that order is not a MultiVerse membership' };
  if (String(p.email || '').trim().toLowerCase() !== mail) return { ok: false, status: 403, why: 'that email is not the one on this order' };
  const owner = p.url_params && p.url_params.void;
  if (owner && owner !== voidId) return { ok: false, status: 409, why: 'that order was made for another Verse' };
  if (String(p.refunded) === 'true') return { ok: false, status: 403, why: 'that order was refunded' };
  const sub = p.subscription_id || null;
  const down = await env.DB.prepare(DOWN_SQL).bind(p.sale_id, sub, sub).first();
  if (down && down.n > 0) return { ok: false, status: 403, why: 'that membership was refunded, disputed or cancelled' };
  const v = rowId ? await verifySale(env, p, unlock) : { ok: true, subscription_id: sub }; // an API sale was verified as it was read
  if (!v.ok) return { ok: false, status: 403, why: 'Verse cannot confirm that order (' + v.why + ')' };
  const held = await env.DB.prepare('SELECT user_id FROM void_accounts WHERE sale_id = ?').bind(p.sale_id).first();
  if (held && held.user_id !== voidId) return { ok: false, status: 409, why: 'that order already unlocks another Verse' };
  const now = new Date().toISOString();
  try {
    await env.DB.prepare('INSERT INTO void_accounts (user_id, tier, sale_id, subscription_id, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, sale_id = excluded.sale_id, subscription_id = excluded.subscription_id, updated = excluded.updated')
      .bind(voidId, unlock.tier, p.sale_id, v.subscription_id, now).run();
  } catch (_) { return { ok: false, status: 409, why: 'that order already unlocks another Verse' }; }
  if (rowId) await env.DB.prepare('UPDATE void_sales SET verified = 1, effect = ?, void_id = ? WHERE id = ?').bind('tier ' + unlock.tier + ' (claimed with the receipt)', voidId, rowId).run();
  return { ok: true, tier: unlock.tier };
}

// The owner's own purchase links itself (coordinator, 2026-10-30: "buyers should never have to paste an Order ID"). Gumroad makes a
// test ping only when the creator buys their own product, so a trusted test sale that reached Verse with no Verse id belongs to the
// owner. It is linked to the account the owner signs in with: an account with a passkey the owner bound (void_owner_passkeys, which
// only READ_TOKEN can write). The usual rules still hold: Atom's seller, the membership product, verifySale, no later refund,
// dispute, cancellation or end, and a sale already linked to a Verse stays there. -> the tier set, or null. Called by /api/members.
export async function linkOwnerTest(env, voidId) {
  if (!voidId) return null;
  await ensureStoreTables(env); await ensureTables(env);
  if (!(await ownerAccount(env, voidId))) return null; // the shared owner check (lib/guard.js)
  const rows = (await env.DB.prepare("SELECT s.id, s.raw FROM void_sales s WHERE s.resource = 'sale' AND s.void_id IS NULL AND s.raw LIKE '%test=true%' AND NOT EXISTS (SELECT 1 FROM void_accounts a WHERE a.sale_id = s.sale_id) AND NOT EXISTS (SELECT 1 FROM void_sales d WHERE d.resource IN ('refund', 'dispute', 'cancellation', 'subscription_ended') AND (d.sale_id = s.sale_id OR (s.subscription_id IS NOT NULL AND d.subscription_id = s.subscription_id))) ORDER BY s.at DESC LIMIT 5").all()).results || [];
  for (const r of rows) {
    const p = parsePing(r.raw), unlock = unlockFor(p);
    if (String(p.test) !== 'true' || !unlock || !p.sale_id || String(p.refunded) === 'true' || (p.url_params && p.url_params.void)) continue;
    const v = await verifySale(env, p, unlock);
    if (!v.ok) continue;
    const now = new Date().toISOString();
    try {
      await env.DB.prepare('INSERT INTO void_accounts (user_id, tier, sale_id, subscription_id, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, sale_id = excluded.sale_id, subscription_id = excluded.subscription_id, updated = excluded.updated') // void-review: ok (one write tried at a time on purpose: the loop stops at the first sale that links, at most 5 tries)
        .bind(voidId, unlock.tier, p.sale_id, v.subscription_id, now).run();
    } catch (_) { continue; }
    await env.DB.prepare('UPDATE void_sales SET verified = 1, effect = ?, void_id = ? WHERE id = ?').bind('tier ' + unlock.tier + ' (owner test purchase, linked to the owner)', voidId, r.id).run(); // void-review: ok (runs once: the loop returns right after it)
    return unlock.tier;
  }
  return null;
}
