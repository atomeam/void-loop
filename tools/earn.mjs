// Verse goes after money by itself (owner, 2026-10-26: "i mean for Verse to go after and make money"; "its not me whos going after the money its
// Verse, and its meant to be very good at it so that it doesnt need me to find money and lots of it"; and with no builder's model in the loop:
// Verse's own tools only). One daily run (.github/workflows/earn-self.yml), on Verse's own free model and free tiers only, inside the caps in
// domains/earn.sources.json:
//   MEASURE  what each offer did: views and buy presses (the public offer counter, /api/tally) and sales and revenue (the owner-only /api/earnings,
//            counts and totals only), into domains/earnings-log.json.
//   LEARN    double down: each platform's weight from what its pages earn and get pressed; retire a page people saw and never wanted (salvage:
//            the file stays, it leaves the hub and the sitemap, docs/SALVAGE.md says so).
//   FIND     errors people hit, from official error indexes (domains/earn.sources.json), ranked by expected sales per effort
//            (tools/earn-core.mjs rank), into domains/earn.candidates.json.
//   BUILD    the next fix pages: the official page fetched, the error found on it word for word (or the candidate is dropped and logged), Verse's
//            free model drafts the meaning and the steps from that page's text, and every step must carry a quote found on the page word for
//            word (checkDraft); the title and the error line are templates. Then tools/fix-pages.mjs and tools/sitemap.mjs write the pages.
//   PRICE    Verse appraises what the pages sell (the One-Time Fix) from rival prices (domains/earn.comps.json) and its own record, with the
//            reasoning, into the public price log void-live-deploy/store/prices.json. No visitor input reaches a price.
//   REPORT   one line for Verse's self card and the agent log: "Earned $X this week ...; next I'm trying Z."
// Spending: none until there are earnings (STANDING.md: the budget is what Verse has earned). The run records the budget and that spending is off.
//   node tools/earn.mjs                 plan only: measure, learn, find and rank; print what it would build (no model, no writes)
//   node tools/earn.mjs --write         the daily run: all of the above, build up to the caps, write the files
//   node tools/earn.mjs --write --offline   no network at all (tests): measure from the files, discover nothing, build nothing
// Env: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (the free model; without them nothing is drafted), VOID_OWNER_TOKEN (sales; optional),
// EARN_SITE (default https://a-to-mind.com). Docs: docs/playbooks/revenue.md. Tests: tools/earn.test.mjs.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';
import { isFixAsk } from '../void-live-deploy/lib/automation-fix.js';
import CATALOG from '../void-live-deploy/lib/store-products.js';
import { askOf } from './fix-pages.mjs';
import { htmlText, linksOf, discover, rank, errorOnPage, excerptOf, draftMessages, checkDraft, pageRow, appraiseService, toRetire, learnWeights, selfLine, slugOf } from './earn-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (f) => resolve(root, f);
const readJson = (f, d) => { try { return JSON.parse(readFileSync(P(f), 'utf8')); } catch (_) { return d; } };
const writeJson = (f, o) => writeFileSync(P(f), JSON.stringify(o, null, 1) + '\n');
const WRITE = process.argv.includes('--write'), OFFLINE = process.argv.includes('--offline');
const SITE = (process.env.EARN_SITE || 'https://a-to-mind.com').replace(/\/$/, '');
const UA = 'a2m-earn/1 (+https://a-to-mind.com/fix/)';
const usd = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
const now = new Date(), today = now.toISOString().slice(0, 10);

const cfg = readJson('domains/earn.sources.json', { sources: [], caps: {} });
const caps = { fetches: 40, model_calls: 6, new_pages: 3, retry_dropped_after_days: 30, ...(cfg.caps || {}) };
let fetches = 0, modelCalls = 0;
const notes = [];

