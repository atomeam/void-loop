// Prices for Verse's markets: the crypto card's coin list (?ids=, since 2026-10) and the /markets/ page's quotes (?s=SYMBOL&r=RANGE, ?strip=1, ?movers=1).
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED (docs/RULES.md: every open GET is written down). This is an open, read-only GET. The most a caller can do is:
//   - make Verse's server ask one of FOUR fixed hosts (stooq.com, query1.finance.yahoo.com, api.coingecko.com, api.frankfurter.dev) for a price: the host and the
//     path are written here; the caller picks only a symbol, and a symbol must resolve (lib/markets.js resolve) to a ticker of at most five letters, an index or
//     currency pair or coin from a closed list; a range from a closed list of eight; and a day (YYYY-MM-DD) checked as a real date; the coin table also reads
//     Verse's own /data/coins.json (a fixed path on this site) when CoinGecko does not answer;
//   - spend those sources' free allowances: a repeat inside two minutes (an hour for currencies) is answered from the edge cache, a miss costs one to three (the coin table up to four)
//     upstream calls and counts against the caller's own 40 misses a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read prices. No model, no key, no token, no KV, no database, no write; a failed answer is never cached. Nothing here trades, holds money or gives advice.
// SOURCES AND THEIR RISK: Stooq's CSV (free, no key, the first choice for shares and indices) can start asking for a key or change; Yahoo's chart endpoint is
// unofficial and has no published terms for this use, so it is only the fallback and the source of the one-day chart; CoinGecko's public API (no key, about 30 calls a
// minute, one year of history; when it refuses, a coin's quote comes from Yahoo's chart instead); frankfurter.dev (ECB reference rates, once a day). Data may be delayed up to 15 minutes or more; every answer says its source.
// answer.js is loaded when first needed, not at import: the report code (lib/report-run.js) reaches this file from answer.js, and a static import back would be a cycle
const rateLimited = async (...a) => (await import('./answer.js')).rateLimited(...a);
import { recordClose, RECORD_NAME } from '../../lib/markets-record.js';
import { capsRows, scanRows, COINS, resolve, RANGES, parseStooqDaily, parseYahoo, summarize, closeOn, rowsFromPrices, rowsFromFx } from '../../lib/markets.js';

export const ID_RE = /^[a-z0-9-]{2,40}$/;
const DEFAULT_IDS = 'bitcoin,ethereum,solana,ripple,dogecoin,cardano,litecoin,binancecoin';
/** the ids to ask for: a clean comma list of at most 12, or the default. Pure. */
export function cleanIds(raw) {
  const ids = String(raw || '').toLowerCase().split(',').map((s) => s.trim()).filter((s) => ID_RE.test(s)).slice(0, 12);
  return ids.length ? [...new Set(ids)].join(',') : DEFAULT_IDS;
}
/** CoinGecko's row cut to what the card needs, sparkline thinned to at most 56 points. Pure. */
export function slim(row) {
  const sp = (row && row.sparkline_in_7d && row.sparkline_in_7d.price) || [];
  const step = Math.max(1, Math.ceil(sp.length / 56));
  return { id: row.id, symbol: String(row.symbol || '').toUpperCase(), name: row.name, image: row.image, price: row.current_price,
    change24h: row.price_change_percentage_24h, cap: row.market_cap, rank: row.market_cap_rank,
    spark: sp.filter((_, i) => i % step === 0).map((v) => +Number(v).toPrecision(6)), updated: row.last_updated };
}
export const RL_MAX = 90, RL_BATCH = 240, UA = 'Verse (a-to-mind.com)';
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString().slice(0, 10), compact = (ms) => iso(ms).replace(/-/g, '');
const DAYS = { '1d': 1, '5d': 5, '1m': 31, '6m': 183, '1y': 366, '5y': 5 * 366 };
const YAHOO = { '1d': ['1d', '5m'], '5d': ['5d', '15m'], '1m': ['1mo', '1d'], '6m': ['6mo', '1d'], ytd: ['ytd', '1d'], '1y': ['1y', '1d'], '5y': ['5y', '1wk'], max: ['max', '1mo'] };
export const MOVERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'WMT', 'NFLX', 'AMD'];
export const STRIP = ['SPX', 'DJI', 'NDX', 'BTC', 'ETH', 'EUR/USD'];
const get = async (f, url, text) => { const r = await f(url, { headers: { accept: text ? 'text/csv,*/*' : 'application/json', 'user-agent': UA }, signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined }); if (!r.ok) throw new Error('status ' + r.status); return text ? r.text() : r.json(); };

