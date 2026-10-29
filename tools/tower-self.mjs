// Versus by itself (owner, 2026-10-26: "use all your energy into making fully autonomous verse continue the tower without you"; "all sites get a page"):
// Verse climbs the tower with no builder in the loop, on its own free model (Workers AI, lib/models.js FREE_MODEL) and its own tools, from a scheduled
// workflow (.github/workflows/tower-self.yml). One run:
//   PICK      the next sites of the frontier (void-live-deploy/tower.frontier.json, lib/tower.js frontierOf: smallest first), skipping what it tried lately
//   RESEARCH  each site read at its own address (tools/feature-scan.mjs scanSite: robots.txt respected, parked, stub and sign-in pages refused)
//   CLASSIFY  one model call: which of Verse's floors does that site's job (familiesOf: a floor with a page, a probe and a page that can be copied),
//             and the new page's words; a site no floor covers becomes a build job on Verse's queue with what was read, never invented code
//   BUILD     a DATA row in lib/self-sites.js: the site joins its family's lane (LANES, LANE_PAGES) and gets a page of its own, the family's page with
//             the row's name, headline and intro (variantHtml), its search block (tools/seo-pages.mjs) and its place in the offline list (sw.js TOOLS);
//             its features go into domains/features/<family>.json (feature-scan's own merge). Every row passes validTexts (no site named, nothing the
//             family's page does not do, no key) or it is discarded and logged
//   GATE      the workflow deploys and runs tools/tower-gate.mjs on each new site's floor, landing its rows like tower-gate.yml (tools/gate-land.mjs)
//   FIX       judge: a losing row with a known mechanical fix gets it (offline: the page added to sw.js TOOLS; sharing: the page's own link-preview tags
//             rewritten), anything else becomes a queued job carrying the gate's evidence
//   REPORT    one line per run on the agent log and the growth ledger ("Versus: took on X, surpassed Y of Z rows; next W") and in domains/tower-self.json
// Every step runs on Verse's own model and tools; no outside assistant is called (tools/tower-self.test.mjs walks the loop's files to keep it so).
//   node tools/tower-self.mjs plan [--site host] [--max N] [--out plan.json]   the next candidates (no network)
//   node tools/tower-self.mjs build plan.json decision.json [--built N]       read, classify, research (browser + model), write the decision
//   node tools/tower-self.mjs apply decision.json                             write the rows, pages, offline list, features and state onto the tree
//   node tools/tower-self.mjs pages                                           regenerate every self-built page from its family's page
//   node tools/tower-self.mjs paths | discard decision.json "why"               the pages' folders; a decision's rows dropped as discarded
//   node tools/tower-self.mjs ids [decision.json]                             the floor ids to gate (this run's, else every self-built one not yet surpassed)
//   node tools/tower-self.mjs judge ids.txt [--queue]                         read the gate's rows, apply mechanical fixes, queue the rest, report
//   node tools/tower-self.mjs guard                                           exit 1 when a frontier site at the front of the queue has no page
//   node tools/tower-self.mjs status                                          what the loop has done and how many pages a day
import { badgeOf, buildable } from '../void-live-deploy/lib/gate-badge.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, tower, frontierOf, hostOf, noShotOf, gate, barRow } from '../void-live-deploy/lib/tower.js';
import { SELF_SITES } from '../void-live-deploy/lib/self-sites.js';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';
import { probeFor, keywordsOf } from './tower-probes.mjs';
import { secretsIn } from './secret-scan.mjs';
import { pageOf as seoPageOf } from '../void-live-deploy/lib/seo.js';
import { rankingOf, offLimits, versusAllowed } from './versus-ranking.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SITE_DIR = path.join(root, 'void-live-deploy');
export const STATE = path.join(root, 'domains', 'tower-self.json'), ROWS = path.join(SITE_DIR, 'lib', 'self-sites.js'), SW = path.join(SITE_DIR, 'sw.js');
const ORIGIN = 'https://a-to-mind.com', SITE_API = (process.env.VERSE_SITE || ORIGIN).replace(/\/+$/, '');
export const RETRY_DAYS = 60; // a site no floor covered is tried again after this (the floors grow)
export const MAX_READ = 8, MAX_BUILT = 4, MAX_OPEN_JOBS = 6; // per run: sites read, pages built; versus jobs open at once
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z'), today = () => now().slice(0, 10);
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };
const pathOnly = (u) => String(u || '').replace(/[?#].*$/, ''), tailOf = (u) => { const m = String(u || '').match(/[?#].*$/); return m ? m[0] : ''; };

// ---- the families a site can join ----
const RELATIVE = /(?:\bsrc|\bhref)\s*=\s*["'](?![/#?]|https?:|data:|mailto:|javascript:|blob:)[^"']+["']|\bimport\s*\(\s*['"]\.|\bfrom\s+['"]\./i;
export const baseHtmlOf = (page) => { try { return fs.readFileSync(path.join(SITE_DIR, pathOnly(page), 'index.html'), 'utf8'); } catch (_) { return null; } };
const metaOf = (html, key) => { const m = String(html || '').match(new RegExp('<meta\\s+(?:name|property)="' + key + '"\\s+content="([^"]*)"', 'i')); return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : ''; };
/** the visible words of a page's html (scripts and styles left out). Pure. */
export const textOf = (html) => String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
/** the floors a site can join with a data row: a hand floor whose own page is a folder that can be copied one level down (no relative address), with a
 *  probe that knows the right answer (truth) and asks it on that same page, and whose pictures may be kept. Each with what Verse's page does. Pure but for reading pages. */
// floors whose lanes other tests pin to their own tables (tools/tool-sites.test.mjs: every pdf and kanban lane site has a PDF_SITES or KANBAN_SITES row;
// tools/flights.test.mjs: seven travel sites; tools/generators.test.mjs: ten generator sites): a site of theirs waits as a queued job until those
// tests read lib/self-sites.js too
export const PINNED = Object.freeze(['pdf', 'kanban', 'travel', 'random generators']);
// floors whose page does only part of their site's job, so a new site must never be beaten by copying that page under its name: the codebase floor
// stands on /g/ (a gist with a task list and a timer), and a code host's job (repositories, tickets, accounts) is wider; tildegit, a second code
// host on /g/, waits as a deferred floor for that reason (lib/tower.js). A site like them is added by hand as a deferred floor, never by a data row
export const PARTIAL = Object.freeze(['codebase']);
export function familiesOf(floors = FLOORS, probe = probeFor, read = baseHtmlOf) {
  const out = [];
  for (const f of floors) {
    if (f.lane || !f.page || noShotOf(f) || PINNED.includes(f.id) || PARTIAL.includes(f.id) || f.defer) continue;
    const base = pathOnly(f.page); if (!/^\/[a-z0-9-]+\/$/.test(base)) continue;
    const p = probe(f.id); if (!p || !p.truth || !(p.truth.length) || !(p.facts || []).length) continue;
    if (pathOnly(p.verse) !== base || (p.ask && pathOnly(p.ask.verse) !== base)) continue;
    const html = read(base); if (!html || RELATIVE.test(html)) continue;
    const seo = seoPageOf(base);
    out.push({ id: f.id, label: f.label, base, asks: (seo && seo.asks) || [], pageTail: tailOf(p.verse), askTail: p.ask ? tailOf(p.ask.verse) : null, extra: f.extra || [], does: metaOf(html, 'description') || metaOf(html, 'og:description'), title: (String(html).match(/<title>([^<]*)<\/title>/i) || [, ''])[1].replace(/ · Verse$/, '') });
  }
  return out;
}
const norm = (s) => String(s || '').toLowerCase().replace(/colour/g, 'color');
/** the words that tie a site to a family: its label, its aspects and its page's description, as stems. Pure. */
export const familyWords = (fam) => [...new Set([fam.id, fam.label, ...(fam.extra || []), fam.title].flatMap((x) => keywordsOf(norm(x))))].filter((w) => w.length >= 4);
/** whether a site's text shares a family's words (the model's choice is checked against what the site says). Pure. */
export const sharesWords = (fam, text) => { const t = norm(text); return familyWords(fam).some((w) => new RegExp('(?<![a-z])' + w.slice(0, Math.max(4, Math.min(w.length, 6))).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t)); }; // 'converter' meets 'convert'

// ---- pick ----
/** the next sites to read: the frontier easiest first, never a site that is already a floor, a site blocked by its own wall, or one tried lately
 *  (a site no floor covered is tried again after RETRY_DAYS). Pure. */
export function pickCandidates(frontier, state = {}, { max = MAX_READ, at = Date.now(), floors = FLOORS } = {}) {
  const tried = (state && state.sites) || {}, out = [], ranking = rankingOf({ frontier, floors, state });
  for (const x of frontierOf(frontier, floors)) {
    if (x.blocked || offLimits(x.host, ranking)) continue; // never a gambling or crypto site (tools/versus-ranking.mjs) if (!buildable(badgeOf({ id: x.host, site: x.host, url: 'https://' + x.host + '/' }))) continue; // only Code work, or stage 1 on a regulated site (lib/gate-badge.js)
    const t = tried[x.host];
    if (t && t.outcome !== 'not-judged' && (!['no-family', 'discarded'].includes(t.outcome) || at - Date.parse(t.at || 0) < RETRY_DAYS * 864e5)) continue; // a site the model never judged is read again next run
    out.push({ host: x.host, url: 'https://' + x.host + '/', rank: x.rank, hardness: x.hardness, controls: x.controls, bytes: x.bytes }); if (out.length >= max) break;
  }
  return out;
}

// ---- the row's words ----
const GENERIC = new Set(['www', 'web', 'site', 'online', 'free', 'tool', 'tools', 'app', 'com', 'net', 'org', 'the']);
/** the words of a host that name the site ("anycolorid.com" -> ["anycolorid"]): Verse's pages never carry them. Pure. */
export const brandTokens = (host) => String(host || '').toLowerCase().split('.').slice(0, -1).flatMap((l) => [l, ...l.split('-')]).filter((w) => w.length >= 3 && !GENERIC.has(w));
const DOMAIN = /\b[a-z0-9-]+\.(?:com|org|net|io|co|ai|app|dev|me|fm|de|uk|jp|ru|xyz|info|tv)\b/i;
const SLUG = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
/** the row's words checked and cut to size: { name, h1, intro, does, asks, slug } or a reason they are refused. Every content word of the intro and
 *  of what the page does must stand on the family's page (nothing it does not do), no site is named, no key, no markup. Pure. */
export function validTexts(t, { host, baseText, fam }) {
  const x = t || {}, brands = brandTokens(host), bad = [];
  const out = { name: clip(x.name, 60), h1: clip(x.h1 || x.name, 70), intro: sentences(x.intro, 320), does: sentences(x.does, 320), asks: [...new Set((Array.isArray(x.asks) ? x.asks : []).map((a) => clip(a, 60).toLowerCase()).filter((a) => a.length >= 3))].slice(0, 8), slug: String(x.slug || '').toLowerCase().trim() };
  if (out.name.length < 3 || out.intro.length < 30 || out.does.length < 41 || out.asks.length < 3) bad.push('too short');
  if (fam && out.asks.length < 5) out.asks = [...new Set([...out.asks, ...(fam.asks || [])])].slice(0, 6);
  if (out.asks.length < 5) bad.push('fewer than five asks');
  const all = [out.name, out.h1, out.intro, out.does, out.asks.join(' '), out.slug].join(' '), low = all.toLowerCase(), squash = low.replace(/[^a-z0-9]/g, '');
  if (DOMAIN.test(all)) bad.push('names a site');
  for (const b of brands) if (squash.includes(b)) bad.push('names ' + b);
  if (/[<>{}]|https?:/i.test(all)) bad.push('markup or an address');
  if (/\bbest\b|#1|better than/i.test(all)) bad.push('a claim about other sites');
  if (secretsIn(all).length) bad.push('looks like a key');
  if (out.slug && !SLUG.test(out.slug)) out.slug = '';
  const page = norm(baseText), words = [...new Set((norm(out.intro + ' ' + out.does).match(/[a-z]{5,}/g) || []))].filter((w) => !GENERIC.has(w));
  const stem = (w) => w.replace(/(?:ing|ed|es|s|ly|er)$/, '').slice(0, 6), on = words.filter((w) => page.includes(stem(w)));
  if (words.length && on.length / words.length < 0.7) bad.push('says what the page does not do (' + words.filter((w) => !on.includes(w)).slice(0, 5).join(', ') + ')');
  if (fam && !out.asks.some((a) => sharesWords(fam, a))) bad.push('no ask is about its job');
  return bad.length ? { problem: bad.join('; ') } : out;
}
/** the words a page gets when the model's are refused: its family page's own, so nothing is said that the page does not do. Pure. */
/** text cut to `n` characters at the end of a sentence, never mid-sentence. Pure. */
export const sentences = (t, n) => { const c = clip(t, 2000); if (c.length <= n) return c; const cut = c.slice(0, n), at = cut.lastIndexOf('. '); return at > n / 3 ? cut.slice(0, at + 1) : cut.replace(/[,;:]?\s+\S*$/, '') + '.'; };
export const fallbackTexts = (fam) => ({ name: clip(fam.title || fam.label, 60), h1: clip(fam.title || fam.label, 70), intro: sentences(fam.does, 320), does: sentences(fam.does, 320), asks: (fam.asks || []).slice(0, 6), slug: '' });
/** a free folder under the family's page for the row: the model's slug, else the family's own words, never one taken. Pure. */
export function slugFor(want, fam, taken) {
  const base = SLUG.test(want || '') ? want : (keywordsOf(fam.label).join('-') || 'more').replace(/[^a-z0-9-]/g, '') + '-tool';
  for (let i = 1; i < 50; i++) { const s = i === 1 ? base : base + '-' + i, p = fam.base + s + '/'; if (!taken(p)) return p; }
  return null;
}

// ---- the page ----
const SEO_BLOCKS = /<!-- seo -->[\s\S]*?<!-- \/seo -->\n?|<!-- asks -->[\s\S]*?<!-- \/asks -->\n?/g;
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const setMeta = (html, key, value) => { const re = new RegExp('(<meta\\s+(?:name|property)="' + key + '"\\s+content=")[^"]*(")', 'i'); return re.test(html) ? html.replace(re, (_, a, b) => a + escH(value) + b) : html.replace(/<\/title>/i, '</title>\n<meta ' + (key.startsWith('og:') ? 'property' : 'name') + '="' + key + '" content="' + escH(value) + '">'); };
export const MARK = '<!-- written by tools/tower-self.mjs from lib/self-sites.js and its family page; edit the row, not this file -->';
/** a self-built page: the family's page with the row's title, link-preview words, headline and intro; the family page's search blocks are left out
 *  (tools/seo-pages.mjs writes this page's own). Pure. */
export function variantHtml(base, row) {
  let h = String(base).replace(SEO_BLOCKS, '').replace(/\n?<!-- written by tools\/tower-self\.mjs[^\n]*-->/, '');
  h = h.replace(/<title>[^<]*<\/title>/i, '<title>' + escH(row.name) + ' · Verse</title>');
  for (const [k, v] of [['description', row.does], ['og:title', row.name + ' · Verse'], ['og:description', row.does], ['og:url', ORIGIN + row.path], ['twitter:title', row.name + ' · Verse'], ['twitter:description', row.does]]) h = setMeta(h, k, v);
  h = h.replace(/<h1([^>]*)>[\s\S]*?<\/h1>(\s*<p class="intro"[^>]*>[\s\S]*?<\/p>)?/i, (_, attrs) => '<h1' + attrs + '>' + escH(row.h1) + '</h1>\n  <p class="intro">' + escH(row.intro) + '</p>');
  return h.replace(/^(<!doctype html>)/i, '$1\n' + MARK);
}
/** sw.js with a page added to its offline list (TOOLS), or the same text when it is there already. Pure. */
export function swWith(sw, page) {
  return String(sw).replace(/const TOOLS = \[([^\]]*)\];/, (all, list) => (list.includes("'" + page + "'") ? all : 'const TOOLS = [' + list.replace(/\s*$/, '') + ", '" + page + "'];"));
}
/** lib/self-sites.js for these rows, one row a line. Pure. */
export function rowsModule(rows) {
  const src = fs.existsSync(ROWS) ? fs.readFileSync(ROWS, 'utf8') : '', head = src.slice(0, src.indexOf('export const SELF_SITES')) || '';
  return head + 'export const SELF_SITES = Object.freeze([\n' + rows.map((r) => '  ' + JSON.stringify(r) + ',\n').join('') + ']);\n';
}

// ---- the model ----
const SCHEMA = { name: 'tower_self', schema: { type: 'object', properties: { family: { type: 'string' }, why: { type: 'string' }, slug: { type: 'string' }, name: { type: 'string' }, h1: { type: 'string' }, intro: { type: 'string' }, does: { type: 'string' }, asks: { type: 'array', items: { type: 'string' } } }, required: ['family', 'why', 'slug', 'name', 'h1', 'intro', 'does', 'asks'] } };
/** the model's instructions: the site's own words and Verse's floors, as quoted data. Pure. */
export function messagesOf(site, fams) {
  const pages = (site.pages || []).map((p) => 'PAGE ' + clip(p.title, 120) + '\n' + clip([...(p.headings || []), ...(p.buttons || [])].join(' | ') + '\n' + p.text, 2500)).join('\n\n').slice(0, 6000);
  return [
    { role: 'system', content: 'You are Verse. You are given the visible text of a website and the list of tool pages Verse already has. Pick the ONE Verse page that does the same main job as the website (same kind of tool for the same need), or "none" when no page does: a shop, a company, a game, a forum, a download page or a service Verse has no page for is "none". Then write the words for a new Verse page that does that job for people who used the website: slug (two or three lowercase words joined by hyphens, about the job), name (at most 6 words), h1, intro (one or two sentences), does (one sentence), asks (4 to 6 short things people type into a search box for this job). Describe ONLY what the chosen Verse page does, as its description says; never name the website, its brand or any other site or company. Answer JSON only.' },
    { role: 'user', content: 'Website: ' + site.host + '\n\n' + pages + '\n\nVerse pages (id: what it does):\n' + fams.map((f) => '- ' + f.id + ': ' + clip(f.does || f.label, 240)).join('\n') },
  ];
}
/** the model's answer as an object, or null. Pure. */
export function parseAnswer(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, ''), ok = (j) => j && typeof j === 'object' && !Array.isArray(j) && typeof j.family === 'string';
  try { const j = JSON.parse(s); if (ok(j)) return j; if (j && typeof j.response === 'object' && ok(j.response)) return j.response; if (j && typeof j.response === 'string') return parseAnswer(j.response); } catch (_) {}
  // the object that holds "family", wherever it starts and ends (a model may think aloud around it, or repeat it)
  for (let a = s.indexOf('{'); a >= 0; a = s.indexOf('{', a + 1)) for (let b = s.lastIndexOf('}'); b > a; b = s.lastIndexOf('}', b - 1)) { try { const j = JSON.parse(s.slice(a, b + 1)); if (ok(j)) return j; } catch (_) {} }
  return null;
}
/** one question to Verse's own model: the site's binding through the owner-only /api/tower-self (VOID_OWNER_TOKEN), else the Workers AI REST API
 *  (CLOUDFLARE_API_TOKEN with Workers AI scope); the answer's text, or { error } */
export async function modelText(messages, schema, max = 900) {
  const own = process.env.VOID_OWNER_TOKEN;
  if (own) {
    try {
      const r = await fetch(SITE_API + '/api/tower-self', { method: 'POST', signal: AbortSignal.timeout(90000), headers: { authorization: 'Bearer ' + own, 'content-type': 'application/json', 'user-agent': 'a2m-tower-self/1.0' }, body: JSON.stringify({ messages, schema, max_tokens: max }) });
      if (r.ok) return { text: String(((await r.json()) || {}).text || '') };
      console.log('::warning::Verse\'s model route answered ' + r.status + ': trying the REST API');
    } catch (e) { console.log('::warning::Verse\'s model route did not answer (' + clip(e && e.message || e, 80) + ')'); }
  }
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID, tok = process.env.CLOUDFLARE_API_TOKEN; if (!acct || !tok) return { error: 'no model reachable' };
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/run/' + FREE_MODEL, { method: 'POST', signal: AbortSignal.timeout(90000), headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ messages, max_tokens: max, response_format: { type: 'json_schema', json_schema: schema } }) });
    if (!r.ok) return { error: 'the model answered ' + r.status };
    const j = await r.json(), x = (j && j.result) || {};
    return { text: typeof x.response === 'string' ? x.response : x.response ? JSON.stringify(x.response) : String((x.choices && x.choices[0] && x.choices[0].message && x.choices[0].message.content) || '') };
  } catch (e) { return { error: 'the model did not answer (' + clip(e && e.message || e, 80) + ')' }; }
}
async function askModel(messages) { const r = await modelText(messages, SCHEMA, 1400); if (r.error) return r; const j = parseAnswer(r.text); if (!j) console.log('  the model said (not the JSON asked for): ' + clip(r.text, 300)); return j || { error: 'the answer was not JSON' + (r.text ? '' : ' (empty)') }; }
const FEATURES_SCHEMA = { name: 'features', schema: { type: 'object', properties: { features: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, detail: { type: 'string' }, paid: { type: 'boolean' } }, required: ['name', 'detail', 'paid'] } } }, required: ['features'] } };
/** feature-scan's feature list, asked of Verse's own model (its messages and its parser) */
async function featuresByModel(host, pages) { const { messagesOf: fm, parseModelFeatures } = await import('./feature-scan.mjs'); const r = await modelText(fm(host, pages), FEATURES_SCHEMA, 2000); return r.error ? null : parseModelFeatures(r.text); }

