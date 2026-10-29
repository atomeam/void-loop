// "Verse reports" on /markets/: the drafts, the validator that decides whether a polish may replace a draft, and the route (lib/report-run.js) on a fixture day with
// fake prices and a fake model: once per window, an hourly allowance, the draft when the polish is refused. No live source and no real model is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapDraft, whyDraft, validatePolish, windowOf, labelFor, sourcesOf, NO_CAUSE } from '../void-live-deploy/lib/report.js';
import { reportAnswer, HOUR_MAX, DAY_MAX } from '../void-live-deploy/lib/report-run.js';
import { resolve } from '../void-live-deploy/lib/markets.js';

const AT = Date.UTC(2026, 9, 23, 21);
// the fixture day: indices, twelve stocks, bitcoin, ether and the euro
const day = [['SPX', 'S&P 500', 'index', 5100.2, 0.42], ['DJI', 'Dow Jones Industrial Average', 'index', 40012.5, -0.05], ['NDX', 'Nasdaq 100', 'index', 18200, 0.9], ['BTC', 'Bitcoin', 'crypto', 70000, 2.04], ['ETH', 'Ethereum', 'crypto', 3500, -1.1], ['EUR/USD', 'EUR to USD', 'fx', 1.0834, 0.03],
  ['AAPL', 'Apple', 'stock', 188.5, 4.72], ['MSFT', 'Microsoft', 'stock', 410, 1.2], ['NVDA', 'NVIDIA', 'stock', 120, -0.5], ['AMZN', 'Amazon', 'stock', 180, 0.3], ['GOOGL', 'Alphabet (Google)', 'stock', 170, 0.8], ['META', 'Meta Platforms', 'stock', 500, -2.4],
  ['TSLA', 'Tesla', 'stock', 250, -3.9], ['JPM', 'JPMorgan Chase', 'stock', 200, 0.1], ['V', 'Visa', 'stock', 280, -0.2], ['WMT', 'Walmart', 'stock', 70, 1.9], ['NFLX', 'Netflix', 'stock', 700, 0.6], ['AMD', 'AMD', 'stock', 150, 2.2]]
  .map(([sym, name, kind, price, pct]) => ({ ok: true, sym, name, kind, price, pct, change: price * pct / 100, currency: kind === 'index' ? 'pts' : 'USD', source: kind === 'crypto' ? 'CoinGecko' : kind === 'fx' ? 'ECB reference rates via frankfurter.dev' : 'Stooq', asOf: AT }));
const full = { ...day.find((q) => q.sym === 'AAPL'), prev: 180, sd: 1.5, avgVol: 1e6, volume: 1.8e6, hi52: 230, lo52: 90 };

