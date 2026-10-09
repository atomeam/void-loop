// Void's code review API (lib/review-api.js). The page /code-review/ and the GitHub Action (review/action.yml) call it.
// POST { code | diff, lang?, ask? }  -> { findings, lang, lines, ms, tier, answer?, review: 'rules' | 'model', left?, upgrade? }
//   Who gets the closer read (the model's review on top of the instant checks), from the Authorization header:
//     the owner (READ_TOKEN or an owner session)      always, free, no daily cap: Void's reviewer is ours first
//     a Void Pro key  vr1.…                           paid Void ($49 a month) includes it; minted below by a signed-in paid account
//     a license key   XXXXXXXX-XXXXXXXX-…             Void Code Review Pro bought on its own (lib/products.js), checked with Gumroad
//     nothing                                         the instant checks only, free, no account
// POST { action: 'key' }   (Bearer session)   -> { key } once (only its hash is kept) | 401 not signed in | 402 not paid | 409 too many
// GET                      (Bearer session)   -> { tier, keys: [{ prefix, at, used, total }] }
// GET  ?offer                                 -> what is on sale: { included: { url }, standalone: { url } | null }
// DELETE { prefix }        (Bearer session)   -> { ok } (that key stops working)
import { ensureTables, bad, good, session, tierOf } from '../../lib/void-me.js';
import { ownerOk } from '../../lib/guard.js';
import { KEY_RE, MAX_KEYS, PRO_DAILY, BUY_URL, keyHash, newKey, today, quick, closerRead } from '../../lib/review-api.js';
import { productById, resolveProductId, forSale, buyUrl, LICENSE_RE, LICENSE_TTL_MS, LICENSE_TABLE, askGumroad } from '../../lib/products.js';

const PRODUCT = productById('code-review');
const ready = ensureTables; // void_review_keys is one of the account tables (lib/void-me.js)
const licReady = new WeakMap();
const licenses = (env) => { let p = licReady.get(env.DB); if (!p) { p = env.DB.prepare(LICENSE_TABLE).run().catch((e) => { licReady.delete(env.DB); throw e; }); licReady.set(env.DB, p); } return p; };
const modelsOn = (env) => !!(env && env.AI) && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off';
const bearer = (request) => { const m = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || ''); return m ? m[1] : ''; };

// -> { tier: 'owner' | 'pro' | 'free', left, spend(), note?, refuse? }
async function access(request, env, now = Date.now()) {
  const t = bearer(request), free = (note) => ({ tier: 'free', note });
  if (!t) return free();
  if (KEY_RE.test(t)) { // a Void Pro key: its account must be paid right now
    await ready(env);
    const hash = await keyHash(t), row = await env.DB.prepare('SELECT user_id, day, uses FROM void_review_keys WHERE hash = ?').bind(hash).first();
    if (!row) return { refuse: 'unknown review key' };
    if ((await tierOf(env, row.user_id)) !== 'paid') return free('this key belongs to a free account');
    return { tier: 'pro', left: PRO_DAILY - (row.day === today(now) ? Number(row.uses) || 0 : 0),
      spend: () => env.DB.prepare('UPDATE void_review_keys SET uses = CASE WHEN day = ? THEN uses + 1 ELSE 1 END, day = ?, total = total + 1, used = ? WHERE hash = ?').bind(today(now), today(now), new Date(now).toISOString(), hash).run() };
  }
  if (LICENSE_RE.test(t)) { // Void Code Review Pro bought on its own: Gumroad says whether the license is good, remembered for a few hours
    if (!forSale(PRODUCT)) return free('Void Code Review Pro is not on sale on its own yet');
    await licenses(env);
    const hash = await keyHash('license:' + t.toUpperCase());
    let row = await env.DB.prepare('SELECT ok, why, checked, day, uses FROM void_licenses WHERE hash = ?').bind(hash).first();
    if (!row || now - Number(row.checked) > LICENSE_TTL_MS) {
      const g = await askGumroad(await resolveProductId(PRODUCT, env), t.toUpperCase(), env.fetchGumroad || fetch, PRODUCT.gumroad.slug); // env.fetchGumroad: tests only (tools/review-api.test.mjs)
      if (g.ok !== null) {
        await env.DB.prepare('INSERT INTO void_licenses (hash, product, ok, why, checked) VALUES (?, ?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET ok = excluded.ok, why = excluded.why, checked = excluded.checked').bind(hash, PRODUCT.id, g.ok ? 1 : 0, g.why, now).run();
        row = { ...(row || {}), ok: g.ok ? 1 : 0, why: g.why, checked: now };
      } else if (!row) return free('could not check the license with Gumroad just now; the instant checks are above');
    }
    if (!Number(row.ok)) return row.why === 'not a license for this product' ? { refuse: 'unknown license key' } : free('license: ' + row.why);
    return { tier: 'pro', left: PRODUCT.daily - (row.day === today(now) ? Number(row.uses) || 0 : 0), spend: () => env.DB.prepare('UPDATE void_licenses SET uses = CASE WHEN day = ? THEN uses + 1 ELSE 1 END, day = ?, total = total + 1 WHERE hash = ?').bind(today(now), today(now), hash).run() };
  }
  if (await ownerOk(request, env)) return { tier: 'owner', left: Infinity, spend: async () => {} };
  return free();
}