// ---- state ----
export const readState = () => readJson(STATE, { note: 'tools/tower-self.mjs: every site Verse took on by itself, what came of it, and one line per run. Written by the loop.', sites: {}, runs: [] });
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1) + '\n');
/** pages built in the last day, from the rows. Pure. */
export const pagesPerDay = (rows, at = Date.now()) => (rows || []).filter((r) => r.added && at - Date.parse(r.added) <= 864e5).length;

// ---- build: read, classify, research ----
async function build(planFile, outFile, maxBuilt) {
  const plan = readJson(planFile, []), fams = familiesOf(), taken = new Set([...SELF_SITES.map((r) => r.path)]), decision = { at: now(), rows: [], features: {}, state: {}, jobs: [] };
  const exists = (p) => taken.has(p) || fs.existsSync(path.join(SITE_DIR, p));
  if (!plan.length) { fs.writeFileSync(outFile, JSON.stringify(decision)); console.log('nothing to take on'); return; }
  const { scanSite, scanFloor, floorsOf } = await import('./feature-scan.mjs'), floorList = floorsOf();
  const { chromium } = await import('playwright-core'); const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const c of plan) {
      if (decision.rows.length >= maxBuilt) break;
      const r = await scanSite(b, c.url).catch((e) => ({ problem: 'not read (' + clip(e && e.message || e, 80) + ')', pages: [] }));
      if (r.problem || !r.pages.length) { decision.state[c.host] = { at: now(), outcome: /parked|did not load|answered [45]\d\d|no page read/.test(r.problem || 'no page read') ? 'gone' : 'walled', why: clip(r.problem || 'no page read', 160) }; console.log(c.host + ': ' + decision.state[c.host].why); continue; }
      const site = { host: c.host, pages: r.pages }, siteText = r.pages.map((p) => p.title + ' ' + (p.headings || []).join(' ') + ' ' + p.text).join(' ');
      const a = await askModel(messagesOf(site, fams));
      if (a.error) { decision.state[c.host] = { at: now(), outcome: 'not-judged', why: a.error }; console.log(c.host + ': ' + a.error); continue; }
      const fam = fams.find((f) => f.id === String(a.family || '').trim().toLowerCase());
      if (!fam || !sharesWords(fam, siteText)) {
        const why = !fam ? 'no floor does its job (' + clip(a.why, 140) + ')' : 'the model chose ' + fam.id + ' but the site says none of its words';
        decision.state[c.host] = { at: now(), outcome: 'no-family', why: clip(why, 200), title: clip(r.pages[0].title, 80) };
        decision.jobs.push({ target: ('versus:' + c.host).slice(0, 40), ask: clip('Versus: ' + c.host + ' (' + clip(r.pages[0].title, 60) + ') needs a page no floor has yet: ' + clip(a.why, 90), 200) });
        console.log(c.host + ': ' + why); continue;
      }
      const baseText = textOf(baseHtmlOf(fam.base)) + ' ' + fam.does;
      let t = validTexts(a, { host: c.host, baseText, fam }), refused = '';
      if (t.problem) { refused = t.problem; const fb = fallbackTexts(fam), mine = (a.asks || []).map((x) => clip(x, 60).toLowerCase()).filter((x) => x.length >= 3 && sharesWords(fam, x) && !brandTokens(c.host).some((bt) => x.replace(/[^a-z0-9]/g, '').includes(bt)) && !DOMAIN.test(x) && !/\bbest\b|#1|better than/.test(x)); t = { ...fb, slug: SLUG.test(String(a.slug || '')) && !brandTokens(c.host).some((bt) => String(a.slug).replace(/-/g, '').includes(bt)) ? String(a.slug) : '', asks: [...new Set([...mine, ...fb.asks])].slice(0, 6) }; }
      const p = slugFor(t.slug, fam, exists); if (!p) { decision.state[c.host] = { at: now(), outcome: 'discarded', why: 'no free folder under ' + fam.base }; continue; }
      taken.add(p);
      const lane = fam.id + ': ' + hostOf(c.url);
      const row = { path: p, base: fam.base, page: p + fam.pageTail, ...(fam.askTail !== null ? { ask: p + fam.askTail } : {}), family: fam.id, lane, url: c.url, name: t.name, h1: t.h1, intro: t.intro, does: t.does, asks: t.asks, added: now() };
      // the site's features, read by feature-scan's own code from the pages already read, marked against the family's page
      const floor = floorList.find((f) => f.id === fam.id);
      if (floor) { try { const res = await scanFloor(b, floor, [{ url: c.url, host: hostOf(c.url) }], { calls: 1, read: async () => r, model: featuresByModel }); decision.features[floor.slug] = { floor: { id: floor.id, slug: floor.slug, page: floor.page }, sites: { ...((decision.features[floor.slug] || {}).sites || {}), ...res.sites } }; } catch (e) { console.log('::warning::features of ' + c.host + ' not read: ' + clip(e && e.message || e, 80)); } }
      decision.rows.push(row); decision.state[c.host] = { at: now(), outcome: 'built', family: fam.id, id: lane, page: row.page, ...(refused ? { words: 'the family page\'s own (the model\'s were refused: ' + clip(refused, 120) + ')' } : {}) };
      console.log(c.host + ': joins ' + fam.id + ' at ' + row.page + (refused ? ' (its own words refused: ' + refused + ')' : ''));
    }
  } finally { await b.close(); }
  fs.writeFileSync(outFile, JSON.stringify(decision, null, 1));
}

