// Verse's code review API (lib/review-api.js). The page /code-review/ and the GitHub Action (review/action.yml) call it.
// POST { code | diff, lang?, ask? }  -> { findings, lang, lines, ms, tier, answer?, review: 'rules' | 'model', quoted?: { kept, dropped }, left?, upgrade? }
//   Who gets the closer read (the model's review on top of the instant checks), from the Authorization header:
//     the owner (READ_TOKEN or an owner session)      always, free, no daily cap: Verse's reviewer is ours first
//     a Verse Pro key  vr1.…                           paid Verse ($49 a month) includes it; minted below by a signed-in paid account
//     a license key   XXXXXXXX-XXXXXXXX-…             Verse Code Review Pro bought on its own (lib/products.js), checked with Gumroad
//     nothing                                         the instant checks only, free, no account
// POST { action: 'key' }   (Bearer session)   -> { key } once (only its hash is kept) | 401 not signed in | 402 not paid | 409 too many
// GET                      (Bearer session)   -> { tier, keys: [{ prefix, at, used, total }] }
// GET  ?offer                                 -> what is on sale: { included: { url }, standalone: { url } | null }
// DELETE { prefix }        (Bearer session)   -> { ok } (that key stops working)
import { ensureTables, bad, good, session, tierOf } from '../../lib/void-me.js';
import { ownerOk } from '../../lib/guard.js';
import { KEY_RE, MAX_KEYS, PRO_DAILY, BUY_URL, keyHash, newKey, today, quick, closerReadDetail, cleanImports } from '../../lib/review-api.js';
import { forSale, buyUrl } from '../../lib/products.js';
import { access, PRODUCT } from '../../lib/paid-access.js'; // who gets the closer read (shared with the support desk, functions/api/support.js)

const ready = ensureTables; // void_review_keys is one of the account tables (lib/void-me.js)
const modelsOn = (env) => !!(env && env.AI) && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off';

export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'bad json'); }
  if (b && b.action === 'key') {
    try {
      await ready(env);
      const me = await session(request, env);
      if (!me) return bad(401, 'sign in to Verse first (a passkey, at a-to-mind.com)');
      if ((await tierOf(env, me.userId)) !== 'paid') return bad(402, 'review keys come with MultiVerse', { buy: BUY_URL });
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
  if (a.tier === 'free') return good({ ...out, ...(a.note ? { note: a.note } : {}), upgrade: 'Verse Code Review Pro adds a closer read by an AI reviewer: ' + BUY_URL });
  if (a.left <= 0) return good({ ...out, note: 'today\'s closer reads are used; the instant checks still run' });
  if (!modelsOn(env)) return good({ ...out, note: 'the model is off right now; the instant checks are above' });
  try {
    const d = await closerReadDetail(env, { ask: b.ask, code: q.code, lang: q.lang, diff: !!b.diff, res: q.res, imports: cleanImports(b.imports) }); // imports: each touched file's import lines (tools/review-pr.mjs), so a diff review never calls one missing
    if (!d.answer) return good({ ...out, note: 'model busy' });
    await a.spend();
    // quoted: how many findings quoted a line of the code and stayed, how many were dropped (no quote, a quote found nowhere, an echo of the shape), whether the model's JSON parsed, and how many echoes it wrote (lib/review-api.js)
    return good({ ...out, answer: d.answer, review: 'model', quoted: { kept: d.kept, dropped: d.dropped, parsed: d.parsed !== false, echoes: d.echoes || 0, refuted: d.refuted || 0 }, ...(Number.isFinite(a.left) ? { left: a.left - 1 } : {}) });
  } catch (_) { return good({ ...out, note: 'model busy' }); }
}

export async function onRequestGet({ request, env }) {
  if (new URL(request.url).searchParams.has('offer')) {
    return Response.json({ product: PRODUCT.name, adds: PRODUCT.adds, included: { in: 'MultiVerse', url: 'https://moonbeam846.gumroad.com/l/yinmj' }, standalone: forSale(PRODUCT) ? { url: buyUrl(PRODUCT) } : null }, { headers: { 'cache-control': 'public, max-age=300' } });
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
