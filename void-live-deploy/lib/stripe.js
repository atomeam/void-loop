// Stripe membership for the members gate: the $10/month plan (functions/api/stripe/*), the void_memberships row the gate
// re-reads, and the webhook signature check. The Stripe secret key and webhook secret are Pages secrets; nothing here logs them
// or puts them in a response. Pure parts (checkoutParams, verifyStripeSignature, activeMembership) are tested without network.
export const STRIPE_API = 'https://api.stripe.com/v1';
export const ACTIVE = new Set(['active', 'trialing']);
export const MEMBERSHIP_TABLE = "CREATE TABLE IF NOT EXISTS void_memberships (id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '', until INTEGER NOT NULL DEFAULT 0, customer TEXT NOT NULL DEFAULT '', subscription TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL, updated INTEGER NOT NULL)";

const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
const same = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** the membership is active now: a live subscription (or a trial) whose paid-through date has not passed. */
export function activeMembership(m, now = Date.now()) {
  return !!m && ACTIVE.has(String(m.status)) && (!m.until || Number(m.until) > now);
}

/** Stripe's Signature header -> { t, v1: [...] }. Pure. */
export function signatureOf(header) {
  const out = { t: '', v1: [] };
  for (const part of String(header || '').split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') out.t = v;
    if (k === 'v1' && v) out.v1.push(v);
  }
  return out;
}

/** Stripe's signature: v1 = HMAC-SHA256(secret, "<t>.<raw body>"), within five minutes. */
export async function verifyStripeSignature(payload, header, secret, now = Date.now()) {
  const s = signatureOf(header);
  if (!secret || !s.t || !s.v1.length || !Number.isFinite(Number(s.t))) return false;
  if (Math.abs(now / 1000 - Number(s.t)) > 300) return false;
  const want = await hmac(secret, s.t + '.' + String(payload));
  return s.v1.some((v) => same(v, want));
}

/** the Checkout Session parameters for the $10/month plan. Pure. */
export function checkoutParams(env, { email = '', name = '', next = '', origin = 'https://a-to-mind.com' } = {}) {
  const price = String(env.STRIPE_PRICE_ID || '');
  if (!price) throw new Error('no price');
  const okNext = /^\/[^/]/.test(next) && !next.startsWith('//') ? next : '/';
  const success = origin + '/join/?paid=1&session_id={CHECKOUT_SESSION_ID}' + (okNext !== '/' ? '&next=' + encodeURIComponent(okNext) : '');
  return {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: success,
    cancel_url: origin + '/join/?canceled=1',
    allow_promotion_codes: 'true',
    'metadata[source]': 'verse-members',
    ...(email ? { customer_email: email } : {}),
    ...(name ? { 'metadata[name]': name } : {}),
  };
}

/** a Stripe API call with the secret key; the error never carries the key. */
export async function stripe(env, path, { method = 'GET', body } = {}) {
  const key = String(env.STRIPE_SECRET_KEY || '');
  if (!key) throw new Error('stripe not configured');
  const r = await fetch(STRIPE_API + path, {
    method,
    headers: { authorization: 'Bearer ' + key, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    ...(body ? { body: new URLSearchParams(body).toString().replace(/%7BCHECKOUT_SESSION_ID%7D/gi, '{CHECKOUT_SESSION_ID}') } : {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('stripe ' + r.status); e.status = r.status; e.code = j && j.error && j.error.code; throw e; }
  return j;
}

export async function ensureMemberships(env) { await env.DB.prepare(MEMBERSHIP_TABLE).run(); }

/** the membership fields of a Stripe subscription (until: the paid-through date in ms, 0 when Stripe gives none). */
export function fromSubscription(sub, extra = {}) {
  const md = (sub && sub.metadata) || {};
  const itemEnd = sub && sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end;
  return {
    status: String(sub && sub.status || ''),
    until: (sub && (sub.current_period_end || itemEnd)) ? Number(sub.current_period_end || itemEnd) * 1000 : 0,
    customer: String(sub && sub.customer || ''),
    subscription: String(sub && sub.id || ''),
    email: String(extra.email || md.email || ''),
    name: String(extra.name || md.name || ''),
  };
}

/** insert or update the row for a subscription; returns { id, ...fields }. */
export async function saveMembership(env, m, now = Date.now()) {
  await ensureMemberships(env);
  const had = m.subscription ? await env.DB.prepare('SELECT id FROM void_memberships WHERE subscription = ?').bind(m.subscription).first() : null;
  const id = had ? had.id : 'stripe-' + hex(crypto.getRandomValues(new Uint8Array(8)));
  if (had) {
    await env.DB.prepare('UPDATE void_memberships SET email = ?, name = ?, status = ?, until = ?, customer = ?, updated = ? WHERE id = ?')
      .bind(String(m.email || ''), String(m.name || ''), String(m.status || ''), Number(m.until) || 0, String(m.customer || ''), now, id).run();
  } else {
    await env.DB.prepare('INSERT INTO void_memberships (id, email, name, status, until, customer, subscription, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, String(m.email || ''), String(m.name || ''), String(m.status || ''), Number(m.until) || 0, String(m.customer || ''), String(m.subscription || ''), now, now).run();
  }
  return { id, ...m };
}

export async function membershipById(env, id) {
  try { return await env.DB.prepare('SELECT * FROM void_memberships WHERE id = ?').bind(id).first(); } catch (_) { return null; }
}

export async function setMembershipStatus(env, subscription, status, now = Date.now()) {
  if (!subscription) return null;
  await ensureMemberships(env);
  await env.DB.prepare('UPDATE void_memberships SET status = ?, updated = ? WHERE subscription = ?').bind(status, now, String(subscription)).run();
  return true;
}