// ---- apply: the decision onto the tree ----
export function writePages(rows = SELF_SITES) {
  const done = [];
  for (const r of rows) { const base = baseHtmlOf(r.base); if (!base) continue; const file = path.join(SITE_DIR, r.path, 'index.html'), want = variantHtml(base, r); const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (have !== null && have.replace(SEO_BLOCKS, '') === want.replace(SEO_BLOCKS, '')) continue; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, want); done.push(r.path); }
  return done;
}
async function apply(decisionFile) {
  const d = readJson(decisionFile, null); if (!d) { console.error('no decision'); process.exit(2); }
  const have = new Set(SELF_SITES.map((r) => r.lane)), rows = [...SELF_SITES, ...(d.rows || []).filter((r) => !have.has(r.lane))].map((r) => ({ ...r, intro: sentences(r.intro, 320), does: sentences(r.does, 320) }));
  fs.writeFileSync(ROWS, rowsModule(rows));
  const wrote = writePages(rows); let sw = fs.readFileSync(SW, 'utf8'); for (const r of rows) sw = swWith(sw, r.path); fs.writeFileSync(SW, sw);
  if (Object.keys(d.features || {}).length) {
    const { mergeAuto, readAll, DIR } = await import('./feature-scan.mjs'), files = readAll();
    for (const [slug, v] of Object.entries(d.features)) { const next = mergeAuto(files[slug] || null, v.floor, v.sites); fs.writeFileSync(path.join(DIR, slug + '.json'), JSON.stringify(next, null, 1) + '\n'); }
  }
  const st = readState(); st.sites = { ...st.sites, ...(d.state || {}) }; writeState(st);
  console.log(rows.length + ' self-built sites, pages written: ' + (wrote.join(', ') || 'none'));
}