test('the wrap: indices, the three biggest gains and falls among the twelve, then crypto and the euro, every number from the data', () => {
  const t = wrapDraft(day, AT);
  assert.match(t, /^Markets wrap for 23 Oct 2026\./); assert.match(t, /The S&P 500 rose 0\.42% to 5,100\.20/); assert.match(t, /Dow Jones Industrial Average was little changed at 40,012\.50 \(−0\.05%\)/);
  assert.match(t, /biggest gains were AAPL \(\+4\.72%\), AMD \(\+2\.20%\), WMT \(\+1\.90%\)/); assert.match(t, /biggest falls were TSLA \(−3\.90%\), META \(−2\.40%\), NVDA \(−0\.50%\)/);
  assert.match(t, /Bitcoin rose 2\.04% to 70,000\.00/); assert.match(t, /EUR to USD was little changed at 1\.0834 \(\+0\.03%\)/); assert.doesNotMatch(t, /because|buy|sell|expect|forecast/i);
  assert.equal(wrapDraft([], AT), null); assert.equal(wrapDraft(day.slice(0, 1), AT), null, 'one index alone is not a wrap');
});
test('why is X moving: size, volume, the 52 weeks, the index and the peers, and always that no cause was found', () => {
  const t = whyDraft(full, { index: day[0], peers: day.filter((q) => ['MSFT', 'NVDA'].includes(q.sym)) });
  assert.match(t, /^Apple \(AAPL\) rose 4\.72% to 188\.50 USD in the latest session, 23 Oct 2026\./); assert.match(t, /3\.1 times its usual daily move of 1\.50%/); assert.match(t, /Volume was 1\.8 times its 30-day average/);
  assert.match(t, /18\.0% below its 52-week high of 230\.00/); assert.match(t, /The S&P 500 rose 0\.42% in the same period/); assert.match(t, /Related technology stocks: MSFT \(\+1\.20%\), NVDA \(−0\.50%\)/); assert.ok(t.endsWith(NO_CAUSE));
  assert.equal(whyDraft({ sym: 'X' }, {}), null); assert.ok(whyDraft({ ...full, sd: null, avgVol: null, hi52: null, lo52: null }, {}).endsWith(NO_CAUSE), 'with less data, still honest');
});
const draft = whyDraft(full, { index: day[0], peers: [day[7]] });
test('the validator keeps a faithful polish and refuses every invention', () => {
  const ok = 'Apple (AAPL) rose 4.72% to 188.50 USD in the latest session, 23 Oct 2026, which is 3.1 times its usual daily move of 1.50% over the last 60 sessions. Volume was 1.8 times its 30-day average, and the stock is 18.0% below its 52-week high of 230.00 and above its low of 90.00. The S&P 500 rose 0.42% in the same period, and related technology stocks included MSFT (+1.20%). No cause found in the data: Verse has no headlines or filings, so this says what moved, not why.';
  assert.deepEqual(validatePolish(ok, draft), { ok: true });
  const bad = (t, re) => { const v = validatePolish(t, draft); assert.equal(v.ok, false, t.slice(0, 60)); assert.match(v.why, re); };
  bad(ok.replace('4.72%', '4.8%'), /number|left out/); bad(ok + ' It also gained 9% last week.', /number/); bad(ok.replace('MSFT', 'ORCL'), /symbol/); bad(ok.replace('Volume was', 'Meta Platforms volume was'), /name/);
  bad(ok.replace('Apple (AAPL) rose', 'Apple (AAPL) rose because of strong iPhone sales and'), /cause/); bad(ok + ' Analysts say it should keep climbing.', /advice/); bad(ok + ' It looks like a good time to buy.', /advice/); bad(ok + ' Our price target is far higher.', /advice/);
  bad(ok.replace(/ No cause found in the data[^]*$/, ' The reason is unclear.'), /no-cause/); bad('Short.', /length/); bad('', /empty/); bad('- ' + ok, /formatting/); bad(ok.replace('18.0%', '18.0% (bullish)'), /advice/);
  assert.equal(validatePolish('Markets wrap for the day. The S&P 500 rose to 5,100.20 today.', 'Markets wrap for 23 Oct 2026. The S&P 500 rose 0.42% to 5,100.20.').ok, false, 'a polish may not drop a move it was given');
});
test('windows and labels', () => {
  assert.equal(windowOf('wrap', AT), '2026-10-23'); assert.equal(windowOf('why', AT), '2026-10-23-18'); assert.equal(windowOf('why', Date.UTC(2026, 9, 23, 5)), '2026-10-23-00');
  assert.deepEqual(sourcesOf(day), ['Stooq', 'CoinGecko', 'ECB']);
  const l = labelFor(day, AT); assert.match(l, /^Written by Verse from .*Stooq.*data, delayed, not financial advice\. 2026-10-23 21:00 UTC\.$/);
});