/** one GET under the cap, on an allowed host only; '' when it cannot be read */
async function get(url, hosts) {
  if (OFFLINE || fetches >= caps.fetches) return '';
  try { if (hosts && !hosts.includes(new URL(url).hostname)) return ''; } catch (_) { return ''; }
  fetches++;
  try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); return r.ok ? (await r.text()).slice(0, 2e6) : ''; }
  catch (_) { return ''; }
}
async function getJson(url, headers = {}) {
  if (OFFLINE) return null;
  try { const r = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : { status: r.status }; } catch (_) { return null; }
}
/** one call to Verse's own free model (Workers AI), under the cap; '' when it cannot answer */
async function model(messages) {
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID, tok = process.env.CLOUDFLARE_API_TOKEN;
  if (OFFLINE || !acct || !tok || modelCalls >= caps.model_calls) return '';
  modelCalls++;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/run/' + FREE_MODEL, { method: 'POST', signal: AbortSignal.timeout(90000),
      headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ messages, max_tokens: 1800 }) });
    if (!r.ok) { notes.push('the free model answered ' + r.status); return ''; }
    const j = await r.json(), x = (j && j.result) || {};
    return typeof x.response === 'string' ? x.response : x.response ? JSON.stringify(x.response) : String((x.choices && x.choices[0] && x.choices[0].message && x.choices[0].message.content) || '');
  } catch (e) { notes.push('the free model did not answer (' + ((e && e.message) || e) + ')'); return ''; }
}

// ---------- MEASURE ----------
const fixPages = readJson('tools/fix-pages.json', []);
const log = readJson('domains/earnings-log.json', { about: '', days: [], offers: {} });
log.about = 'What Verse earned and what each offer did, one row a day (tools/earn.mjs, the earn loop). Counts and totals only: no name, no email, no address. views and clicks are the public offer counter (/api/tally, anonymous and inflatable, a hint); sales and cents are Gumroad\'s own keyed pings (/api/earnings).';
const counts = async (of) => { const j = await getJson(SITE + '/api/tally?of=' + of); return (j && j.counts && j.counts.all) || null; };
const views = await counts('offer-view'), clicks = await counts('offer-click');
const earn = process.env.VOID_OWNER_TOKEN ? await getJson(SITE + '/api/earnings', { authorization: 'Bearer ' + process.env.VOID_OWNER_TOKEN }) : null;
const earnOk = !!(earn && typeof earn.earned_cents === 'number');
if (!views) notes.push('the offer counter could not be read (not deployed yet, or offline)');
if (!earnOk) notes.push(process.env.VOID_OWNER_TOKEN ? 'sales could not be read (/api/earnings answered ' + ((earn && earn.status) || 'nothing') + ')' : 'no VOID_OWNER_TOKEN, so sales were not read');
const stats = {};
const bump = (id, k, n) => { if (!n) return; (stats[id] ||= { views: 0, clicks: 0, sales: 0, cents: 0 })[k] += n; };
for (const [id, n] of Object.entries(views || {})) bump(id, 'views', Number(n) || 0);
for (const [id, n] of Object.entries(clicks || {})) bump(id, 'clicks', Number(n) || 0);
if (earnOk) for (const [id, o] of Object.entries(earn.by_page || {})) { bump(id, 'sales', o.sales || 0); bump(id, 'cents', o.earned_cents || 0); }
const prev = log.days[log.days.length - 1] || null;
const weekAgo = log.days.filter((d) => d.day <= new Date(now - 7 * 864e5).toISOString().slice(0, 10)).pop() || null;
const earned = earnOk ? earn.earned_cents : (prev ? prev.earned_cents : 0), sales = earnOk ? earn.sales : (prev ? prev.sales : 0);

// ---------- LEARN ----------
const weights = learnWeights(cfg.sources || [], fixPages, stats);
const retire = toRetire(fixPages, stats, { now: now.getTime() });
for (const p of fixPages) if (retire.includes(p.slug)) { p.status = 'retired'; p.retired = today; }

