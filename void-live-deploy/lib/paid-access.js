// Who may use what Verse sells (moved here from functions/api/review.js so the review API and the support desk,
// functions/api/support.js, answer the same question the same way): the owner, a paid Verse account's Pro key, or a
// Code Review Pro license key bought on its own. Anything else is the free tier.
import { ensureTables, tierOf } from './void-me.js';
import { ownerOk } from './guard.js';
import { KEY_RE, PRO_DAILY, keyHash, today } from './review-api.js';
import { productById, resolveProductId, forSale, LICENSE_RE, LICENSE_TTL_MS, LICENSE_TABLE, askGumroad } from './products.js';

export const PRODUCT = productById('code-review');
const ready = ensureTables; // void_review_keys is one of the account tables (lib/void-me.js)
const licReady = new WeakMap();
const licenses = (env) => { let p = licReady.get(env.DB); if (!p) { p = env.DB.prepare(LICENSE_TABLE).run().catch((e) => { licReady.delete(env.DB); throw e; }); licReady.set(env.DB, p); } return p; };
const bearer = (request) => { const m = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || ''); return m ? m[1] : ''; };

// -> { tier: 'owner' | 'pro' | 'free', left, spend(), note?, refuse?, who? } (who: a hash naming the key or license, never the key)
export async function access(request, env, now = Date.now()) {
  const t = bearer(request), free = (note) => ({ tier: 'free', note });
  if (!t) return free();
  if (KEY_RE.test(t)) { // a Verse Pro key: its account must be paid right now
    await ready(env);
    const hash = await keyHash(t), row = await env.DB.prepare('SELECT user_id, day, uses FROM void_review_keys WHERE hash = ?').bind(hash).first();
    if (!row) return { refuse: 'unknown review key' };
    if ((await tierOf(env, row.user_id)) !== 'paid') return free('this key belongs to a free account');
    return { tier: 'pro', who: 'acct:' + row.user_id, left: PRO_DAILY - (row.day === today(now) ? Number(row.uses) || 0 : 0),
      spend: () => env.DB.prepare('UPDATE void_review_keys SET uses = CASE WHEN day = ? THEN uses + 1 ELSE 1 END, day = ?, total = total + 1, used = ? WHERE hash = ?').bind(today(now), today(now), new Date(now).toISOString(), hash).run() };
  }
  if (LICENSE_RE.test(t)) { // Verse Code Review Pro bought on its own: Gumroad says whether the license is good, remembered for a few hours
    if (!forSale(PRODUCT)) return free('Verse Code Review Pro is not on sale on its own yet');
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
    return { tier: 'pro', who: 'lic:' + hash, left: PRODUCT.daily - (row.day === today(now) ? Number(row.uses) || 0 : 0), spend: () => env.DB.prepare('UPDATE void_licenses SET uses = CASE WHEN day = ? THEN uses + 1 ELSE 1 END, day = ?, total = total + 1 WHERE hash = ?').bind(today(now), today(now), hash).run() };
  }
  if (await ownerOk(request, env)) return { tier: 'owner', who: 'owner', left: Infinity, spend: async () => {} };
  // a bearer that is no key, no license and not the owner: the reason goes to the function log only (wrangler pages deployment tail),
  // never into the answer, because the PR comment that carries the answer is public. The token itself is never logged.
  console.log('[review] closer read access: a bearer was sent that is no review key, no license and not the owner (' + (env && env.READ_TOKEN ? 'the owner token on this deployment differs from it' : 'READ_TOKEN is not set on this deployment') + ')');
  return free();
}