// ---- the route on the fixture day, with a fake model and an in-memory store
const mem = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, sweep: async () => {} }; };
const deps = (over = {}) => {
  const calls = { quote: 0, batch: 0, model: 0 };
  const store = mem(), counts = new Map(); const cap = async (pairs) => { for (const [k, lim] of pairs) { if ((counts.get(k) || 0) >= lim) return { ok: false }; } for (const [k] of pairs) counts.set(k, (counts.get(k) || 0) + 1); return { ok: true }; };
  return { calls, counts, cap, now: AT, store, cache: null, rateLimited: async () => false,
    markets: { fetchFn: null, quoteBody: async () => { calls.quote++; return full; }, batch: async (_r, _e, list) => { calls.batch++; return list.split(',').map((s) => resolve(s).sym).map((s) => day.find((q) => q.sym === s)).filter(Boolean); } },
    model: async (messages) => { calls.model++; return messages[1].content.replace(/^Note:\n/, ''); }, ...over };
};
const post = (body, d) => reportAnswer(new Request('https://a-to-mind.com/api/answer', { method: 'POST' }), {}, body, d).then(async (r) => ({ status: r.status, j: await r.json() }));
test('the route: one report per window for everyone, the same words the second time, no model call for a repeat', async () => {
  const d = deps(); const a = await post({ mode: 'market-report', kind: 'wrap' }, d), b = await post({ mode: 'market-report', kind: 'wrap' }, d);
  assert.equal(a.j.ok, true); assert.equal(a.j.polished, true); assert.equal(b.j.cached, true); assert.equal(b.j.text, a.j.text); assert.equal(d.calls.model, 1); assert.equal(a.j.mood, 'hopeful', 'the day\'s picture mood comes from the S&P 500 move (+0.42%)'); assert.match(a.j.label, /Written by Verse from/);
  const w = await post({ mode: 'market-report', kind: 'why', s: 'aapl' }, d); assert.equal(w.j.sym, 'AAPL'); assert.ok(w.j.text.endsWith(NO_CAUSE)); assert.equal(d.calls.model, 2);
  await post({ mode: 'market-report', kind: 'why', s: 'AAPL' }, d); assert.equal(d.calls.model, 2, 'the same symbol in the same window is kept');
  const later = await post({ mode: 'market-report', kind: 'why', s: 'AAPL' }, { ...d, now: AT + 7 * 3600e3 }); assert.equal(later.j.cached, undefined, 'a new window is a new report');
});
test('a polish that invents is refused: the draft is the report, and says so only in the held field', async () => {
  const d = deps({ model: async () => 'Apple rose 5% because of strong sales, and you should buy it.' }); const r = await post({ mode: 'market-report', kind: 'why', s: 'AAPL' }, d);
  assert.equal(r.j.polished, false); assert.equal(r.j.text, r.j.draft); assert.ok(r.j.held); assert.doesNotMatch(r.j.text, /buy|because/);
});
test('the hourly allowance: past HOUR_MAX model calls in an hour the drafts are shown and the model is left alone; no model at all gives the draft', async () => {
  const d = deps(); d.counts.set('finance-report:h2026-10-23T21', HOUR_MAX);
  const r = await post({ mode: 'market-report', kind: 'wrap' }, d); assert.equal(r.j.ok, true); assert.equal(r.j.polished, false); assert.equal(d.calls.model, 0); assert.match(r.j.held, /allowance/); assert.equal(d.counts.get('finance-report'), undefined, 'a full hour takes no place of the day');
  const day = deps(); day.counts.set('finance-report', DAY_MAX); assert.equal((await post({ mode: 'market-report', kind: 'wrap' }, day)).j.polished, false);
  const noCap = deps({ cap: async () => ({ ok: false }) }); assert.equal((await post({ mode: 'market-report', kind: 'wrap' }, noCap)).j.polished, false, 'no D1: the draft, never a spend');
  const off = await post({ mode: 'market-report', kind: 'wrap' }, deps({ model: null })); assert.equal(off.j.ok, true); assert.equal(off.j.polished, false);
  assert.equal(DAY_MAX, 60, 'the daily ceiling is 60 model calls');
});
test('bounds: nothing but a kind and a resolvable symbol is read; no price means no report and no model call; a busy visitor is slowed', async () => {
  assert.equal((await post({ mode: 'market-report', kind: 'x' }, deps())).status, 400); assert.equal((await post({ mode: 'market-report', kind: 'why', s: 'http://evil.example' }, deps())).status, 400); assert.equal((await post({ mode: 'market-report', kind: 'why', data: { price: 1 } }, deps())).status, 400);
  const d = deps({ markets: { fetchFn: null, quoteBody: async () => ({ ok: false }), batch: async () => [] } }); const none = await post({ mode: 'market-report', kind: 'why', s: 'ZZZZ' }, d); assert.equal(none.j.ok, false); assert.equal(d.calls.model, 0);
  const busy = await post({ mode: 'market-report', kind: 'wrap' }, deps({ rateLimited: async () => true })); assert.equal(busy.status, 429);
  const lie = deps(); await post({ mode: 'market-report', kind: 'why', s: 'AAPL', price: 1, pct: 99, text: 'buy' }, lie); assert.equal(lie.store.m.get('report:2026-10-23:v2:why:AAPL:18').includes('99'), false, 'a number sent by a caller is never read');
});