// ---------- FIND ----------
const state = readJson('domains/earn.candidates.json', { about: '', candidates: [] });
state.about = 'Errors Verse found on official error indexes (domains/earn.sources.json) and what became of each: queued, built (a /fix/ page), or dropped with the reason (the error text was not on the official page, or the free model\'s draft failed the check). A dropped one is tried again after ' + caps.retry_dropped_after_days + ' days.';
const known = new Map(state.candidates.map((c) => [c.slug, c]));
const docCache = new Map();
for (const src of cfg.sources || []) {
  if (fetches >= caps.fetches) break;
  const pages = {};
  if (src.index) { const idx = await get(src.index, src.hosts); if (idx) { pages[src.index] = idx; docCache.set(src.index, idx); } }
  if (src.kind === 'headings') {
    const link = src.link ? new RegExp(src.link) : null;
    const more = link && pages[src.index] ? linksOf(pages[src.index], src.index).filter((u) => link.test(u)).slice(0, 6) : [];
    for (const u of [...(src.pages || []), ...more]) { if (pages[u]) continue; const h = await get(u, src.hosts); if (h) { pages[u] = h; docCache.set(u, h); } }
  }
  if (!Object.keys(pages).length) { notes.push(src.platform + ': no official page could be read'); continue; }
  let n = 0;
  for (const c of discover(src, pages)) { const slug = slugOf(c.platform, c.error); if (!known.has(slug)) { known.set(slug, { ...c, slug, status: 'queued', found: today }); n++; } }
  if (n) notes.push(src.platform + ': ' + n + ' new error(s) found');
}
const built = new Set(fixPages.map((p) => p.slug));
for (const c of known.values()) if (built.has(c.slug) && c.status !== 'built') c.status = 'built';
const missTerms = (readJson('domains/void.misses.json', { terms: [] }).terms || []).map((t) => ({ term: t.term, n: t.misses || t.asks || 0 }));
const retryBefore = new Date(now - caps.retry_dropped_after_days * 864e5).toISOString().slice(0, 10);
const open = [...known.values()].filter((c) => c.status === 'queued' || (c.status === 'dropped' && String(c.at || '') < retryBefore));
const ranked = rank(open, { weights: { ...Object.fromEntries((cfg.sources || []).map((s) => [s.platform, s.weight])), ...weights }, missTerms, built, pages: fixPages });

// ---------- BUILD ----------
const published = [], dropped = [];
const drop = (c, why) => { const k = known.get(c.slug); Object.assign(k, { status: 'dropped', at: today, why }); dropped.push({ slug: c.slug, why }); };
if (WRITE) for (const c of ranked) {
  if (published.length >= caps.new_pages || modelCalls >= caps.model_calls || fetches >= caps.fetches) break;
  const src = (cfg.sources || []).find((s) => s.platform === c.platform); if (!src) continue;
  const docUrl = c.doc.split('#')[0];
  const html = docCache.get(docUrl) || await get(docUrl, src.hosts); if (!html) { drop(c, 'the official page could not be read'); continue; }
  docCache.set(docUrl, html);
  const text = htmlText(html);
  if (!errorOnPage(c.error, text)) { drop(c, 'the error text is not on the official page word for word'); continue; }
  const raw = await model(draftMessages(c.platform, c.error, excerptOf(text, c.error)));
  if (!raw) { notes.push('no draft for ' + c.slug + ' (the free model is not reachable): left queued'); break; }
  const d = checkDraft(raw, { error: c.error, docText: text });
  if (!d.ok) { drop(c, 'the draft failed the check: ' + d.why); continue; }
  const docTitle = (/<title>([^<]{3,200})<\/title>/i.exec(html) || [])[1] || '';
  const row = pageRow(c, d, { at: now.toISOString(), docTitle: docTitle.split(/\s[|·–-]\s/)[0] });
  if (!isFixAsk(askOf(row))) { drop(c, 'Verse\'s fixer would not take the page\'s ask'); continue; }
  fixPages.push(row); built.add(row.slug); Object.assign(known.get(c.slug), { status: 'built', at: today }); published.push(row.slug);
}

