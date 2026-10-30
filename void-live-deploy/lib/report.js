// "Verse reports" on /markets/: the daily market wrap and the "why is X moving" line. Facts first: a plain draft is built from the quotes already fetched (pure,
// deterministic, every number in it is one of the data's), the free text model may only polish its wording, and the polish is kept only when validatePolish() finds
// nothing in it that the draft does not have: no new number, symbol or name, no cause, no opinion, no prediction. Otherwise the draft is what is shown.
// Nothing here recommends, sets a price target or predicts. Pure; the route is lib/report-run.js. Tests: tools/report.test.mjs.
import { fmtPrice, fmtDay } from './markets.js';

export const SECTORS = Object.freeze({ AAPL: 'technology', MSFT: 'technology', NVDA: 'technology', GOOGL: 'technology', META: 'technology', AMD: 'technology', AMZN: 'consumer', TSLA: 'consumer', WMT: 'consumer', NFLX: 'communication', JPM: 'financial', V: 'financial' });
export const NO_CAUSE = 'No cause found in the data: Verse has no headlines or filings, so this says what moved, not why.';
const SIGN = (p) => (Math.abs(p) < 0.1 ? 'little changed' : p > 0 ? 'rose' : 'fell');
const pc = (p) => Math.abs(p).toFixed(2) + '%';
const px = (q) => (q.kind === 'fx' ? q.price.toFixed(4) : fmtPrice(q.price));
const move = (q) => (Math.abs(q.pct) < 0.1 ? 'was little changed at ' + px(q) + ' (' + (q.pct >= 0 ? '+' : '−') + pc(q.pct) + ')' : SIGN(q.pct) + ' ' + pc(q.pct) + ' to ' + px(q));