// ---- judge: the gate's rows, fixes, jobs, the report ----
/** what to do about one floor's rows: { n, m, beaten, fixes: [aspect], jobs: [{ aspect, evidence }] }. A mechanical fix is one whose template is
 *  known: offline (the page into sw.js TOOLS) and sharing (the page's own link-preview tags, rewritten by writePages). A default-bar row (the site
 *  turned the gate away, lib/tower.js barRow) is not a measure of the site: never a fix, only a job to measure it. Pure. */
export function judgeRows(floor, ev, sw = '') {
  const g = gate(floor, ev || {}), fixes = [], jobs = [];
  for (const a of g.left) {
    const r = (ev || {})[a];
    if (barRow(r)) { jobs.push({ aspect: a, evidence: 'not measured yet: ' + (hostOf(floor.url) || floor.site) + ' turned the gate away, so only the default bar was scored' }); continue; }
    if (a === 'offline' && floor.page && !String(sw).includes("'" + pathOnly(floor.page) + "'")) fixes.push(a);
    else if (a === 'sharing' && r && r.verdict === 'worse' && floor.page) fixes.push(a);
    else jobs.push({ aspect: a, evidence: r ? r.verdict + ': ' + clip(r.evidence, 150) : 'not measured yet' });
  }
  return { n: g.n, m: g.m, beaten: g.beaten, fixes, jobs };
}
export const reportLine = (took, next, other = {}) => 'Versus: took on ' + (took.length ? took.map((t) => t.host + ' (' + t.family + ', ' + t.page + '), surpassed ' + t.n + ' of ' + t.m + ' rows' + (t.beaten ? ', beaten' : '')).join('; ') : 'no site') + (Object.keys(other).length ? ' (also read: ' + Object.entries(other).map(([k, v]) => v + ' ' + k).join(', ') + ')' : '') + '; next ' + (next || 'the next site the scan finds');
async function queueJobs(jobs) {
  const tok = process.env.VOID_OWNER_TOKEN, H = { authorization: 'Bearer ' + tok, 'content-type': 'application/json', 'user-agent': 'a2m-tower-self/1.0' };
  if (!tok) { for (const j of jobs) console.log('would queue ' + j.target + ': ' + j.ask); return 0; }
  let open = 0; try { const v = await (await fetch(SITE_API + '/api/queue', { headers: H, signal: AbortSignal.timeout(20000) })).json(); open = (v.items || []).filter((i) => /^versus:/.test(i.target) && /^(queued|building)$/.test(i.state)).length; } catch (_) {}
  let n = 0;
  for (const j of jobs) { if (open + n >= MAX_OPEN_JOBS) { console.log('versus jobs open: ' + (open + n) + ', the rest wait'); break; }
    try { const r = await fetch(SITE_API + '/api/queue', { method: 'POST', headers: H, body: JSON.stringify(j), signal: AbortSignal.timeout(20000) }); if (r.ok) { n++; console.log('queued ' + j.target + ': ' + j.ask); } else console.log('::warning::the queue answered ' + r.status); } catch (e) { console.log('::warning::not queued: ' + clip(e && e.message || e, 80)); } }
  return n;
}
async function judge(idsFile, { queue = false, decisionFile = null } = {}) {
  const ids = fs.existsSync(idsFile) ? fs.readFileSync(idsFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const ev = (readJson(path.join(SITE_DIR, 'tower.evidence.json'), {}).floors) || {}, sw = fs.readFileSync(SW, 'utf8'), st = readState(), took = [], jobs = [], fixed = [];
  for (const id of ids) {
    const f = FLOORS.find((x) => x.id === id); if (!f) continue;
    const j = judgeRows(f, ev[id], sw), host = hostOf(f.url);
    took.push({ host, family: f.lane, page: f.page, n: j.n, m: j.m, beaten: j.beaten });
    if (j.fixes.length) fixed.push({ id, fixes: j.fixes });
    for (const x of j.jobs) jobs.push({ target: ('versus:' + host + ':' + x.aspect).slice(0, 40), ask: clip('Versus ' + id + ', ' + x.aspect + ': ' + x.evidence, 200) });
    st.sites[host] = { ...(st.sites[host] || {}), rows: j.n + '/' + j.m, ...(j.beaten ? { outcome: 'surpassed' } : {}), gated: now() };
  }
  const d = decisionFile ? readJson(decisionFile, {}) : {};
  jobs.push(...((d && d.jobs) || []));
  // a versus job only for a site of the smallest-first ranking that is not a gambling or crypto site (#1470): the scan's own words of this run count
  const ranking = rankingOf({ frontier: readJson(path.join(SITE_DIR, 'tower.frontier.json'), null), floors: FLOORS, state: { sites: { ...st.sites, ...((d && d.state) || {}) } } });
  const allowed = jobs.filter((j) => { const v = versusAllowed(j.target, ranking); if (!v.ok) console.log('not queued ' + j.target + ': ' + v.why); return v.ok; });
  const queued = queue && allowed.length ? await queueJobs(allowed) : 0;
  // the mechanical fixes: the offline list and the pages' own tags (writePages rewrites them from the rows; swWith adds a missing page)
  let swNext = sw; for (const r of SELF_SITES) swNext = swWith(swNext, r.path); if (swNext !== sw) fs.writeFileSync(SW, swNext); const rewrote = writePages();
  const next = pickCandidates(readJson(path.join(SITE_DIR, 'tower.frontier.json'), null), st, { max: 1 })[0];
  const other = {}; for (const v of Object.values((d && d.state) || {})) if (v.outcome !== 'built') other[v.outcome] = (other[v.outcome] || 0) + 1;
  const line = reportLine(took, next && next.host, other);
  st.runs = [...(st.runs || []), { at: now(), line, built: ((d && d.rows) || []).length, queued, fixed: fixed.map((x) => x.id + ': ' + x.fixes.join(', ')), pages_per_day: pagesPerDay(SELF_SITES) }].slice(-40);
  writeState(st);
  console.log(line); if (fixed.length) console.log('fixed: ' + fixed.map((x) => x.id + ' (' + x.fixes.join(', ') + ')').join('; ') + (rewrote.length ? '; pages rewritten: ' + rewrote.join(', ') : ''));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'line=' + line.replace(/\n/g, ' ') + '\nfixed=' + (fixed.length || swNext !== sw || rewrote.length ? 'yes' : '') + '\n');
  return { line, fixed };
}