export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'bad json'); }
  if (b && b.action === 'key') {
    try {
      await ready(env);
      const me = await session(request, env);
      if (!me) return bad(401, 'sign in to Void first (a passkey, at a-to-mind.com)');
      if ((await tierOf(env, me.userId)) !== 'paid') return bad(402, 'review keys come with Void Pro', { buy: BUY_URL });
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_review_keys WHERE user_id = ?').bind(me.userId).first();
      if (n && Number(n.n) >= MAX_KEYS) return bad(409, 'you have ' + MAX_KEYS + ' keys already: revoke one first');
      const key = newKey();
      await env.DB.prepare('INSERT INTO void_review_keys (hash, user_id, prefix, at) VALUES (?, ?, ?, ?)').bind(await keyHash(key), me.userId, key.slice(0, 10), new Date().toISOString()).run();
      return good({ ok: true, key, note: 'shown once: keep it as the secret VOID_REVIEW_KEY' });
    } catch (_) { return bad(503, 'keys unavailable right now'); }
  }
  if (!b || typeof (b.code || b.diff) !== 'string' || String(b.code || b.diff).trim().length < 8) return bad(400, 'send { code } or { diff }');
  const q = quick(b);
  const out = { ok: true, findings: q.findings, lang: q.lang, lines: q.lines, ms: q.ms, tier: 'free', review: 'rules' };
  let a; try { a = await access(request, env); } catch (_) { a = { tier: 'free', note: 'Pro unavailable right now: the instant checks are above' }; }
  if (a.refuse) return bad(401, a.refuse);
  out.tier = a.tier;
  if (a.tier === 'free') return good({ ...out, ...(a.note ? { note: a.note } : {}), upgrade: 'Void Code Review Pro adds a closer read by an AI reviewer: ' + BUY_URL });
  if (a.left <= 0) return good({ ...out, note: 'today\'s closer reads are used; the instant checks still run' });
  if (!modelsOn(env)) return good({ ...out, note: 'the model is off right now; the instant checks are above' });
  try {
    const answer = await closerRead(env, { ask: b.ask, code: q.code, lang: q.lang, diff: !!b.diff, res: q.res });
    if (!answer) return good({ ...out, note: 'model busy' });
    await a.spend();
    return good({ ...out, answer, review: 'model', ...(Number.isFinite(a.left) ? { left: a.left - 1 } : {}) });
  } catch (_) { return good({ ...out, note: 'model busy' }); }
}

export async function onRequestGet({ request, env }) {
  if (new URL(request.url).searchParams.has('offer')) {
    return Response.json({ product: PRODUCT.name, adds: PRODUCT.adds, included: { in: 'Void Pro', url: 'https://moonbeam846.gumroad.com/l/yinmj' }, standalone: forSale(PRODUCT) ? { url: buyUrl(PRODUCT) } : null }, { headers: { 'cache-control': 'public, max-age=300' } });
  }
  try {
    await ready(env);
    const me = await session(request, env);
    if (!me) return bad(401, 'not signed in');
    const rows = await env.DB.prepare('SELECT prefix, at, used, total FROM void_review_keys WHERE user_id = ? ORDER BY at').bind(me.userId).all();
    return good({ tier: await tierOf(env, me.userId), keys: (rows && rows.results) || [], buy: BUY_URL });
  } catch (_) { return bad(503, 'keys unavailable right now'); }
}

export async function onRequestDelete({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'bad json'); }
  const prefix = String((b && b.prefix) || '');
  if (!/^vr1\.[A-Za-z0-9_-]{6}$/.test(prefix)) return bad(400, 'which key? send its prefix');
  try {
    await ready(env);
    const me = await session(request, env);
    if (!me) return bad(401, 'not signed in');
    await env.DB.prepare('DELETE FROM void_review_keys WHERE user_id = ? AND prefix = ?').bind(me.userId, prefix).run();
    return good({ ok: true });
  } catch (_) { return bad(503, 'keys unavailable right now'); }
}