// ---------- PRICE ----------
const comps = readJson('domains/earn.comps.json', { offers: {} }).offers || {};
const priceLog = readJson('void-live-deploy/store/prices.json', { about: '', prices: [] });
priceLog.about = 'Verse is the appraiser (STANDING.md): every price it sets, with its reasoning, newest first. Written by Verse\'s earn loop (tools/earn.mjs) from what rivals charge (domains/earn.comps.json) and its own sales. Nothing a visitor says moves a price; the owner can change any.';
const fixStats = fixPages.reduce((a, p) => { const s = stats[p.slug] || {}; a.views += s.views || 0; a.clicks += s.clicks || 0; return a; }, { views: 0, clicks: 0 });
const fixSlug = (CATALOG.find((p) => p.id === 'one-time-fix') || {}).gumroad || '';
const fixSales = earnOk && fixSlug ? ((earn.by_offer || {})[fixSlug] || {}).sales || 0 : 0;
const priced = [];
for (const [offer, c] of Object.entries(comps)) {
  const listing = CATALOG.find((p) => p.id === offer);
  const a = appraiseService({ comps: c.comps, sales: offer === 'one-time-fix' ? fixSales : 0, views: offer === 'one-time-fix' ? fixStats.views : 0, clicks: offer === 'one-time-fix' ? fixStats.clicks : 0 });
  if (!a.cents) continue;
  const last = priceLog.prices.find((x) => x.offer === offer);
  const gap = listing && listing.cents !== a.cents ? `The Gumroad listing charges ${usd(listing.cents)}; it moves to ${usd(a.cents)} when the listing is changed (the repository holds no Gumroad API token, so the owner or Gumroad's dashboard changes it).` : '';
  if (!last || last.cents !== a.cents || last.gap !== gap) { priceLog.prices.unshift({ at: today, offer, cents: a.cents, price: usd(a.cents), why: a.why, ...(gap ? { gap } : {}) }); priced.push(offer + ' ' + usd(a.cents)); }
}

// ---------- REPORT ----------
const weekCents = Math.max(0, earned - (weekAgo ? weekAgo.earned_cents : 0)), weekSales = Math.max(0, sales - (weekAgo ? weekAgo.sales : 0));
const best = Object.entries(stats).filter(([, s]) => s.sales).sort((a, b) => b[1].cents - a[1].cents)[0];
const next = ranked.filter((c) => !built.has(c.slug))[0];
const line = selfLine({ week_cents: weekCents, week_sales: weekSales, best: best ? best[0] : '', next: next ? 'a fix page for ' + next.platform + ' ' + next.error : 'more error indexes to read', published: published.length, views: fixStats.views });
const day = { day: today, earned_cents: earned, sales, budget_cents: Math.max(0, earned), spending: earned > 0 ? 'allowed inside the caps (STANDING.md)' : 'off: nothing earned yet', views: fixStats.views, clicks: fixStats.clicks, published, dropped: dropped.length, retired: retire, priced, notes };
log.days = log.days.filter((d) => d.day !== today).concat([day]).slice(-180);
for (const [id, s] of Object.entries(stats)) log.offers[id] = s;
log.weights = weights; log.line = line; log.at = now.toISOString();
state.candidates = [...known.values()].sort((a, b) => (a.status > b.status ? 1 : a.status < b.status ? -1 : a.slug.localeCompare(b.slug)));

const summary = { at: now.toISOString(), earned: usd(earned), sales, line, measured: { views: fixStats.views, clicks: fixStats.clicks, salesRead: earnOk }, weights,
  found: known.size, queued: open.length, top: ranked.slice(0, 5).map((c) => ({ slug: c.slug, score: c.score, why: c.why })), published, dropped, retired: retire, priced, fetches, modelCalls, notes };
if (WRITE) {
  writeJson('tools/fix-pages.json', fixPages);
  writeJson('domains/earnings-log.json', log);
  writeJson('domains/earn.candidates.json', state);
  writeJson('void-live-deploy/store/prices.json', priceLog);
  if (retire.length) appendFileSync(P('docs/SALVAGE.md'), retire.map((s) => `\n- **/fix/${s}/** (retired by Verse's earn loop, ${today}): people saw it and never pressed buy. The page file stays; it left the hub and the sitemap. Could become: a section of a broader page for its platform.`).join('') + '\n');
  if (published.length || retire.length) {
    for (const cmd of [['tools/fix-pages.mjs'], ['tools/sitemap.mjs']]) { const r = spawnSync(process.execPath, cmd.map(P), { cwd: root, encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); } }
  }
  appendFileSync(P('domains/void.agents.log.md'), `${now.toISOString().replace(/\.\d+Z$/, 'Z')} | verse | earn | ${line} Read ${fetches} official pages, made ${modelCalls} free-model call(s); ${published.length} page(s) published${dropped.length ? ', ' + dropped.length + ' dropped by the check' : ''}${retire.length ? ', ' + retire.length + ' retired' : ''}. Budget ${usd(Math.max(0, earned))}: ${day.spending}.\n`);
}
console.log(JSON.stringify(summary, null, 1));