/** how far back the daily rows must reach for a range (a year at least: the 52 weeks come from them). Pure. */
export function wantFrom(range, now) { return range === 'max' ? 0 : range === 'ytd' ? Math.min(Date.UTC(new Date(now).getUTCFullYear(), 0, 1), now - 400 * DAY) : now - Math.max(DAYS[range] + 10, 400) * DAY; }

async function stooqRows(r, from, to, f) { const u = 'https://stooq.com/q/d/l/?s=' + encodeURIComponent(r.stooq) + '&i=d' + (from ? '&d1=' + compact(from) : '') + '&d2=' + compact(to); return parseStooqDaily(await get(f, u, true)); }
async function yahoo(r, range, f) { const [rg, iv] = YAHOO[range]; return parseYahoo(await get(f, 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(r.yahoo) + '?range=' + rg + '&interval=' + iv)); }
const withChart = (s, rows) => { const c = rows && rows.length > 1 ? summarize(rows, 'max', {}, false) : null; if (c) { s.points = c.points; s.rangeChange = c.rangeChange; s.rangePct = c.rangePct; } return s; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function stooqQuote(r, range, f, now) { const rows = await stooqRows(r, wantFrom(range, now), now, f); if (rows.length < 2) throw new Error('no rows'); return { ...summarize(rows, range), source: 'Stooq', rows }; }
async function yahooQuote(r, range, f) { // Yahoo's unofficial endpoint: daily rows for the change and the 52 weeks, a second call for a chart it alone has (one day) or a longer one
  const base = await yahoo(r, '1y', f); if (!base || base.rows.length < 2) throw new Error('no rows');
  const s = summarize(base.rows, range === '1d' || range === '5y' || range === 'max' ? '1y' : range, base.meta);
  if (range === '1d' || range === '5y' || range === 'max') { const more = await yahoo(r, range, f).catch(() => null); if (more) withChart(s, more.rows); if (!more || more.rows.length < 2) s.note = 'The ' + range + ' chart is not available now; showing one year.'; }
  return { ...s, name: base.meta.name || undefined, currency: base.meta.currency || undefined, source: 'Yahoo Finance (unofficial)', rows: base.rows };
}
// Stooq first; Yahoo joins after 1.8 s (or at once when Stooq fails), and the first answer wins: a slow or refusing source costs a couple of seconds, not both timeouts one after the other
async function stockQuote(r, range, f, now) {
  let yp; const y = () => (yp = yp || yahooQuote(r, range, f));
  try { return await (range === '1d' ? y() : Promise.any([stooqQuote(r, range, f, now).catch(() => y()), sleep(1800).then(y)])); } catch (_) {}
  if (range === '1d') { try { const rows = await stooqRows(r, now - 20 * DAY, now, f); if (rows.length >= 2) return { ...summarize(rows, '5d'), note: 'Intraday prices are not available now; showing the last five days.', source: 'Stooq', rows }; } catch (_) {} }
  return null;
}
async function coinQuote(r, range, f, now) {
  const base = 'https://api.coingecko.com/api/v3/', id = encodeURIComponent(r.coin), vs = 'vs_currency=usd';
  const jobs = [get(f, base + 'coins/markets?' + vs + '&ids=' + id), get(f, base + 'coins/' + id + '/market_chart?' + vs + '&days=365&interval=daily')];
  if (range === '1d' || range === '5d') jobs.push(get(f, base + 'coins/' + id + '/market_chart?' + vs + '&days=' + (range === '1d' ? 1 : 5)));
  const [mk, yr, fine] = await Promise.all(jobs); const m = Array.isArray(mk) && mk[0]; if (!m) return null;
  const rows = rowsFromPrices(yr); if (rows.length < 2) return null;
  const s = summarize(rows, range === '1d' || range === '5d' ? '1y' : range, { price: m.current_price, prev: m.price_change_24h != null ? m.current_price - m.price_change_24h : null, dayHigh: m.high_24h, dayLow: m.low_24h, volume: m.total_volume });
  if (fine) withChart(s, rowsFromPrices(fine));
  if (range === '5y' || range === 'max') { const more = await yahoo(r, range, f).then((j) => j && j.rows).catch(() => null); if (more && more.length > 1) withChart(s, more); else s.note = 'Free crypto history reaches back one year; showing one year.'; }
  return { ...s, cap: m.market_cap, name: m.name, rank: m.market_cap_rank, source: 'CoinGecko', rows };
}
async function fxQuote(r, range, f, now) {
  const eff = range === '1d' ? '5d' : range, from = wantFrom(eff, now);
  const j = await get(f, 'https://api.frankfurter.dev/v1/' + iso(Math.max(from, Date.UTC(1999, 0, 4))) + '..' + iso(now) + '?base=' + r.from + '&symbols=' + r.to);
  const rows = rowsFromFx(j, r.to); if (rows.length < 2) return null;
  return { ...summarize(rows, eff), note: range === '1d' ? 'Currency rates are published once a day; showing the last five days.' : undefined, source: 'ECB reference rates via frankfurter.dev', rows };
}
/** the close on or before a day, from the source that has it: { date, close } or null */
async function dayClose(r, rows, on, f) {
  const rec = recordClose(r.sym, on); if (rec) return rec; // the bundled record: no network, no limiter
  const cache = typeof caches !== 'undefined' ? caches.default : null, ck = new Request('https://a-to-mind.com/__markets/day/' + encodeURIComponent(r.sym) + '/' + on);
  if (cache) { try { const hit = await cache.match(ck); if (hit) return await hit.json(); } catch (_) {} }
  const live = await dayCloseLive(r, rows, on, f);
  if (cache && live) { try { await cache.put(ck, new Response(JSON.stringify(live), { headers: { 'cache-control': 'max-age=86400' } })); } catch (_) {} } // a past day's close never changes
  return live;
}
async function dayCloseLive(r, rows, on, f) {
  try {
    if (r.kind === 'fx') { const j = await get(f, 'https://api.frankfurter.dev/v1/' + on + '?base=' + r.from + '&symbols=' + r.to); return j && j.rates && Number.isFinite(j.rates[r.to]) ? { date: j.date || on, close: j.rates[r.to] } : null; }
    const t = Date.parse(on + 'T00:00:00Z');
    if (r.kind === 'stock' || r.kind === 'index') { const hit = closeOn(await stooqRows(r, t - 10 * DAY, t + DAY, f), on); if (hit) return hit; const y = parseYahoo(await get(f, 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(r.yahoo) + '?period1=' + Math.floor((t - 10 * DAY) / 1000) + '&period2=' + Math.floor((t + 2 * DAY) / 1000) + '&interval=1d')); return y ? closeOn(y.rows, on) : null; }
    return closeOn(rows || [], on);
  } catch (_) { return null; }
}
/** the answer when only the bundled record has the day: the close, no price (the sources did not answer, or the caller was asked to wait). */
export const recordAnswer = (r, range, on, rec, now) => ({ ok: true, partial: true, sym: r.sym, kind: r.kind, name: r.name || r.sym, currency: r.currency, range, price: null, change: null, pct: null, points: [], closeOn: rec, on, source: RECORD_NAME, delayed: true, at: new Date(now).toISOString(), note: 'The live price sources did not answer; this is the close from Verse\'s year-end record.' });
/** one quote, shaped for the page: { ok, sym, kind, name, currency, range, price, change, pct, ..., points, source, delayed, at }. fetchFn and now are for tests. */
export async function lookQuote(r, range, on, fetchFn = fetch, now = Date.now()) {
  let q = null;
  // a coin: CoinGecko first; when it does not answer (its free API often refuses shared Cloudflare addresses), Yahoo's BTC-USD style chart, said to be from Yahoo
  try { q = r.kind === 'crypto' ? (await coinQuote(r, range, fetchFn, now).catch(() => null)) || { ...(await yahooQuote(r, range, fetchFn)), name: r.name } : r.kind === 'fx' ? await fxQuote(r, range, fetchFn, now) : await stockQuote(r, range, fetchFn, now); } catch (_) { q = null; }
  if (!q) {
    // the sources did not answer: a day inside the bundled record still has its close (lib/markets-record.js), said to be from it
    const rec = on ? recordClose(r.sym, on) : null;
    if (rec) return recordAnswer(r, range, on, rec, now);
    return { ok: false, kind: 'none', sym: r.sym, say: 'No price for ' + r.sym + ' from the free sources just now. Check the symbol, or try again in a minute.' };
  }
  const { rows, ...rest } = q, out = { ok: true, sym: r.sym, kind: r.kind, name: rest.name || r.name || r.sym, currency: rest.currency || r.currency, range: r.kind === 'fx' && range === '1d' ? '5d' : range, ...rest, delayed: true, at: new Date(now).toISOString() };
  if (r.kind === 'fx') { out.volume = null; }
  if (on) out.closeOn = await dayClose(r, rows, on, fetchFn);
  if (on) out.on = on;
  return out;
}
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(Date.parse(s + 'T00:00:00Z')) === s && Date.parse(s + 'T00:00:00Z') <= Date.now() && Date.parse(s + 'T00:00:00Z') >= Date.UTC(1970, 0, 1);
const json = (o, status = 200, cc = 'no-store') => Response.json(o, { status, headers: { 'cache-control': cc } });
const slimQ = (q) => (q && q.ok ? { ok: true, sym: q.sym, name: q.name, price: q.price, change: q.change, pct: q.pct, currency: q.currency, kind: q.kind, asOf: q.asOf, source: q.source } : null);
/** a body from the edge cache, or made (one to three upstream calls, counted against the caller's own bucket) and kept. A good answer is also kept for a day as the
 *  stale copy, served (and said to be old) when the sources fail or the caller is asked to wait; a failure is remembered for 45 seconds so a burst of loads does not wait
 *  on the sources one after the other. `fallback()` is an answer that costs nothing (the bundled record), tried before telling anyone to wait. */
async function cachedBody(request, env, key, ttl, make, bucket = 'markets', max = RL_MAX, fallback = null) {
  const cache = typeof caches !== 'undefined' ? caches.default : null, origin = new URL(request.url).origin, at = (k) => new Request(origin + '/__markets/' + k), ck = at(key);
  const read = async (k) => { if (!cache) return null; try { const hit = await cache.match(at(k)); return hit ? await hit.json() : null; } catch (_) { return null; } };
  const keep = async (k, v, age) => { if (cache) { try { await cache.put(at(k), new Response(JSON.stringify(v), { headers: { 'cache-control': 'max-age=' + age } })); } catch (_) {} } };
  const fresh = await read(key); if (fresh) return fresh;
  const stale = async () => { const v = await read('stale/' + key); return v && v.ok ? { ...v, stale: true, note: 'The live sources did not answer; this is the last answer saved, from ' + String(v.at || '').slice(0, 16).replace('T', ' ') + ' UTC.' } : null; };
  const neg = await read('neg/' + key); if (neg) return (await stale()) || fallback && fallback() || neg;
  if (await rateLimited(request, env || {}, bucket, max)) return (await stale()) || (fallback && fallback()) || { ok: false, kind: 'limited', say: 'That is a lot of price lookups in a minute. Give it a moment.' };
  const body = await make();
  if (body && body.ok && body.partial) return (await stale()) || (await keep(key, body, 120), body); // only the record: the last full answer is better when there is one
  if (body && body.ok) { await keep(key, body, ttl); await keep('stale/' + key, body, 86400); return body; }
  const old = await stale(); if (old) return old;
  if (body && (body.kind === 'none' || body.kind === 'away')) await keep('neg/' + key, body, 45);
  return body;
}
export const quoteBody = (request, env, r, range, on, f, many = false) => cachedBody(request, env, 'q/' + encodeURIComponent(r.sym) + '/' + range + '/' + on, r.kind === 'fx' ? 3600 : 120, () => lookQuote(r, range, on || null, f), many ? 'markets-batch' : 'markets', many ? RL_BATCH : RL_MAX, () => { const rec = on ? recordClose(r.sym, on) : null; return rec ? recordAnswer(r, range, on, rec, Date.now()) : null; });
const reply = (body, ttl) => json(body, body.ok ? 200 : body.kind === 'none' ? 404 : body.kind === 'limited' ? 429 : 503, body.ok ? 'public, max-age=' + ttl : 'no-store'); // 503, not 502: Cloudflare swaps a Function's 502 for its own page
/** at most 12 symbols in one call, each from the same cache as a single quote */
export async function batch(request, env, list, f) {
  const rs = []; for (const s of String(list || '').split(',').slice(0, 12)) { const r = resolve(s); if (r && !rs.some((x) => x.sym === r.sym)) rs.push(r); }
  return Promise.all(rs.map((r) => quoteBody(request, env, r, '5d', '', f, true).then((q) => slimQ(q) || { ok: false, sym: r.sym, kind: q && q.kind })));
}

// the coin table (CoinGecko's top 50 by market cap, one call) and the screener's universe (16 shares and indices from the same quote cache, 30 coins in one call)
const geckoMarkets = (f, qs) => get(f, 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&sparkline=true&price_change_percentage=24h,7d&' + qs);
export const SCAN_STOCKS = [...MOVERS, 'SPX', 'DJI', 'NDX', 'IXIC'];
/** Yahoo's spark answer (several symbols in one call) as { 'BTC-USD': { price, prev, closes[] } }. Both shapes it is known to send are read. prev is the day before the
 *  last daily close: Yahoo's chartPreviousClose is the close before the whole range (live 2026-10-30: the 24h move then read the same as the 7d move). Pure. */
export function parseSpark(j) {
  const out = {}, put = (sym, meta, close, prevClose) => { const c = (close || []).filter((v) => Number.isFinite(v)); const price = Number.isFinite(meta && meta.regularMarketPrice) ? meta.regularMarketPrice : c[c.length - 1]; if (sym && Number.isFinite(price) && price > 0) out[sym] = { price, prev: c.length > 1 ? c[c.length - 2] : Number.isFinite(prevClose) ? prevClose : null, closes: c }; };
  if (j && j.spark && Array.isArray(j.spark.result)) for (const r of j.spark.result) { const x = r && r.response && r.response[0]; if (x) put(r.symbol, x.meta, x.indicators && x.indicators.quote && x.indicators.quote[0] && x.indicators.quote[0].close, x.meta && x.meta.chartPreviousClose); }
  else if (j && typeof j === 'object') for (const [sym, x] of Object.entries(j)) if (x && Array.isArray(x.close)) put(sym, null, x.close, x.chartPreviousClose);
  return out;
}
/** the snapshot's coins with the live prices laid over them: a price is taken only within 40% of the snapshot's (a Yahoo ticker can name another coin); market cap scales
 *  with the price (the supply barely moves in a day), the distance below the all-time high is measured from the new price, the volume stays the snapshot's. { coins, live } with live the count that got a price. Pure. */
export function overlay(caps, prices) {
  let live = 0;
  const coins = (caps || []).map((c) => { const p = prices[c.sym + '-USD']; if (!p || !(c.price > 0) || Math.abs(p.price / c.price - 1) > 0.4) return c; live++;
    const k = p.closes.slice(-8), first = k[0];
    const ath = c.athPct != null && c.athPct > -100 ? c.price / (1 + c.athPct / 100) : null;
    return { ...c, price: p.price, pct24: p.prev ? (p.price / p.prev - 1) * 100 : c.pct24, pct7: first ? (p.price / first - 1) * 100 : c.pct7, cap: c.cap != null ? c.cap * p.price / c.price : null, athPct: ath ? Math.min(0, (p.price / ath - 1) * 100) : c.athPct, spark: k.length > 2 ? k : c.spark, live: true }; });
  return { coins, live };
}
// the top 50: CoinGecko live; when it does not answer (its free API often refuses shared Cloudflare addresses), the daily snapshot (data/coins.json, made by a GitHub
// workflow from CoinGecko) with Yahoo's prices over it, three calls of at most 20 coins; and when Yahoo does not answer either, the snapshot itself, said to be one
async function capsBody(f, now, snapFn) {
  try { const rows = capsRows(await geckoMarkets(f, 'order=market_cap_desc&per_page=50&page=1')); if (rows.length >= 10) return { ok: true, coins: rows, total: rows.reduce((a, r) => a + (r.cap || 0), 0), source: 'CoinGecko', delayed: true, at: new Date(now).toISOString() }; } catch (_) {}
  return capsFallback(f, now, snapFn);
}
async function capsFallback(f, now, snapFn) {
  const snap = snapFn ? await snapFn().catch(() => null) : null, caps = snap && snap.ok && Array.isArray(snap.caps) ? snap.caps : [];
  if (caps.length < 10) return { ok: false, kind: 'away', say: 'The coin list did not answer just now.' };
  const syms = caps.map((c) => c.sym + '-USD'), parts = []; for (let i = 0; i < syms.length; i += 20) parts.push(syms.slice(i, i + 20));
  const prices = Object.assign({}, ...(await Promise.all(parts.map((p) => get(f, 'https://query1.finance.yahoo.com/v8/finance/spark?symbols=' + p.map(encodeURIComponent).join(',') + '&range=7d&interval=1d').then(parseSpark, () => ({}))))));
  const { coins, live } = overlay(caps, prices), total = coins.reduce((a, r) => a + (r.cap || 0), 0);
  if (live >= 10) return { ok: true, coins, total, live, snapshot: snap.day, source: 'Prices: Yahoo Finance (unofficial), ' + live + ' of ' + coins.length + ' coins; the list, volume and the rest: the CoinGecko snapshot of ' + snap.day + '; market cap scaled to the price', delayed: true, at: new Date(now).toISOString() };
  return { ok: true, coins: caps, total: caps.reduce((a, r) => a + (r.cap || 0), 0), live: 0, snapshot: snap.day, partial: true, source: 'The CoinGecko snapshot of ' + snap.day + ' (the live prices did not answer)', delayed: true, at: snap.at || new Date(now).toISOString() };
}
const ownSnapshot = (request, env) => async () => { if (!env || !env.ASSETS) return null; const r = await env.ASSETS.fetch(new Request(new URL('/data/coins.json', request.url))); return r.ok ? r.json() : null; }; // the site's own file, never another host
// the screener's coins: CoinGecko; when it does not answer, the same snapshot and Yahoo prices as the coin table, kept to the coins the screener lists, and the
// source names what answered (live 2026-10-30: CoinGecko refused, the screener had 0 coins and still named CoinGecko)
async function scanBody(request, env, f, now, snapFn) {
  const quotes = await Promise.all(SCAN_STOCKS.map((s) => quoteBody(request, env, resolve(s), '1y', '', f, true).catch(() => null)));
  const ids = Object.values(COINS).map((c) => c[0]);
  let coins = [], coinSource = 'CoinGecko', coinFeed = null; try { coins = capsRows(await geckoMarkets(f, 'ids=' + ids.join(',') + '&per_page=50')); } catch (_) {}
  if (!coins.length) { const fb = await capsFallback(f, now, snapFn).catch(() => null); coins = fb && fb.ok ? fb.coins.filter((c) => ids.includes(c.id)) : [];
    const live = coins.filter((c) => c.live).length; coinFeed = coins.length ? { live, snapshot: fb.snapshot } : null;
    coinSource = !coins.length ? '' : live ? 'Yahoo Finance (unofficial) for ' + live + ' coin prices over the CoinGecko snapshot of ' + fb.snapshot : 'the CoinGecko snapshot of ' + fb.snapshot + ' for coins (not live)'; }
  const rows = scanRows(quotes, coins);
  return rows.length >= 8 ? { ok: true, rows, universe: { stocks: MOVERS.length, indices: 4, coins: coins.length }, ...(coinFeed ? { coinFeed } : {}), source: 'Stooq, Yahoo Finance (fallback)' + (coinSource ? ', ' + coinSource : ''), delayed: true, at: new Date(now).toISOString() } : { ok: false, kind: 'away', say: 'The price sources did not answer just now.' };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), p = u.searchParams, stamp = () => new Date().toISOString();
  if (p.has('caps')) return reply(await cachedBody(request, env, 'caps', 300, () => capsBody(fetchFn, Date.now(), ownSnapshot(request, env)), 'markets-batch', RL_BATCH), 300);
  if (p.has('scan')) return reply(await cachedBody(request, env, 'scan', 300, () => scanBody(request, env, fetchFn, Date.now(), ownSnapshot(request, env)), 'markets-batch', RL_BATCH), 300);
  if (p.has('strip')) { const quotes = (await batch(request, env, STRIP.join(','), fetchFn)).filter((q) => q.ok); return reply(quotes.length ? { ok: true, quotes, source: 'Stooq, CoinGecko, ECB', delayed: true, at: stamp() } : { ok: false, kind: 'away', say: 'The price sources did not answer.' }, 120); }
  if (p.has('movers')) {
    const q = (await batch(request, env, MOVERS.join(','), fetchFn)).filter((x) => x.ok && x.pct != null).sort((a, b) => b.pct - a.pct);
    return reply(q.length >= 4 ? { ok: true, up: q.slice(0, 3), down: q.slice(-3).reverse(), of: q.length, source: 'Stooq', delayed: true, at: stamp() } : { ok: false, kind: 'away', say: 'The price sources did not answer.' }, 300);
  }
  if (p.has('w')) { const quotes = await batch(request, env, p.get('w'), fetchFn); return quotes.length ? json({ ok: true, quotes, delayed: true, at: stamp() }, 200, 'public, max-age=60') : json({ ok: false, kind: 'bad', say: 'Send up to 12 symbols, comma between.' }, 400); }
  if (p.has('s')) {
    const r = resolve(p.get('s')), range = (p.get('r') || '1y').toLowerCase(), on = p.get('on') || '';
    if (!r) return json({ ok: false, kind: 'bad', say: 'Type a ticker (AAPL), a company (apple), an index (S&P 500), a coin (BTC) or a currency pair (EURUSD).' }, 400);
    if (!RANGES.includes(range)) return json({ ok: false, kind: 'bad', say: 'The range is one of ' + RANGES.join(', ') + '.' }, 400);
    if (on && !validDay(on)) return json({ ok: false, kind: 'bad', say: 'The day is written YYYY-MM-DD, and not in the future.' }, 400);
    return reply(await quoteBody(request, env, r, range, on, fetchFn), r.kind === 'fx' ? 3600 : 120);
  }
  return coinList({ request });
}
async function coinList({ request }) {
  const url = new URL(request.url), ids = cleanIds(url.searchParams.get('ids'));
  const vs = /^(usd|eur|gbp|jpy)$/.test(url.searchParams.get('vs') || '') ? url.searchParams.get('vs') : 'usd';
  const key = new Request(url.origin + '/__markets/' + vs + '/' + ids);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  let body, status = 200;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=' + vs + '&ids=' + ids + '&sparkline=true&price_change_percentage=24h', { headers: { accept: 'application/json', 'user-agent': 'Verse (a-to-mind.com)' } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const rows = await r.json();
    body = { ok: true, vs, source: 'CoinGecko', at: new Date().toISOString(), coins: (Array.isArray(rows) ? rows : []).map(slim) };
  } catch (e) { body = { ok: false, vs, error: 'The price service did not answer.', why: String(e && e.message || e).slice(0, 60) }; status = 503; }
  // 503, not 502: Cloudflare swaps a Function's 502 for its own error page, and the card needs this JSON to fall back
  const res = new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + (status === 200 ? 120 : 15) } });
  if (cache && status === 200) await cache.put(key, res.clone());
  return res;
}