// ---- the page guard: a frontier site at the front of the queue has a page ----
export const FRONT = 5;
/** the frontier sites (no page, no data row) among the first `front` unbeaten sites of the tower. Pure. */
export function guardOf(evidence = {}, frontier = null, front = FRONT) {
  const t = tower([], evidence, frontier), ids = new Set(FLOORS.map((f) => f.id));
  return t.floors.filter((f) => !f.beaten).slice(0, front).filter((f) => !ids.has(f.id) || !f.page).filter((f) => !ids.has(f.id)).map((f) => f.id);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), cmd = argv[0], opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const frontier = readJson(path.join(SITE_DIR, 'tower.frontier.json'), null);
  if (cmd === 'plan') {
    const site = opt('--site'), max = Number(opt('--max')) || MAX_READ;
    const list = site ? site.split(',').map((h) => hostOf(h)).filter(Boolean).filter((h) => !FLOORS.some((f) => hostOf(f.url) === h)).map((h) => ({ host: h, url: 'https://' + h + '/' })) : pickCandidates(frontier, readState(), { max });
    const out = JSON.stringify(list, null, 1); if (opt('--out')) fs.writeFileSync(opt('--out'), out); console.log(list.map((x) => x.host).join(', ') || 'nothing to take on');
  } else if (cmd === 'build') await build(argv[1], argv[2], Number(opt('--built')) || MAX_BUILT);
  else if (cmd === 'apply') await apply(argv[1]);
  else if (cmd === 'paths') console.log(SELF_SITES.map((r) => 'void-live-deploy' + r.path.replace(/\/$/, '')).join('\n'));
  else if (cmd === 'discard') { const d = readJson(argv[1], {}), why = clip(argv[2] || 'a check failed', 160); for (const r of d.rows || []) d.state[hostOf(r.url)] = { at: now(), outcome: 'discarded', family: r.family, why }; d.rows = []; d.features = {}; fs.writeFileSync(argv[1], JSON.stringify(d, null, 1)); console.log('discarded: ' + why); }
  else if (cmd === 'pages') console.log('pages written: ' + (writePages().join(', ') || 'none'));
  else if (cmd === 'ids') { const d = argv[1] ? readJson(argv[1], {}) : null, ev = (readJson(path.join(SITE_DIR, 'tower.evidence.json'), {}).floors) || {};
    const ids = d && d.rows ? d.rows.map((r) => r.lane) : SELF_SITES.map((r) => r.lane).filter((id) => { const f = FLOORS.find((x) => x.id === id); return f && !gate(f, ev[id] || {}).beaten; });
    console.log(ids.join('\n')); }
  else if (cmd === 'judge') await judge(argv[1], { queue: argv.includes('--queue'), decisionFile: opt('--decision') || null });
  else if (cmd === 'guard') { const flagged = guardOf((readJson(path.join(SITE_DIR, 'tower.evidence.json'), {}).floors) || {}, frontier); if (flagged.length) { console.error('frontier sites at the front of the Versus queue with no page of their own: ' + flagged.join(', ') + ' (node tools/tower-self.mjs plan --site <host>, or the tower-self workflow)'); process.exit(1); } console.log('the front of the Versus queue has its pages (' + FRONT + ' looked at)'); }
  else if (cmd === 'status') { const st = readState(), c = {}; for (const s of Object.values(st.sites || {})) c[s.outcome || '?'] = (c[s.outcome || '?'] || 0) + 1;
    console.log('self-built pages: ' + SELF_SITES.length + ', in the last day: ' + pagesPerDay(SELF_SITES) + '; outcomes: ' + JSON.stringify(c) + '; frontier left: ' + frontierOf(frontier).length); for (const r of (st.runs || []).slice(-5)) console.log(r.at + ' ' + r.line); }
  else { console.error('usage: tower-self.mjs plan|build|apply|pages|ids|judge|guard|status (see the header)'); process.exit(2); }
}