/** which window a report belongs to: the wrap is one per UTC day, a symbol's line one per six hours of it. Pure. */
export function windowOf(kind, now = Date.now()) { const d = new Date(now), day = d.toISOString().slice(0, 10); return kind === 'why' ? day + '-' + String(Math.floor(d.getUTCHours() / 6) * 6).padStart(2, '0') : day; }
/** the sources named on a label, from the quotes they came in. Pure. */
export const sourcesOf = (qs) => [...new Set(qs.map((q) => q && q.source).filter(Boolean).flatMap((s) => String(s).split(/,\s*/)).map((s) => s.replace(/\s*\(unofficial\)|\s+reference rates.*$| via .*$/i, '').trim()).filter(Boolean))];
/** the label under every report. Pure. */
export function labelFor(qs, at) { const s = sourcesOf(qs); return 'Written by Verse from ' + (s.join(', ') || 'public') + ' data, delayed, not financial advice. ' + new Date(at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC.'; }

/** the daily wrap, in neutral plain words, from slim quotes ({ sym, name, price, pct, kind }). null when too little came back. Pure. */
export function wrapDraft(quotes, at = Date.now()) {
  const by = Object.fromEntries((quotes || []).filter((q) => q && q.ok !== false && q.pct != null && q.price != null).map((q) => [q.sym, q])), out = [];
  const idx = ['SPX', 'DJI', 'NDX'].map((s) => by[s]).filter(Boolean);
  if (idx.length) out.push('Markets wrap for ' + fmtDay(at) + '. ' + idx.map((q, i) => (i ? 'the ' : 'The ') + q.name + ' ' + move(q)).join(', ') + '.');
  else out.push('Markets wrap for ' + fmtDay(at) + '.');
  const stocks = (quotes || []).filter((q) => q && q.ok !== false && q.kind === 'stock' && q.pct != null && SECTORS[q.sym]).sort((a, b) => b.pct - a.pct);
  if (stocks.length >= 4) {
    const up = stocks.slice(0, 3).filter((q) => q.pct > 0), down = stocks.slice(-3).reverse().filter((q) => q.pct < 0), li = (a) => a.map((q) => q.sym + ' (' + (q.pct >= 0 ? '+' : '−') + pc(q.pct) + ')').join(', ');
    out.push('Among ' + stocks.length + ' large US stocks, ' + [up.length ? 'the biggest gains were ' + li(up) : '', down.length ? 'the biggest falls were ' + li(down) : ''].filter(Boolean).join(' and ') + '.');
  }
  const oth = ['BTC', 'ETH', 'EUR/USD'].map((s) => by[s]).filter(Boolean);
  if (oth.length) out.push(oth.map((q) => q.name + ' ' + move(q)).join(', ') + '.');
  return out.length >= 2 ? out.join(' ') : null;
}
/** the "why is X moving" line: what the data shows, and the plain statement that no cause was found. `q` is the full quote (with avgVol, sd, hi52), `ctx` { index, peers }. null without a price. Pure. */
export function whyDraft(q, ctx = {}) {
  if (!q || q.price == null || q.pct == null) return null; const cur = q.currency && q.currency !== 'pts' ? ' ' + q.currency : '', out = [];
  const span = q.kind === 'crypto' ? 'over the last 24 hours' : 'in the latest session, ' + fmtDay(q.asOf);
  out.push((q.name && q.name !== q.sym ? q.name + ' (' + q.sym + ')' : q.sym) + ' ' + move(q) + cur + ' ' + span + '.');
  if (q.sd) out.push('That is ' + (Math.abs(q.pct) / q.sd).toFixed(1) + ' times its usual daily move of ' + q.sd.toFixed(2) + '% over the last 60 sessions.');
  if (q.avgVol && q.volume) out.push('Volume was ' + (q.volume / q.avgVol).toFixed(1) + ' times its 30-day average.');
  if (q.hi52 != null && q.lo52 != null) { const below = (1 - q.price / q.hi52) * 100; out.push(below < 0.05 ? 'It is at its 52-week high of ' + fmtPrice(q.hi52) + '.' : 'It is ' + below.toFixed(1) + '% below its 52-week high of ' + fmtPrice(q.hi52) + ' and above its low of ' + fmtPrice(q.lo52) + '.'); }
  if (ctx.index && ctx.index.pct != null && q.sym !== ctx.index.sym) { const ip = ctx.index.pct; out.push('The ' + ctx.index.name + ' ' + (Math.abs(ip) < 0.1 ? 'was little changed (' + (ip >= 0 ? '+' : '−') + pc(ip) + ')' : SIGN(ip) + ' ' + pc(ip)) + ' in the same period.'); }
  const peers = (ctx.peers || []).filter((p) => p && p.pct != null && p.sym !== q.sym);
  if (peers.length) out.push('Related ' + (SECTORS[q.sym] || 'peer') + ' stocks: ' + peers.slice(0, 4).map((p) => p.sym + ' (' + (p.pct >= 0 ? '+' : '−') + pc(p.pct) + ')').join(', ') + '.');
  out.push(NO_CAUSE);
  return out.join(' ');
}

export const REPORT_SYSTEM = 'You rewrite a short market note so it reads smoothly. Keep every fact exactly: use only the numbers, symbols and names that are in the note, add none, drop none. Do not give a reason or cause for any move, do not guess, predict or advise, and keep the sentence "No cause found in the data" if the note has it. Plain, neutral words, three to six sentences, no headline, no lists, no emoji.';
export const polishMessages = (draft) => [{ role: 'system', content: REPORT_SYSTEM }, { role: 'user', content: 'Note:\n' + draft }];

// words that make a claim the data cannot back: a cause, a view, a prediction
const CAUSE = /\b(because|due to|driven by|thanks to|owing to|on (?:news|reports?|fears|hopes|worries|concerns)|amid|as investors|after (?:the |a |an )?(?:earnings|news|report|announcement|data|decision)|triggered|sparked|fuelled|fueled|boosted by|weighed (?:on|down)|pressured by|result of)\b/i;
const ADVICE = /\b(buy|sell|hold|recommend\w*|price targets?|target price|predict\w*|forecast\w*|outlook|should|expected to|likely|could (?:rise|fall|climb|drop)|may (?:rise|fall|climb|drop)|will (?:rise|fall|continue|climb|drop|likely)|outperform\w*|underperform\w*|bullish|bearish|upside|downside|opportunit\w*|attractive|undervalued|overvalued|worth buying|invest(?:ors?)? (?:should|can))\b/i;
const numbersOf = (t) => [...String(t).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => +m[0].replace(/,/g, '')).filter(Number.isFinite);
const capsOf = (t) => [...String(t).matchAll(/\b[A-Z]{2,6}\b|\b[A-Z]&[A-Z]\b/g)].map((m) => m[0]);
const KNOWN_CAPS = new Set(['US', 'UTC', 'ETF', 'FX', 'ECB', 'USD', 'EUR', 'GBP', 'JPY']);
const wordsOf = (t) => new Set((String(t).toLowerCase().match(/[a-z][a-z&'’.-]*/g) || []).map((w) => w.replace(/[.'’-]+$/, '')));
/** { ok, why } for a polished text against its draft: every number is one of the draft's, every symbol and capitalised name is in the draft, no cause, no advice or
 *  prediction, the draft's moves (the percent numbers) all kept, the no-cause sentence kept when the draft has it, a sensible length. Pure. */
export function validatePolish(polished, draft) {
  const t = String(polished || '').trim(); if (!t) return { ok: false, why: 'empty' };
  if (t.length > 900 || t.length < Math.min(60, draft.length / 2)) return { ok: false, why: 'length' };
  if (CAUSE.test(t) && !CAUSE.test(draft)) return { ok: false, why: 'a cause the data does not give' };
  if (ADVICE.test(t)) return { ok: false, why: 'advice or a prediction' };
  const have = numbersOf(draft), got = numbersOf(t);
  for (const n of got) if (!have.some((h) => Math.abs(h - n) < 1e-9)) return { ok: false, why: 'a number not in the data: ' + n };
  const pcts = [...String(draft).matchAll(/(\d[\d,]*(?:\.\d+)?)%/g)].map((m) => +m[1].replace(/,/g, '')); for (const p of pcts) if (!got.some((g) => Math.abs(g - p) < 1e-9)) return { ok: false, why: 'a move of the data left out: ' + p + '%' };
  const dc = new Set(capsOf(draft)); for (const c of capsOf(t)) if (!dc.has(c) && !KNOWN_CAPS.has(c)) return { ok: false, why: 'a symbol not in the data: ' + c };
  const dw = wordsOf(draft); for (const sent of t.split(/(?<=[.!?])\s+/)) for (const m of sent.matchAll(/(?<!^)(?<=\s)([A-Z][a-z]+)/g)) { const w = m[1].toLowerCase(); if (!dw.has(w) && !['verse', 'us', 'the', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(w)) return { ok: false, why: 'a name not in the data: ' + m[1] }; }
  if (/no cause found in the data/i.test(draft) && !/no cause found in the data/i.test(t)) return { ok: false, why: 'the no-cause line was dropped' };
  if (/[#*`]|^\s*[-•]/m.test(t)) return { ok: false, why: 'formatting' };
  return { ok: true };
}
