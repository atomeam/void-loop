// The pure half of Verse's earn loop (tools/earn.mjs, .github/workflows/earn-self.yml; owner, 2026-10-26: "its not me whos going after the money
// its Verse, and its meant to be very good at it so that it doesnt need me to find money and lots of it"; and it runs on Verse's own tools,
// never on the builders' model). Find, build, price, measure, learn: every decision the loop makes is a function here, with no network, no disk and no model, so the
// tests (tools/earn.test.mjs) pin each one. The loop's brain is Verse's own free model (Workers AI) and only for one small step (a draft of a fix
// page's meaning and steps from the official page's own text); every word it writes is checked here against that page before it can ship.
import { secretsIn } from './secret-scan.mjs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…' };
const decode = (s) => String(s).replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
/** whitespace and typographic quotes made plain, so "word for word" compares words, not markup. Pure. */
export const norm = (s) => decode(String(s || '')).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

/** the visible text of an HTML page (scripts, styles, svg, nav and footer out). Pure. */
export function htmlText(html) {
  return norm(String(html || '').replace(/<(script|style|svg|noscript|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|li|h[1-6]|div|pre|code|td|tr)>/gi, ' ').replace(/<[^>]+>/g, ' '));
}
/** every link on a page made absolute, without its #fragment, deduplicated. Pure. */
export function linksOf(html, base) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*|#[^"']*)["']/gi)) {
    try { const u = new URL(decode(m[1]), base); u.hash = ''; if (/^https:$/.test(u.protocol)) out.add(u.href); } catch (_) {}
  }
  return [...out];
}
/** the h2 and h3 headings of a page: [{ text, id }]. Pure. */
export function headingsOf(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) {
    const id = (/\bid\s*=\s*["']([^"']+)["']/i.exec(m[2]) || [])[1] || '';
    const text = norm(m[3].replace(/<[^>]+>/g, ' ')).replace(/\s*[#¶]$/, '');
    if (text) out.push({ text, id });
  }
  return out;
}
const ERRORISH_WORDS = /\b(errors?|fail(s|ed|ure)?|denied|not (found|allowed|permitted|accessible|registered|supported)|invalid|unauthori[sz]ed|forbidden|time[sd]? ?out|refused|exceeded|cannot|can't|unable|missing|expired|reset|aborted|unreachable|too many|limit|rejected|no such|unknown|bad (gateway|request)|unavailable|mismatch)\b/i, ERRORISH_CODES = /\b(?:[A-Z][a-z0-9]+)+Error\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[45]\d\d\b|\bE[A-Z]{4,}\b/;
const GENERIC = /^(?:[\w-]+\s){0,2}(?:errors|issues|problems|warnings)$|^(?:how to|how do|about|troubleshoot|troubleshooting|viewing|using|enabling|fixing|understanding|handling|types of|common|overview|introduction|next steps|related|see also|prerequisites|why|what is)\b/i;
/** does a heading read like an error someone sees ("The service refused the connection", "ConnectionError"), not a section ("Billing errors",
 *  "Troubleshooting", "How to fix it")? Pure. */
export const looksLikeError = (t) => { const s = String(t || '').trim(); return s.length >= 6 && s.length <= 140 && (ERRORISH_WORDS.test(s) || ERRORISH_CODES.test(s)) && !GENERIC.test(s); };

/** the candidates one source's pages give: [{ platform, error, doc }]. pages: { url: html } (the index and the pages it links that were fetched).
 *  Only pages on the source's own hosts count. Pure. */
export function discover(source, pages) {
  const out = [], seen = new Set(), on = (u) => { try { return (source.hosts || []).includes(new URL(u).hostname); } catch (_) { return false; } };
  const add = (error, doc) => { error = norm(error).slice(0, 140); const k = source.platform + '|' + error.toLowerCase(); if (!error || seen.has(k) || !on(doc)) return; seen.add(k); out.push({ platform: source.platform, error, doc }); };
  const link = source.link ? new RegExp(source.link) : null, indexHtml = (source.index && pages[source.index]) || '';
  const linked = link ? linksOf(indexHtml, source.index).filter((u) => link.test(u) && on(u)) : [];
  if (source.kind === 'code') { for (const u of linked) { const m = link.exec(u); add(source.upper ? m[1].toUpperCase() : m[1], String(source.doc || u).replace('$1', m[1])); } return out; }
  const docs = [...new Set([...(source.pages || []), ...(source.self && source.index ? [source.index] : []), ...linked])];
  const head = new RegExp(source.heading || '^(.{6,140})$');
  for (const u of docs) {
    const html = pages[u]; if (!html) continue;
    for (const h of headingsOf(html)) { const m = head.exec(h.text); if (m && looksLikeError(m[1] || h.text)) add((m[1] || h.text).replace(/^["'`]|["'`.:]$/g, ''), u + (h.id ? '#' + encodeURIComponent(h.id) : '')); }
  }
  return out;
}

/** a page's slug from its platform and error: lowercase words joined by '-', at most 70 characters. Pure. */
export function slugOf(platform, error) {
  return (platform + ' ' + error).toLowerCase().replace(/['"`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
}

/** expected sales per effort, Verse's way of ranking what to build next. A fix page costs about the same to make whatever the error, so the
 *  score is the expected paying demand: the platform's weight (its prior, times what its pages have earned and been clicked: learned), times how
 *  urgent the error reads (a broken login, a limit, a timeout or a hard failure stops work today: people pay to end that), times how often
 *  Verse's own misses name it. -> [{ ...candidate, score, why }] best first. Pure. */
const wordsOf = (s) => new Set(norm(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
/** is this candidate an error a page already covers (same platform; one of the page's error variants shares 60% of its words with it, or one
 *  contains the other)? Pages list their variants joined by " · ". Pure. */
export function covered(c, pages) {
  const e = norm(c.error).toLowerCase(), ew = wordsOf(e);
  for (const p of pages || []) {
    if (p.platform !== c.platform) continue;
    for (const part of String(p.error || '').split(' · ')) {
      const v = norm(part).toLowerCase(); if (!v) continue;
      if (v === e || (Math.min(v.length, e.length) >= 8 && (v.includes(e) || e.includes(v)))) return p.slug;
      const vw = wordsOf(v), both = [...ew].filter((w) => vw.has(w)).length, all = new Set([...ew, ...vw]).size;
      if (all && both / all >= 0.6) return p.slug;
    }
  }
  return '';
}

export function rank(cands, { weights = {}, missTerms = [], built = new Set(), pages = [] } = {}) {
  const urgent = /\b(401|403|429|5\d\d|unauthori[sz]ed|forbidden|rate limit|too many|time[sd]? ?out|timeout|refused|expired|denied|failed|crash|out of memory|quota|exceeded|not found|404)\b/i;
  const out = [];
  for (const c of cands) {
    const slug = slugOf(c.platform, c.error);
    if (built.has(slug) || covered(c, pages)) continue;
    const w = Number(weights[c.platform]) || 0.5;
    const u = urgent.test(String(c.error).replace(/_/g, ' ')) ? 1.5 : 1;
    const words = new Set(norm(c.platform + ' ' + c.error).toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2));
    const hits = missTerms.filter((t) => t && words.has(String(t.term || '').toLowerCase())).reduce((n, t) => n + (Number(t.n) || 0), 0);
    const m = 1 + Math.min(2, Math.log2(1 + hits) / 2);
    const score = Math.round(w * u * m * 1000) / 1000;
    out.push({ ...c, slug, score, why: `${c.platform} weight ${w.toFixed(2)}` + (u > 1 ? ', an urgent error (work stops until it is fixed)' : '') + (hits ? `, named in ${hits} of Verse's misses` : '') });
  }
  return out.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
}

/** the error text is on the official page word for word (whitespace and quote style aside, case kept). The check every page passes. Pure. */
export const errorOnPage = (error, docText) => { const e = norm(error); return e.length >= 3 && norm(docText).includes(e); };

/** the part of the official page the model reads: the text around each place the error appears (and the page's start), at most `max`. Pure. */
export function excerptOf(docText, error, max = 6000) {
  const t = norm(docText), e = norm(error), parts = [], R = 1400;
  let i = t.indexOf(e);
  while (i >= 0 && parts.join(' ').length < max) { parts.push(t.slice(Math.max(0, i - 300), i + R)); i = t.indexOf(e, i + R); }
  if (!parts.length) parts.push(t.slice(0, max));
  return parts.join(' … ').slice(0, max);
}

/** the instructions for Verse's free model: explain one error from the official page's own text, every step tied to a quote from it. Pure. */
export function draftMessages(platform, error, excerpt) {
  return [
    { role: 'system', content: 'You write a short, accurate help page for one error, using ONLY the official documentation text you are given. Never add facts, error messages, codes, settings or links that are not in that text. Plain words for a non-expert. Answer with JSON only: {"means":"two or three sentences: what the error means and its usual causes","steps":[{"text":"one step the reader takes, as an instruction","quote":"a sentence copied EXACTLY, word for word, from the documentation text that supports this step"}],"again":"one or two sentences: what to check if it comes back"}. Give 3 to 6 steps.' },
    { role: 'user', content: 'Platform: ' + platform + '\nError: ' + error + '\n\nOfficial documentation text:\n' + excerpt },
  ];
}

const CODE = /\b(?:[A-Z][a-z0-9]+)+Error\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]{2,}\b|\b[45]\d\d\b|\bE[A-Z]{4,}\b/g;
/** a model's draft, checked against the official page: the JSON asked for; plain text (no link, no markup, no key); every step backed by a
 *  quote that is on the page word for word (a step without one is dropped); every error code it names is on the page; at least 3 steps left.
 *  -> { ok: true, means, steps: [text], again, quotes } or { ok: false, why }. Pure. */
export function checkDraft(text, { error, docText }) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return { ok: false, why: 'the model did not answer with JSON' };
  let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch (_) { return { ok: false, why: 'the model did not answer with JSON' }; }
  const doc = norm(docText), plain = (x, lo, hi) => { const v = norm(x); return v.length >= lo && v.length <= hi && !/https?:\/\/|www\.|<|>|\{|\}/i.test(v) && !secretsIn(v).length ? v : ''; };
  const means = plain(j && j.means, 40, 600); if (!means) return { ok: false, why: 'no usable meaning (40 to 600 characters of plain text)' };
  const steps = [], quotes = [];
  for (const st of Array.isArray(j.steps) ? j.steps.slice(0, 8) : []) {
    const t = plain(st && st.text, 15, 320), q = norm(st && st.quote);
    if (t && q.length >= 15 && doc.includes(q)) { steps.push(t); quotes.push(q); }
  }
  if (steps.length < 3) return { ok: false, why: `only ${steps.length} step(s) were backed by a quote found word for word on the official page (3 needed)` };
  const again = plain(j && j.again, 20, 400) || 'If it comes back, open the official page in the sources below and check the cause it lists against what changed since the last run that worked.';
  const allowed = new Set([...(doc.match(CODE) || []), ...(norm(error).match(CODE) || [])]);
  const bad = [...new Set([means, ...steps, again].join(' ').match(CODE) || [])].filter((c) => !allowed.has(c));
  if (bad.length) return { ok: false, why: 'it names error codes the official page does not: ' + bad.slice(0, 5).join(', ') };
  return { ok: true, means, steps: steps.slice(0, 6), again, quotes: quotes.slice(0, 6) };
}

/** the row tools/fix-pages.json takes for a checked page (the title and the error line are templates, never the model's words). Pure. */
export function pageRow(c, draft, { at, docTitle } = {}) {
  const short = (c.platform + ' ' + c.error).slice(0, 90);
  return {
    slug: c.slug || slugOf(c.platform, c.error), platform: c.platform,
    title: `${short}: what it means and how to fix it`, short, error: c.error,
    means: draft.means, steps: draft.steps, again: draft.again,
    sources: [[(norm(docTitle) || c.error).slice(0, 110) + ' (' + c.platform + ' documentation)', c.doc]],
    checked: { at: String(at || '').slice(0, 10), url: c.doc }, made_by: 'verse', added: String(at || '').slice(0, 10),
  };
}

const usd = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
/** Verse's appraisal of a service from what rivals charge and what Verse has proven. With no sales yet the price sits at the rivals' common
 *  starting price (an unknown seller with no reviews wins a first buyer on price, and the first sale is worth more than margin); every three
 *  verified sales with no refund earn a step toward the top rivals' price; clicks that never buy at that price say the price is the obstacle,
 *  so it steps back down. -> { cents, why }. Pure. */
export function appraiseService({ comps = [], sales = 0, refunds = 0, views = 0, clicks = 0 } = {}) {
  const c = comps.map((x) => Number(x.cents) || 0).filter((x) => x > 0).sort((a, b) => a - b);
  if (!c.length) return { cents: 0, why: 'no rival prices on file, so Verse does not price this yet' };
  const low = c[0], top = c[c.length - 1], common = c[Math.floor((c.length - 1) / 2)];
  const proven = Math.max(0, sales - refunds * 2), steps = Math.floor(proven / 3);
  let cents = Math.min(top, common + steps * Math.round((top - common) / 4 / 100) * 100);
  const why = [`rivals charge ${usd(low)} to ${usd(top)} (${c.length} seen; ${usd(common)} is the common starting price)`];
  if (!sales) why.push('Verse has no sales or reviews yet, so it meets the common starting price to win a first buyer');
  else why.push(`${sales} sale${sales === 1 ? '' : 's'}${refunds ? ', ' + refunds + ' refunded' : ''}: ${steps ? steps + ' step' + (steps === 1 ? '' : 's') + ' toward the top rivals' : 'not yet enough to charge more'}`);
  if (clicks >= 30 && sales === 0 && cents > low) { cents = low; why.push(`${clicks} presses of the buy button and no sale: the price is in the way, so it goes to the low end`); }
  if (views) why.push(`${views} views of its offer pages so far`);
  return { cents, why: 'Why ' + usd(cents) + ': ' + why.join('; ') + '.' };
}

const DAY = 864e5;
/** what to retire: an offer page is given time to be found (search engines take weeks), so only a page at least `days` old that people did see
 *  (`minViews`) and never pressed buy on, and never sold, is retired. Retired is salvage: its file stays, it leaves the hub and the sitemap.
 *  -> [slug]. Pure. */
export function toRetire(pages, stats, { now = Date.now(), days = 60, minViews = 100 } = {}) {
  return pages.filter((p) => p.made_by === 'verse' && p.status !== 'retired' && p.added && now - Date.parse(p.added) >= days * DAY)
    .filter((p) => { const s = stats[p.slug] || {}; return (s.views || 0) >= minViews && !(s.clicks || 0) && !(s.sales || 0); }).map((p) => p.slug);
}

/** double down: each platform's weight is its prior times (1 + its pages' buy presses per 100 views) times (1 + 2 x its sales), at most 3x the
 *  prior. -> { platform: weight }. Pure. */
export function learnWeights(sources, pages, stats) {
  const out = {};
  for (const s of sources) {
    let v = 0, k = 0, n = 0;
    for (const p of pages) if (p.platform === s.platform) { const x = stats[p.slug] || {}; v += x.views || 0; k += x.clicks || 0; n += x.sales || 0; }
    out[s.platform] = Math.round(Math.min(3 * s.weight, s.weight * (1 + (v ? (100 * k) / v / 100 : 0)) * (1 + 2 * n)) * 1000) / 1000;
  }
  return out;
}

/** the line on Verse's self card: "Earned $X this week from N sales (best: Y); next I'm trying Z." Pure. */
export function selfLine({ week_cents = 0, week_sales = 0, best = '', next = '', published = 0, views = 0 } = {}) {
  const earned = week_sales ? `Earned ${usd(week_cents)} this week from ${week_sales} sale${week_sales === 1 ? '' : 's'}${best ? ' (best: ' + best + ')' : ''}` : `Earned $0 this week${views ? ' from ' + views + ' offer views' : ''}`;
  return earned + (published ? `; published ${published} new fix page${published === 1 ? '' : 's'}` : '') + (next ? `; next I'm trying ${next}` : '') + '.';
}
