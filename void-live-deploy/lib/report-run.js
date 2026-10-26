// The /api/answer 'report' mode (owner, 2026-10-26: "Verse can be the reporter"): { mode: 'report', kind: 'wrap' } or { mode: 'report', kind: 'why', s: 'AAPL' }.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHAT IT COSTS. The caller sends no data, only a kind and a symbol that must resolve (lib/markets.js) to a ticker of
// letters or a name from a closed list: the numbers come from Verse's own price route and its edge cache, so nobody can make Verse publish a figure. A report is
// made at most once per window (the wrap once a UTC day, a symbol's line once per six hours) and kept for everyone in D1 (void_kv) and the edge cache; a repeat
// costs nothing. A miss costs one to three price lookups (the caller's own six a minute, bucket 'report') and, when the free model is on and the hour's allowance
// is not spent, one model call of at most 260 tokens: HOUR_MAX (10) an hour and DAY_MAX (60) a day for the whole site, one count in D1 for every edge location (lib/daily-cap.js, fail closed), so the ceiling is 60 model calls a day, and 0
// when VOID_ANSWER_MODELS=off. Past the allowance, or when the polish fails its validation (lib/report.js validatePolish), the plain draft is the report.
// No model call is ever made for a symbol with no price. Nothing a visitor typed reaches the model: it only sees the draft built from the data.
import { resolve } from './markets.js';
import { wrapDraft, whyDraft, windowOf, labelFor, validatePolish, polishMessages, SECTORS } from './report.js';

// v2 in the key (2026-10-26): reports made from the year-long Yahoo move are not read again
export const HOUR_MAX = 10, DAY_MAX = 60, VISITOR_MAX = 6, KEEP_DAYS = 3, DRAFT_TTL = 1200, MAX_TOKENS = 260;
const WRAP_LIST = 'SPX,DJI,NDX,BTC,ETH,EUR/USD,AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,JPM,V,WMT,NFLX,AMD';
const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });

/** D1-backed global store (void_kv): get, put and the sweep of old reports. The counters are lib/daily-cap.js. Tests pass their own. */
export function d1Store(db) {
  return {
    get: async (k) => { const v = await db.prepare('SELECT v FROM void_kv WHERE k = ?').bind(k).first('v'); return v == null ? null : v; },
    put: async (k, v) => { await db.prepare('INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run(); },
    sweep: async (before) => { await db.prepare("DELETE FROM void_kv WHERE (k LIKE 'report:%' AND substr(k, 8, 10) < ?))").bind(before).run(); },
  };
}
/**
 * deps: { markets: { quoteBody, batch, fetchFn }, rateLimited, model: async (messages, maxTokens) => text | null (null when models are off), cap: async (pairs) => { ok }, store, cache, now }
 * Returns a Response: { ok, kind, sym, text, draft, polished, label, at, window, cached } or { ok: false, kind, say }.
 */
export async function reportAnswer(request, env, body, deps) {
  const now = deps.now || Date.now(), kind = body && body.kind === 'why' ? 'why' : body && body.kind === 'wrap' ? 'wrap' : '';
  if (!kind) return json({ ok: false, kind: 'bad', say: 'Ask for the wrap or a symbol.' }, 400);
  const r = kind === 'why' ? resolve(body.s) : null; if (kind === 'why' && !r) return json({ ok: false, kind: 'bad', say: 'Type a ticker, a company, an index, a coin or a currency pair.' }, 400);
  const win = windowOf(kind, now), day = win.slice(0, 10), key = 'report:' + day + ':v2:' + (kind === 'wrap' ? 'wrap' : 'why:' + r.sym + ':' + win.slice(11)), origin = new URL(request.url).origin;
  const ck = deps.cache ? new Request(origin + '/__void-report/' + encodeURIComponent(key)) : null;
  if (ck) { try { const hit = await deps.cache.match(ck); if (hit) return json({ ...(await hit.json()), cached: true }); } catch (_) {} }
  try { const raw = deps.store && await deps.store.get(key); if (raw) { const v = JSON.parse(raw); if (v && (v.polished || now - Date.parse(v.at) < DRAFT_TTL * 1000)) { if (ck) await deps.cache.put(ck, new Response(raw, { headers: { 'cache-control': 'max-age=' + (v.polished ? 3600 : 300) } })).catch(() => {}); return json({ ...v, cached: true }); } } } catch (_) {}
  if (await deps.rateLimited(request, env, 'report', VISITOR_MAX)) return json({ ok: false, kind: 'limited', say: 'A few reports a minute: give it a moment.' }, 429);

  const { quoteBody, batch, fetchFn } = deps.markets; let draft = null, quotes = [];
  if (kind === 'wrap') { quotes = (await batch(request, env, WRAP_LIST.split(',').slice(0, 12).join(','), fetchFn)).concat(await batch(request, env, WRAP_LIST.split(',').slice(12).join(','), fetchFn)).filter((q) => q && q.ok); draft = wrapDraft(quotes, now); }
  else {
    const q = await quoteBody(request, env, r, '1y', '', fetchFn); if (q && q.ok) {
      const peersOf = SECTORS[r.sym] ? Object.keys(SECTORS).filter((s) => SECTORS[s] === SECTORS[r.sym] && s !== r.sym).slice(0, 5) : [];
      const ctxQ = (await batch(request, env, ['SPX'].concat(peersOf).join(','), fetchFn)).filter((x) => x && x.ok); quotes = [q, ...ctxQ];
      draft = whyDraft(q, { index: ctxQ.find((x) => x.sym === 'SPX'), peers: ctxQ.filter((x) => x.sym !== 'SPX') });
    }
  }
  if (!draft) return json({ ok: false, kind: 'away', say: kind === 'wrap' ? 'The price sources did not answer, so there is nothing to report yet.' : 'No price for ' + r.sym + ' just now, so there is nothing to report.' });

  let text = draft, polished = false, why = null;
  if (deps.model && deps.store) {
    // ONE global count in D1 (lib/daily-cap.js), the hour first so a full hour never uses a place of the day; no D1 or an error refuses (fail closed: the draft)
    let allowed = false; try { allowed = !!(deps.cap && (await deps.cap([['finance-report:h' + new Date(now).toISOString().slice(0, 13), HOUR_MAX], ['finance-report', DAY_MAX]])).ok); } catch (_) {}
    if (allowed) { try { const out = await deps.model(polishMessages(draft), MAX_TOKENS); const v = validatePolish(out, draft); if (v.ok) { text = String(out).trim(); polished = true; } else why = v.why; } catch (_) { why = 'model busy'; } } else why = 'hour allowance spent';
  }
  const spx = quotes.find((q) => q.sym === 'SPX'), mood = kind === 'wrap' && spx && spx.pct != null ? (spx.pct >= 0.4 ? 'hopeful' : spx.pct <= -0.4 ? 'tense' : 'calm') : undefined; // a closed mood for the day's picture (lib/daily-art.js MOODS)
  const value = { ok: true, kind, sym: r ? r.sym : null, mood, text, draft, polished, label: labelFor(quotes, now), at: new Date(now).toISOString(), window: win };
  const raw = JSON.stringify(value);
  try { if (deps.store) { await deps.store.put(key, raw); if (deps.store.sweep) await deps.store.sweep(new Date(now - KEEP_DAYS * 864e5).toISOString().slice(0, 10)); } } catch (_) {}
  if (ck) { try { await deps.cache.put(ck, new Response(raw, { headers: { 'cache-control': 'max-age=' + (polished ? 3600 : 300) } })); } catch (_) {} }
  return json({ ...value, held: why || undefined });
}
