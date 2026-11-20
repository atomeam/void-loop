// Full pages are Uni. Cards on the home page stay free. $20 a month only when Stripe has no UniVerse (or Uni) monthly price.
// That price is reused, never rewritten. MultiVerse stays the paid tier and is not changed. The gate stays off when the Stripe key is missing or rejected.
import { ownerOk } from './guard.js';
import { session, tierOf } from './void-me.js';
import { previewFor } from './gate-preview.js';
export const PRODUCT = 'UniVerse';
/** the gate's own offer slot in the revenue lane (offers/offers.json, tools/revenue-lane.mjs): its showing and its Subscribe click are counted by /api/buy under this source. */
export const GATE_SRC = 'gate.base.a'; // the beacon in screen() names it literally (tools/page-pass.test.mjs holds the two together)
export const LOOKUP = 'universe_monthly';
export const CENTS = 2000;
export const TABLE = 'CREATE TABLE IF NOT EXISTS void_uni (sub TEXT PRIMARY KEY, status TEXT NOT NULL, until_ms INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL)';
const PASS_MS = 30 * 864e5;
const OPEN = ['/api', '/.well-known', '/privacy', '/security', '/limits', '/members', '/store', '/credits', '/terms', '/refund', '/legal', '/emoji'];
const ASSET = /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|wasm|json|txt|xml|webmanifest|pdf|atom|rss|gz|br)$/i;
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function openPath(pathname) {
  const p = String(pathname || '');
  if (p === '/' || p === '/index.html' || p === '/void.html' || p === '/404.html') return true;
  if (ASSET.test(p) || /\/rss\/?$/.test(p)) return true;
  const bare = p.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  if (bare === '/versus') return true; // its own sign; /api/versus-floor and the json it reads stay open as an API and as files
  if (bare === '/blub') return true; // the blobfish is the messenger of A-to-Mind Verse: strangers who follow its link must see it, not the Uni screen
  if (bare === '/films') return true; // free to watch; the hourly Films guard reads this page, and Uni was hiding it
  return OPEN.some((pre) => bare === pre || bare.startsWith(pre + '/'));
}
export function gatedPath(pathname) {
  const p = String(pathname || '');
  if (openPath(p)) return false;
  return p.endsWith('/') || p.endsWith('.html') || /^\/@[^/]+\/?$/.test(p);
}
export function backPath(raw) {
  const s = String(raw || '');
  if (!s.startsWith('/') || s.startsWith('//') || /[\s\\]/.test(s)) return '/';
  try {
    const u = new URL(s, 'https://a-to-mind.com');
    return u.origin === 'https://a-to-mind.com' ? u.pathname + u.search : '/';
  } catch (_) { return '/'; }
}
export const money = (cents) => { const n = Number(cents); return Number.isFinite(n) && n > 0 ? '$' + (n % 100 ? (n / 100).toFixed(2) : String(n / 100)) + ' a month' : ''; };
export function parseRedirects(text) {
  const m = new Map();
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [from, to, st] = t.split(/\s+/);
    if (from && to && from.startsWith('/') && !/[*:]/.test(from)) m.set(from, { to, status: Number(st) || 302 });
  }
  return m;
}
export function redirectTo(table, pathname, search) {
  const hit = table && table.get(pathname);
  if (!hit) return null;
  const q = search && search !== '?';
  const to = q && !hit.to.includes('?') ? hit.to + search : q && hit.to.includes('?') ? hit.to + '&' + search.slice(1) : hit.to;
  return { to, status: hit.status };
}
const signKey = (env) => (env && (env.SALT || env.STRIPE_SECRET_KEY)) || '';
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
function same(a, b) { if (typeof a !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function mintPass(env, sub, now = Date.now()) {
  const exp = now + PASS_MS, body = 'uni1.' + exp.toString(36) + '.' + sub;
  return body + '.' + await hmac(signKey(env), body);
}
export async function readPass(env, token, now = Date.now()) {
  const m = /^uni1\.([0-9a-z]+)\.(sub_[A-Za-z0-9]+)\.([0-9a-f]{64})$/.exec(String(token || ''));
  if (!m || !signKey(env)) return null;
  const exp = parseInt(m[1], 36);
  if (!(exp > now) || exp > now + PASS_MS + 864e5) return null;
  const body = 'uni1.' + m[1] + '.' + m[2];
  return same(m[3], await hmac(signKey(env), body)) ? { sub: m[2], exp } : null;
}
const made = new WeakMap();
export function ensureUni(env) {
  if (!env || !env.DB) return Promise.reject(new Error('no db'));
  let p = made.get(env.DB);
  if (!p) { p = env.DB.prepare(TABLE).run().catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}
export async function grant(env, sub, status, until) {
  await ensureUni(env);
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO void_uni (sub, status, until_ms, updated) VALUES (?, ?, ?, ?) ON CONFLICT(sub) DO UPDATE SET status = excluded.status, until_ms = excluded.until_ms, updated = excluded.updated').bind(sub, status, until || 0, now).run();
}
async function stripe(env, path, opt, fetchImpl) {
  const r = await fetchImpl('https://api.stripe.com/v1' + path, {
    method: opt.method || 'GET',
    headers: { authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, ...(opt.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...(opt.idem ? { 'idempotency-key': opt.idem } : {}) },
    body: opt.body ? String(opt.body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
}
const monthly = (p) => !!(p && p.currency === 'usd' && p.recurring && p.recurring.interval === 'month');
export async function ensurePrice(env, fetchImpl = fetch) {
  const byKey = await stripe(env, '/prices?lookup_keys[]=' + LOOKUP + '&active=true&limit=1', {}, fetchImpl);
  const hit = byKey.ok && byKey.j.data && byKey.j.data[0];
  if (hit && hit.recurring && hit.recurring.interval === 'month') return { price: hit.id, cents: hit.unit_amount, created: false };
  const listed = await stripe(env, '/products?active=true&limit=100', {}, fetchImpl);
  const rows = (listed.ok && listed.j.data) || [];
  let product = rows.find((p) => p.name === PRODUCT) || rows.find((p) => p.name === 'Uni') || null;
  if (product) {
    const prices = await stripe(env, '/prices?product=' + encodeURIComponent(product.id) + '&active=true&limit=20', {}, fetchImpl);
    const have = ((prices.ok && prices.j.data) || []).find(monthly);
    if (have) return { price: have.id, cents: have.unit_amount, created: false };
  } else {
    const madeP = await stripe(env, '/products', { method: 'POST', idem: 'universe-product-v1', body: new URLSearchParams({ name: PRODUCT, 'metadata[plan]': 'universe' }) }, fetchImpl);
    if (!madeP.ok || !madeP.j.id) return { error: true, status: madeP.status };
    product = madeP.j;
  }
  const price = await stripe(env, '/prices', { method: 'POST', idem: 'universe-monthly-price-v1', body: new URLSearchParams({ product: product.id, unit_amount: String(CENTS), currency: 'usd', 'recurring[interval]': 'month', lookup_key: LOOKUP, 'metadata[plan]': 'universe' }) }, fetchImpl);
  if (price.ok && price.j.id) return { price: price.j.id, cents: CENTS, created: true };
  const again = await stripe(env, '/prices?lookup_keys[]=' + LOOKUP + '&active=true&limit=1', {}, fetchImpl);
  const h2 = again.ok && again.j.data && again.j.data[0];
  return h2 && h2.id ? { price: h2.id, cents: h2.unit_amount, created: false } : { error: true, status: price.status };
}
let cache = null;
export const resetLive = () => { cache = null; };
/** whether the gate may close. Off when the key is missing, rejected, or no price can be used. */
export async function liveState(env, fetchImpl = fetch) {
  const webhook = !!(env && env.STRIPE_WEBHOOK_SECRET);
  if (!env || !env.STRIPE_SECRET_KEY) return { on: false, missing: 'STRIPE_SECRET_KEY', webhook };
  const now = Date.now();
  if (cache && now < cache.until && cache.key === env.STRIPE_SECRET_KEY) return cache.value;
  let ping; try { ping = await stripe(env, '/prices?limit=1', {}, fetchImpl); } catch (_) { ping = { ok: false, status: 0 }; }
  if (!ping.ok) { const value = { on: false, missing: 'STRIPE_SECRET_KEY', webhook }; cache = { key: env.STRIPE_SECRET_KEY, value, until: now + 60000 }; return value; }
  let price; try { price = await ensurePrice(env, fetchImpl); } catch (_) { price = { error: true }; }
  const value = price && price.price ? { on: true, missing: '', webhook, price: price.price, cents: price.cents, created: !!price.created, product: PRODUCT } : { on: false, missing: 'Stripe price for UniVerse', webhook };
  cache = { key: env.STRIPE_SECRET_KEY, value, until: now + (value.on ? 600000 : 60000) };
  return value;
}
async function refreshSub(env, sub, fetchImpl) {
  const r = await stripe(env, '/subscriptions/' + sub, {}, fetchImpl);
  if (!r.ok) return false;
  const status = r.j.status || 'canceled', until = (r.j.current_period_end || 0) * 1000;
  await grant(env, sub, status, until);
  return (status === 'active' || status === 'trialing') && until > Date.now();
}
export async function passOk(token, env, fetchImpl = fetch) {
  const p = await readPass(env, token);
  if (!p || !env.DB) return false;
  try {
    await ensureUni(env);
    const row = await env.DB.prepare('SELECT status, until_ms FROM void_uni WHERE sub = ?').bind(p.sub).first();
    if (!row || (row.status !== 'active' && row.status !== 'trialing')) return false;
    if (Number(row.until_ms) > Date.now()) return true;
    return await refreshSub(env, p.sub, fetchImpl);
  } catch (_) { return false; }
}
export const bearer = (request) => { const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || ''); return m ? m[1].trim() : ''; };
/** the browser suite on this machine. Production never sets PASSKEY_RP_ID, and the host must be local. */
export function suiteOpen(request, env) {
  const host = new URL(request.url).hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return true;
  if (host.endsWith('.pages.dev')) return true;
  if (env && env.VERSE_LOCAL_PREVIEW === '1') return true;
  if (env && env.PASSKEY_RP_ID === 'localhost' && host === 'localhost' && request.headers.get('x-verse-suite') === '1') return true;
  return false;
}
/** owner, Multi (paid tier), or a live Uni pass. '' for everyone else. */
export async function passage(request, env, fetchImpl = fetch) {
  if (suiteOpen(request, env)) return 'suite';
  const token = bearer(request);
  if (!token) return '';
  if (await ownerOk(request, env)) return 'owner';
  if (token.startsWith('uni1.') && await passOk(token, env, fetchImpl)) return 'uni';
  try { const s = await session(request, env); if (s && (await tierOf(env, s.userId)) === 'paid') return 'multi'; } catch (_) {}
  return '';
}
export function screen(live, back) {
  const price = money(live && live.cents) || '$20 a month';
  const ret = esc(backPath(back));
  const pv = previewFor(String(back || '').split('?')[0]);
  const lead = pv.name ? esc(pv.name) + ' is a full page, and full pages are part of UniVerse.' : 'Full pages are part of UniVerse.';
  const shot = pv.img ? `<figure class="pv"><img src="/gate/${esc(pv.img)}.webp" width="760" height="475" alt="A look at the ${esc(pv.name)} page"><figcaption>${esc(pv.line)}</figcaption></figure>` : `<p class="pvl">${esc(pv.line)}</p>`;
  const free = pv.ask ? `<p class="free">Want a taste first? <a href="/?q=${encodeURIComponent(pv.ask)}">Open the free ${esc(pv.name)} card</a>. Cards are always free.</p>` : '<p class="free">Cards on the home page are always free.</p>';
  const star = 'var c=document.getElementById("s");if(c&&c.getContext&&!matchMedia("(prefers-reduced-motion: reduce)").matches){var x=c.getContext("2d"),w,h,S=[],d=Math.min(devicePixelRatio||1,2),i;function z(){w=c.width=innerWidth*d;h=c.height=innerHeight*d;S=[];for(i=0;i<Math.round(innerWidth*innerHeight/5000);i++)S.push([Math.random()*w,Math.random()*h,(Math.random()*1.3+.3)*d,Math.random()*6.3,Math.random()*.6+.2])}z();addEventListener("resize",z);(function f(t){x.clearRect(0,0,w,h);for(i=0;i<S.length;i++){var q=S[i];x.globalAlpha=q[4]*(.55+.45*Math.sin(t/1400+q[3]));x.fillStyle="#d7d2ff";x.fillRect(q[0],q[1],q[2],q[2])}requestAnimationFrame(f)})(0)}';
  return `<!DOCTYPE html><html lang="en" class="vs-tool"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UniVerse · Verse</title><meta name="robots" content="noindex"><meta name="verse-gate" content="uni"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/verse.css"><style>:root{color-scheme:dark;--bg:#050508;--ink:#ededed;--muted:#a9a9b8;--accent:#9aa7ff}body{margin:0;background:radial-gradient(ellipse at 50% 0,#141726 0,#050508 60%) fixed;color:var(--ink);font:16px/1.6 system-ui,sans-serif}#s{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}main{position:relative;z-index:1;max-width:720px;margin:0 auto;padding:24px 16px 64px}a{color:var(--accent)}.brand a{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:600;letter-spacing:.04em}.brand span{color:var(--muted);font-weight:400;font-size:13px}h1{font-size:clamp(34px,8vw,52px);line-height:1.1;margin:22px 0 8px}.sub{color:var(--muted);margin:0 0 18px}.pv{margin:0 0 18px}.pv img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid #2a2d45;box-shadow:0 12px 40px #0008}.pv figcaption,.pvl{color:var(--ink);margin:10px 2px 0}button{font:inherit;font-weight:600;background:var(--accent);color:#0a0a14;border:0;border-radius:999px;padding:12px 22px;cursor:pointer}.free{color:var(--muted);margin:16px 0 0}nav{margin-top:26px}nav a{margin-right:18px}</style></head><body><canvas id="s" aria-hidden="true"></canvas><main><header class="brand"><a href="/"><img src="/icon.svg" width="28" height="28" alt=""> Verse <span>by A-to-Mind</span></a></header><h1>UniVerse</h1><p class="sub">${lead} ${esc(price)}.</p>${shot}<form method="post" action="/api/buy?go=gate&amp;from=${GATE_SRC}"><input type="hidden" name="back" value="${ret}"><button type="submit">Subscribe to UniVerse · ${esc(price)}</button></form>${free}<nav><a href="/">Free cards</a><a href="/members/">MultiVerse</a><a href="/credits/">Credits</a></nav></main><script>(function(){${star}})()</script><script>try{var k="a2m.gate.seen";if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");fetch("/api/buy?seen=gate.base.a&id=universe",{method:"POST",keepalive:true}).catch(function(){})}}catch(e){}</script><script>(function(){var t="";try{t=localStorage.getItem("a2m.void.owner.v1")||"";if(!t){var m=JSON.parse(localStorage.getItem("a2m.void.me.v1")||"null");t=(m&&m.token)||""}if(!t)t=localStorage.getItem("a2m.void.uni.v1")||""}catch(e){t=""}if(!t)return;fetch(location.href,{headers:{authorization:"Bearer "+t},credentials:"same-origin"}).then(function(r){return r.ok?r.text():""}).then(function(html){if(!html||html.indexOf('name="verse-gate"')!==-1)return;document.open();document.write(html);document.close()}).catch(function(){})})();</script></body></html>`; // void-review: ok (every URL in this page is a fixed literal)
}
export function savedHtml(token, back) {
  return '<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Verse</title><p>Opening your pages.</p><script>try{localStorage.setItem("a2m.void.uni.v1",' + JSON.stringify(token) + ')}catch(e){}location.replace(' + JSON.stringify(backPath(back)) + ')</script>';
}
export const gateHeaders = () => ({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-verse-gate': 'uni', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' https://cloudflareinsights.com; form-action 'self' https://checkout.stripe.com; base-uri 'self'" });
export function sessionIdOk(id) { return /^cs_[A-Za-z0-9_]{8,}$/.test(String(id || '')); }
export async function startCheckout(env, origin, back, fetchImpl = fetch) {
  const live = await liveState(env, fetchImpl);
  if (!live.on) return { error: live.missing || 'off' };
  const f = new URLSearchParams({ mode: 'subscription', success_url: origin + '/api/page-pass?session_id=CHECKOUT_SESSION_ID', cancel_url: origin + backPath(back), 'line_items[0][price]': live.price, 'line_items[0][quantity]': '1', 'metadata[plan]': 'universe', 'metadata[back]': backPath(back), 'subscription_data[metadata][plan]': 'universe' });
  // Stripe replaces this template only when the braces are not escaped.
  const body = f.toString().replace('session_id%3DCHECKOUT_SESSION_ID', 'session_id={CHECKOUT_SESSION_ID}');
  const r = await stripe(env, '/checkout/sessions', { method: 'POST', body }, fetchImpl);
  return r.ok && r.j.url ? { url: r.j.url } : { error: 'checkout' };
}
export async function finishCheckout(env, id, fetchImpl = fetch) {
  if (!sessionIdOk(id)) return null;
  const r = await stripe(env, '/checkout/sessions/' + id + '?expand[]=subscription', {}, fetchImpl);
  const o = r.ok ? r.j : null;
  if (!o || !o.metadata || o.metadata.plan !== 'universe' || (o.status !== 'complete' && o.payment_status !== 'paid')) return null;
  const subObj = o.subscription && typeof o.subscription === 'object' ? o.subscription : null;
  const sub = subObj ? subObj.id : (typeof o.subscription === 'string' ? o.subscription : '');
  const status = (subObj && subObj.status) || 'active';
  if (!/^sub_[A-Za-z0-9]+$/.test(sub) || (status !== 'active' && status !== 'trialing')) return null;
  await grant(env, sub, status, ((subObj && subObj.current_period_end) || 0) * 1000 || Date.now() + PASS_MS);
  return { sub, back: backPath(o.metadata.back) };
}
/** webhook bookkeeping. Ignores every event that is not this plan. */
export async function applyStripeEvent(env, event) {
  const o = (event && event.data && event.data.object) || {}, t = event && event.type;
  if (t === 'checkout.session.completed') {
    if (!o.metadata || o.metadata.plan !== 'universe') return false;
    const sub = typeof o.subscription === 'string' ? o.subscription : (o.subscription && o.subscription.id);
    if (!/^sub_[A-Za-z0-9]+$/.test(sub || '')) return false;
    await grant(env, sub, 'active', Date.now() + PASS_MS);
    return true;
  }
  if (t !== 'customer.subscription.updated' && t !== 'customer.subscription.deleted') return false;
  if (o.metadata && o.metadata.plan && o.metadata.plan !== 'universe') return false;
  if (!o.metadata || o.metadata.plan !== 'universe') {
    const row = env.DB ? await env.DB.prepare('SELECT sub FROM void_uni WHERE sub = ?').bind(o.id).first() : null;
    if (!row) return false;
  }
  await grant(env, o.id, t === 'customer.subscription.deleted' ? 'canceled' : (o.status || 'canceled'), (o.current_period_end || 0) * 1000);
  return true;
}
