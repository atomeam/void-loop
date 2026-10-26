// Feature research by Verse itself (owner, 2026-10-25: "make sure you research all features of every site so we have everything", then "ok make it
// so verse does this on its own automatically also"). For a Versus floor (void-live-deploy/lib/tower.js) and each of its lane sites, at each site's
// OWN address (tools/tower-gate.mjs siteOf): the home page and up to six same-site pages whose links say features, help, FAQ, pricing, about or how,
// read at phone width as an ordinary Chrome, one site at a time, robots.txt respected, nothing saved but the list. Their visible text becomes a
// feature list (Workers AI with a strict JSON prompt while the run's call budget lasts, else headings, list items, buttons and pricing rows), and each
// feature is marked against Verse's own page for the floor (has, partial, missing, with the words found as evidence; tower-probes.mjs showsFeature).
// The result goes into domains/features/<floor slug>.json: under "auto" in a file people researched by hand (their sections are never touched), or
// as the whole file with "source": "auto" for a floor that had none. Missing features become build jobs on Verse's queue (/api/queue), the lowest
// unbeaten floor first, each feature once ever (auto.queued), three a run, never more than three open. The gate counts what Verse has
// (tower-probes.mjs withFeatureFacts). Playbook: docs/playbooks/feature-research.md. Workflow: .github/workflows/feature-scan.yml.
//   node tools/feature-scan.mjs "<floor id>"       one floor: its leader and every lane site
//   node tools/feature-scan.mjs --missing          floors with no file, and lane sites their floor's file lacks (lowest unbeaten floor first)
//   node tools/feature-scan.mjs --stale 30         files last researched or scanned 30 days ago or more, oldest first (--max-floors, default 2)
//   options: --max-sites N (30) --max-calls N (FEATURE_SCAN_MAX_CALLS or 12; 0 = heuristic only) --list (print the sites, load nothing)
//            --out mine.json (this run's auto blocks, for --put) --queue (then queue the gaps) --jobs N (3) --dry (write and post nothing)
//   node tools/feature-scan.mjs --queue            only queue gaps from the files as they stand (VOID_OWNER_TOKEN; without it, prints them)
//   node tools/feature-scan.mjs --put mine.json    folds a run's auto blocks into the files as they stand now (the workflow's landing, like gate-land.mjs)
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for the model (Workers AI run), CHROME_PATH for the browser, VERSE_URL to read another Verse.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import { FLOORS, tower, hostOf } from '../void-live-deploy/lib/tower.js';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';
import { probeFor, showsFeature, featureSlug } from './tower-probes.mjs';
import { siteOf, UA } from './tower-gate.mjs';
import { secretsIn } from './secret-scan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = path.join(root, 'domains', 'features');
const VERSE = process.env.VERSE_URL || 'https://a-to-mind.com/';
const SITE = (process.env.VERSE_SITE || 'https://a-to-mind.com').replace(/\/+$/, '');
export const OPEN_MAX = 3; // open feature jobs at once, as lib/learn.js keeps miss jobs
const today = () => new Date().toISOString().slice(0, 10);
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

// ---- which floors and sites ----
/** the floors that own a features file (the hand-named ones; a lane site is filed under its lane's floor), each with its sites: the leader at the
 *  address the gate measures it at, then every lane site at its own. Pure. */
export function floorsOf(floors = FLOORS, probe = probeFor) {
  return floors.filter((f) => !f.lane).map((f) => {
    const lead = siteOf(f, probe(f.id)), lanes = floors.filter((x) => x.lane === f.id).map((x) => ({ id: x.id, url: x.url, host: hostOf(x.url) }));
    const p = probe(f.id);
    return { id: f.id, slug: featureSlug(f.id), page: (p && p.verse) || f.page || null, ask: f.ask, sites: [{ id: f.id, url: lead, host: hostOf(lead) || hostOf(f.url), leader: true }, ...lanes] };
  });
}
/** the hosts a file already covers, by hand or by the scan. Pure. */
export const coveredOf = (file) => new Set([...Object.keys((file && file.sites) || {}), ...Object.keys((file && file.auto && file.auto.sites) || {})].map((h) => hostOf(h) || h));
/** the newest date a file was researched or scanned (ms), or 0. Pure. */
export const freshOf = (file) => Math.max(0, ...[file && file.researched, file && file.auto && file.auto.scanned].map((d) => Date.parse(d || '')).filter(Number.isFinite));
/** what a run scans: [{ floor, sites }] for `--missing` (no file: every site; a file: the sites it lacks) and/or `--stale days` (whole floors whose
 *  file is that old, oldest first, at most maxFloors), in the tower's queue order (the lowest unbeaten floor first), at most maxSites sites. Pure. */
export function planOf({ floors, files, order = [], missing = false, stale = null, now = Date.now(), maxFloors = 2, maxSites = 30, only = null }) {
  const rank = new Map(order.map((id, i) => [id, i])), at = (f) => Math.min(...[f.id, ...f.sites.map((s) => s.id)].map((id) => (rank.has(id) ? rank.get(id) : 1e9)));
  const byOrder = [...floors].sort((a, b) => at(a) - at(b)), plan = [];
  if (only) { const f = floors.find((x) => x.id === only); if (f) plan.push({ floor: f, sites: f.sites }); }
  if (missing) for (const f of byOrder) { const file = files[f.slug], have = coveredOf(file), sites = file ? f.sites.filter((s) => !have.has(s.host)) : f.sites; if (sites.length) plan.push({ floor: f, sites }); }
  if (stale !== null) {
    const old = byOrder.filter((f) => files[f.slug] && now - freshOf(files[f.slug]) >= stale * 86400000 && !plan.some((p) => p.floor.id === f.id));
    old.sort((a, b) => freshOf(files[a.slug]) - freshOf(files[b.slug])); for (const f of old.slice(0, maxFloors)) plan.push({ floor: f, sites: f.sites });
  }
  let left = maxSites; const out = [];
  for (const p of plan) { if (left <= 0) break; const sites = p.sites.slice(0, left); left -= sites.length; out.push({ ...p, sites }); }
  return out;
}

// ---- reading a site ----
const LINK_WORDS = [['features?', 5], ['pricing|prices?|plans?|premium|upgrade', 4], ['how[- ]?(?:it|to)|how-it-works|tour|guide|tutorial', 4], ['faq|questions', 3], ['help|support|docs?|documentation', 2], ['about', 1]];
const LINK_SKIP = /\b(?:log ?in|sign ?(?:in|up)|register|account|cart|checkout|privacy|terms|cookie|legal|careers?|jobs|press|blog\/\d|contact)\b/i;
/** up to `max` same-site pages worth reading from a page's links ({ href, text }): the ones whose words say features, pricing, how it works, FAQ,
 *  help or about, best first, no sign-in, legal or file links, no repeats, never the page itself. Pure. */
export function pickLinks(base, links, max = 6) {
  let b; try { b = new URL(base); } catch (_) { return []; }
  const host = hostOf(b.href), seen = new Set([b.origin + b.pathname.replace(/\/$/, '')]), scored = [];
  for (const l of links || []) {
    let u; try { u = new URL(l && l.href, b); } catch (_) { continue; }
    if (!/^https?:$/.test(u.protocol) || hostOf(u.href) !== host || /\.(?:pdf|zip|png|jpe?g|gif|svg|webp|mp4|mp3|dmg|exe|apk)$/i.test(u.pathname)) continue;
    const key = u.origin + u.pathname.replace(/\/$/, ''); if (seen.has(key)) continue;
    const words = (String((l && l.text) || '') + ' ' + decodeURIComponent(u.pathname).replace(/[-_/]+/g, ' ')).toLowerCase();
    if (LINK_SKIP.test(words)) continue;
    const score = LINK_WORDS.reduce((m, [re, w]) => (new RegExp('\\b(?:' + re + ')\\b').test(words) ? Math.max(m, w) : m), 0);
    if (!score) continue; seen.add(key); u.hash = ''; scored.push({ href: u.href, score, i: scored.length });
  }
  return scored.sort((x, y) => y.score - x.score || x.i - y.i).slice(0, max).map((x) => x.href);
}
/** robots.txt read for every robot ('*'): whether a path may be fetched (the longest matching rule wins, Allow on a tie, '*' and '$' honoured). Pure. */
export function robotsAllows(txt, p = '/') {
  let on = false, any = false; const rules = [];
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(), m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (any) { on = false; any = false; } on = on || v === '*'; continue; }
    if (k === 'allow' || k === 'disallow') { any = true; if (on && v) rules.push({ allow: k === 'allow', v }); }
  }
  let best = null;
  for (const r of rules) {
    const end = r.v.endsWith('$'), re = new RegExp('^' + (end ? r.v.slice(0, -1) : r.v).split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (end ? '$' : ''));
    if (re.test(p) && (!best || r.v.length > best.v.length || (r.v.length === best.v.length && r.allow))) best = r;
  }
  return !best || best.allow;
}
/** what is wrong with a page as a source of features, or null: a parked domain, a sign-in wall, a near-empty stub (a bare domain that only
 *  redirects, quillpad.in without www). A page that went to another site is noted, not refused. Pure. */
export function pageProblem(page, home = true) {
  const text = String((page && page.text) || ''), n = text.replace(/\s+/g, ' ').trim().length;
  if (/\b(?:this domain (?:name )?(?:is|may be) for sale|buy this domain|domain (?:is )?parked|parked (?:free|domain)|hugedomains|sedo domain parking)\b/i.test(text)) return 'a parked domain';
  if (n < (home ? 120 : 40)) return 'a nearly empty page (' + n + ' characters: a redirect stub, or a page that draws itself with no text)';
  if (n < 700 && /\b(?:sign in|log in|login|sign up)\b/i.test(text) && ((page.headings || []).length + (page.items || []).length) < 6) return 'a sign-in wall';
  return null;
}

// ---- features from what a page shows ----
const JUNK = /^(?:home|menu|close|open|ok|yes|no|next|previous|prev|back|more|less|show more|read more|learn more|see more|view all|see all|get started|start now|try (?:it )?(?:now|free)|search|go|submit|share|subscribe|download(?: the)? app|skip to (?:main )?content|log ?in|log ?out|sign ?(?:in|up|out)|register|create (?:an )?account|accept(?: all)?(?: cookies)?|reject(?: all)?|cookie.*|privacy.*|terms.*|contact(?: us)?|about(?: us)?|faq|help|support|blog|news|careers?|pricing|plans?|our plans|compare plans|features|frequently asked questions|english|language|©.*|copyright.*|all rights reserved.*|follow us.*|\d+)$/i;
/** a short name from a heading, list item, button or row, or '' when it is not one (too short or long, a sentence, navigation, a question). Pure. */
export function nameOf(s) {
  const t = clip(s, 200).replace(/^[\s•·\-–—*✓✔→►▸>]+/, '').replace(/[\s:;,.!]+$/, '');
  if (t.length < 3 || t.length > 70 || t.split(/\s+/).length > 10 || !/[a-z]/i.test(t) || /\?$/.test(t) || JUNK.test(t) || /^[$€£¥]?\s*[\d.,]+\s*(?:\/\s*\w+|per \w+)?$/i.test(t)) return '';
  return t;
}
/** a feature list from a site's pages ({ url, headings, items, buttons, rows, pricing }) when no model reads them: headings first, then list items,
 *  then buttons of two words or more, then pricing rows (paid when the row names a price or a paid plan), no repeats, at most 40. Pure. */
export function heuristicFeatures(pages) {
  const out = [], seen = new Set();
  const where = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch (_) { return clip(u, 120); } };
  const add = (raw, from, url, paid) => { const name = nameOf(raw); if (!name || (from === 'a button' && !/\s/.test(name))) return; const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ''); if (!key || seen.has(key) || out.length >= 40) return; seen.add(key); out.push({ name, detail: from + ' on ' + where(url), paid: !!paid }); };
  const PAID = /[$€£¥]\s*\d|\b(?:pro|premium|plus|paid|business|enterprise|per month|\/mo|a month|subscription)\b/i;
  for (const kind of ['headings', 'items', 'buttons', 'rows']) for (const p of pages || []) for (const raw of (p && p[kind]) || []) {
    const from = { headings: 'a heading', items: 'a list item', buttons: 'a button', rows: 'a pricing row' }[kind];
    add(kind === 'rows' ? String(raw).split(/\t|\s{2,}/)[0] : raw, from, p.url, (p.pricing || kind === 'rows') && PAID.test(String(raw)));
  }
  return out;
}
/** the model's instructions and the pages' text for one site (each page at most 3000 characters, all of them at most 12000). Pure. */
export function messagesOf(host, pages) {
  let left = 12000; const parts = [];
  for (const p of pages || []) { const t = clip(p.text, Math.min(3000, left)); if (!t) continue; left -= t.length; parts.push('PAGE ' + p.url + '\n' + t); if (left <= 0) break; }
  return [
    { role: 'system', content: 'You list the user-facing features of a website from the visible text of its own pages. A feature is something a person can do or get on the site (a tool, an option, an export, a setting, a plan limit), named in two to six plain words. Leave out navigation, legal text, company news, testimonials and anything the text does not say. Answer with JSON only, exactly {"features":[{"name":"...","detail":"one sentence from the text","paid":false}]}, at most 30 features, paid true only when the text ties the feature to a paid plan.' },
    { role: 'user', content: 'Site: ' + host + '\n\n' + parts.join('\n\n') },
  ];
}
/** the features in a model's answer, checked and cut to size, or null when the answer is not the JSON asked for. Pure. */
export function parseModelFeatures(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null;
  let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch (_) { return null; }
  const list = Array.isArray(j) ? j : j && Array.isArray(j.features) ? j.features : null; if (!list) return null;
  const out = [], seen = new Set();
  for (const f of list) { const name = clip(f && f.name, 80), key = name.toLowerCase().replace(/[^a-z0-9]+/g, ''); if (name.length < 2 || !key || seen.has(key)) continue; seen.add(key); out.push({ name, detail: clip(f.detail, 200), paid: f.paid === true }); if (out.length >= 30) break; }
  return out.length ? out : null;
}
const SCHEMA = { name: 'features', schema: { type: 'object', properties: { features: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, detail: { type: 'string' }, paid: { type: 'boolean' } }, required: ['name', 'detail', 'paid'] } } }, required: ['features'] } };
/** one Workers AI call for a site's features, or null (no credentials, an error, an answer that is not the JSON asked for) */
async function modelFeatures(host, pages) {
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID, tok = process.env.CLOUDFLARE_API_TOKEN; if (!acct || !tok) return null;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + acct + '/ai/run/' + FREE_MODEL, { method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ messages: messagesOf(host, pages), max_tokens: 2000, response_format: { type: 'json_schema', json_schema: SCHEMA } }) });
    if (!r.ok) { console.log('::warning::the model answered ' + r.status + ' for ' + host + ': the heuristic reads it'); return null; }
    const j = await r.json(), x = (j && j.result) || {}, text = typeof x.response === 'string' ? x.response : x.response ? JSON.stringify(x.response) : String((x.choices && x.choices[0] && x.choices[0].message && x.choices[0].message.content) || '');
    return parseModelFeatures(text);
  } catch (e) { console.log('::warning::the model did not answer for ' + host + ' (' + (e && e.message || e) + ')'); return null; }
}
/** features compared with Verse's page text: each marked has, partial or missing with the words found; '' text (Verse not read) leaves them
 *  unchecked. Anything that looks like a key or token is dropped (tools/secret-scan.mjs): the file is public. Pure. */
export function compare(features, verseText, page) {
  return (features || []).filter((f) => !secretsIn(f.name + ' ' + f.detail).length).map((f) => {
    if (!verseText) return { ...f, verse: 'unchecked', verse_evidence: 'Verse\'s page was not read' };
    const m = showsFeature(f, verseText);
    return { ...f, verse: m.verse, verse_evidence: (page || 'Verse\'s page') + (m.found.length ? ' shows "' + m.found.join('", "') + '"' : ' shows none of its words') + (m.lacking.length ? '; not "' + m.lacking.join('", "') + '"' : '') };
  });
}
/** the missing features across a floor's sites, most sites first, then in the order found: [{ name, sites }]. Pure. */
export function gapsOf(sites) {
  const m = new Map();
  for (const [host, s] of Object.entries(sites || {})) for (const f of (s && s.features) || []) if (f.verse === 'missing') { const k = f.name.toLowerCase(); if (!m.has(k)) m.set(k, { name: f.name, sites: [] }); if (!m.get(k).sites.includes(host)) m.get(k).sites.push(host); }
  return [...m.values()].sort((a, b) => b.sites.length - a.sites.length);
}

// ---- the file ----
/** a scan folded into a floor's file: a file people wrote keeps every section of theirs and gets the scan under "auto" (its sites added to or
 *  replaced by host, its gaps recomputed, what was queued kept); a file the scan wrote itself ("source": "auto") is the scan's to rewrite; no file
 *  becomes a whole file with "source": "auto". The inputs are not changed. Pure. */
export function mergeAuto(file, floor, scanned, date = today()) {
  const own = !file || file.source === 'auto';
  if (own) {
    const sites = { ...((file && file.sites) || {}), ...scanned };
    return { floor: floor.id, verse_page: floor.page, researched: date, source: 'auto', method: 'tools/feature-scan.mjs: each site\'s own pages read at phone width; features by the model or the page\'s headings, lists, buttons and pricing rows; Verse\'s page matched by key words (a builder should confirm on the live site)', sites, gaps: gapsOf(sites), verse_extra: (file && file.verse_extra) || [], auto: { scanned: date, queued: (file && file.auto && file.auto.queued) || [] }, ...(file && file.re ? { re: file.re } : {}) };
  }
  const prev = file.auto || {}, sites = { ...(prev.sites || {}), ...scanned };
  return { ...file, auto: { ...prev, scanned: date, sites, gaps: gapsOf(sites), queued: prev.queued || [] } };
}
const later = (x, y) => (String(y || '') > String(x || '') ? y : x || y);
/** two sets of site entries as one: per host the newer scan, `b` on a tie. Pure. */
const newerSites = (a, b) => { const out = { ...(a || {}) }; for (const [h, s] of Object.entries(b || {})) if (!out[h] || String((s && s.scanned) || '') >= String(out[h].scanned || '')) out[h] = s; return out; };
const queuedOf = (...lists) => [...new Map(lists.flat().filter(Boolean).map((q) => [q.target, q])).values()];
/** a run's result for one file (`{ file }` for a file the scan owns, `{ auto }` for people's file) folded into the file as it stands now on main:
 *  per site the newer scan, every job ever queued kept, and people's sections untouched (a file people wrote meanwhile takes the run's sites
 *  under "auto"). Pure. */
export function putMine(current, mine) {
  if (!mine) return current;
  const m = mine.file || null, ma = m && m.source === 'auto' ? { ...(m.auto || {}), sites: m.sites } : mine.auto || (m && m.auto) || null;
  if (!current) return m;
  if (current.source === 'auto' && m && m.source === 'auto') {
    const sites = newerSites(current.sites, m.sites);
    return { ...current, ...m, researched: later(current.researched, m.researched), sites, ...(current.re ? { re: current.re } : {}), gaps: gapsOf(sites), auto: { ...(current.auto || {}), ...(m.auto || {}), scanned: later(current.auto && current.auto.scanned, m.auto && m.auto.scanned), queued: queuedOf((current.auto || {}).queued, (m.auto || {}).queued) } };
  }
  if (!ma) return current;
  if (current.source === 'auto') return { ...current, auto: { ...(current.auto || {}), queued: queuedOf((current.auto || {}).queued, ma.queued) } };
  const prev = current.auto || {}, sites = newerSites(prev.sites, ma.sites), any = Object.keys(sites).length;
  return { ...current, auto: { ...prev, ...ma, scanned: later(prev.scanned, ma.scanned), ...(any ? { sites, gaps: gapsOf(sites) } : {}), queued: queuedOf(prev.queued, ma.queued) } };
}
const fileAt = (slug) => path.join(DIR, slug + '.json');
const readFile = (slug) => { try { return JSON.parse(fs.readFileSync(fileAt(slug), 'utf8')); } catch (_) { return null; } };
export function readAll() { const out = {}; let names = []; try { names = fs.readdirSync(DIR); } catch (_) {} for (const n of names) if (/\.json$/.test(n)) { const v = readFile(n.slice(0, -5)); if (v) out[n.slice(0, -5)] = v; } return out; }
const writeFile = (slug, v) => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(fileAt(slug), JSON.stringify(v, null, 1) + '\n'); };

// ---- gaps to Verse's queue ----
/** a gap's queue job: a target of at most 40 characters that names it for ever (the floor, the site and the feature hashed), and the ask a builder reads. Pure. */
export function jobOf(floorId, host, f, page) {
  const h = crypto.createHash('sha1').update(floorId + '|' + host + '|' + f.name.toLowerCase()).digest('hex').slice(0, 8);
  return { target: 'feature:' + host.replace(/[^a-z0-9]+/gi, '-').slice(0, 20) + '-' + h, ask: clip('build "' + f.name + '" on ' + (page || 'Verse') + ' (' + host + ' has it' + (f.detail ? ': ' + f.detail : '') + ')', 200) };
}
/** the next gaps to queue: missing features in the tower's queue order (the lowest unbeaten floor first, a lane's sites before its leader as the
 *  climb meets them), hand research before the scan's, none queued before, at most `max`. Pure. */
export function nextJobs({ order, floors, files, max = 3 }) {
  if (!(max > 0)) return [];
  const queued = new Set(Object.values(files).flatMap((f) => ((f.auto && f.auto.queued) || []).map((q) => q.target))), out = [];
  const floorOf = new Map(); for (const fl of floors) for (const s of fl.sites) floorOf.set(s.id, { fl, s });
  for (const id of order) {
    const hit = floorOf.get(id); if (!hit) continue; const file = files[hit.fl.slug]; if (!file) continue;
    const re = file.re && file.re.sites && file.re.sites[hit.s.host], // found by reverse engineering (tools/site-re.mjs): read or observed in the site's code, never a guess, and after hand research and the scan
      entries = [file.sites && file.sites[hit.s.host], file.auto && file.auto.sites && file.auto.sites[hit.s.host], re && { features: (re.features || []).filter((f) => f.tag !== 'inferred') }].filter(Boolean);
    for (const e of entries) for (const f of e.features || []) {
      if (f.verse !== 'missing' || f.paid) continue; const job = jobOf(hit.fl.id, hit.s.host, f, file.verse_page || hit.fl.page);
      if (queued.has(job.target)) continue; queued.add(job.target); out.push({ ...job, slug: hit.fl.slug, host: hit.s.host, feature: f.name });
      if (out.length >= max) return out;
    }
  }
  return out;
}
/** the tower's queue order as floor ids: the unbeaten ones as the climb meets them, then the conquered ones (their gaps come last) */
function towerOrder() {
  let ev = {}; try { ev = JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy', 'tower.evidence.json'), 'utf8')).floors || {}; } catch (_) {}
  const all = tower([], ev, null).floors; return [...all.filter((f) => !f.beaten), ...all.filter((f) => f.beaten)].map((f) => f.id);
}
async function queueJobs(files, floors, { max = 3, dry = false } = {}) {
  const tok = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN, H = { authorization: 'Bearer ' + tok, 'content-type': 'application/json', 'user-agent': 'a2m-feature-scan/1.0' };
  let open = 0;
  if (tok && !dry) { try { const v = await (await fetch(SITE + '/api/queue', { headers: H, signal: AbortSignal.timeout(20000) })).json(); open = (v.items || []).filter((i) => /^feature:/.test(i.target) && /^(queued|building)$/.test(i.state)).length; } catch (e) { console.log('::warning::the queue was not read: ' + (e && e.message || e)); return []; } }
  const jobs = nextJobs({ order: towerOrder(), floors, files, max: Math.max(0, Math.min(max, OPEN_MAX - open)) }), done = [];
  if (!jobs.length) { console.log(open >= OPEN_MAX ? open + ' feature jobs open: none queued' : 'no gap left to queue'); return done; }
  for (const j of jobs) {
    if (!tok || dry) { console.log('would queue ' + j.target + ': ' + j.ask); continue; }
    try {
      const r = await fetch(SITE + '/api/queue', { method: 'POST', headers: H, body: JSON.stringify({ ask: j.ask, target: j.target }), signal: AbortSignal.timeout(20000) });
      if (!r.ok) { console.log('::warning::the queue answered ' + r.status + ' for ' + j.target); continue; }
      const v = await r.json(); console.log('queued ' + j.target + ': ' + j.ask);
      const file = files[j.slug], q = { target: j.target, feature: j.feature, host: j.host, at: today(), ...(v && v.item && v.item.id ? { id: v.item.id } : {}) };
      files[j.slug] = { ...file, auto: { ...(file.auto || {}), queued: [...((file.auto && file.auto.queued) || []), q] } }; done.push(j.slug);
    } catch (e) { console.log('::warning::' + j.target + ' not queued: ' + (e && e.message || e)); }
  }
  return done;
}

// ---- the browser side ----
/** run inside a page: its visible text, headings, list items, buttons, table rows and links, navigation, headers and footers left out */
function readInPage() {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const own = (e) => !e.closest('nav,footer,header,[role=navigation],[role=contentinfo],[aria-hidden=true],[class*=cookie i],[id*=cookie i]');
  const txt = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
  const all = (sel, max) => [...document.querySelectorAll(sel)].filter((e) => own(e) && vis(e)).map(txt).filter(Boolean).slice(0, max);
  return { title: document.title, text: document.body ? document.body.innerText.slice(0, 20000) : '', headings: all('h1,h2,h3,h4', 80), items: all('li', 200).filter((s) => s.length <= 120),
    buttons: all('button,[role=button],input[type=submit],input[type=button]', 60), rows: [...document.querySelectorAll('table tr')].filter(vis).map((r) => [...r.cells].map(txt).join('\t')).filter(Boolean).slice(0, 80),
    links: [...document.querySelectorAll('a[href]')].slice(0, 400).map((a) => ({ href: a.href, text: txt(a).slice(0, 80) })) };
}
async function readPage(ctx, url) {
  const p = await ctx.newPage();
  try {
    const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForLoadState('load', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(800);
    const got = await p.evaluate(readInPage);
    return { ok: !!r && r.status() < 400, status: r ? r.status() : 0, url: p.url(), ...got, pricing: /pric|plans?|premium|upgrade/i.test(p.url()) };
  } catch (e) { return { ok: false, url, problem: 'did not load (' + String(e && e.message || e).split('\n')[0].slice(0, 80) + ')' }; } finally { await p.close().catch(() => {}); }
}
async function robotsOf(url) {
  try { const r = await fetch(new URL('/robots.txt', url), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) }); return r.ok ? (await r.text()).slice(0, 200000) : ''; } catch (_) { return ''; }
}
/** one site read: { url, final, problem?, pages } (the home page and up to `max` pages its links point to) */
export async function scanSite(browser, url, { max = 6, robots = robotsOf } = {}) {
  const rules = await robots(url), pathOf = (u) => { const x = new URL(u); return x.pathname + x.search; };
  if (!robotsAllows(rules, pathOf(url))) return { url, problem: 'robots.txt asks robots not to read it', pages: [] };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US', extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' } });
  try {
    const home = await readPage(ctx, url);
    if (!home.ok) return { url, problem: home.problem || 'answered ' + home.status, pages: [] };
    const problem = pageProblem(home); if (problem) return { url, final: home.url, problem, pages: [] };
    const pages = [home];
    for (const u of pickLinks(home.url, home.links, max)) { if (!robotsAllows(rules, pathOf(u))) continue; const p = await readPage(ctx, u); if (p.ok && !pageProblem(p, false)) pages.push(p); }
    return { url, final: home.url, pages };
  } finally { await ctx.close().catch(() => {}); }
}
/** Verse's page for a floor as a person opens it: its visible text and what its boxes hold, or '' when it did not load */
export async function verseText(browser, floor, base = VERSE) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US' }), p = await ctx.newPage();
  try {
    await p.goto(floor.page ? new URL(floor.page, base).href : base + '?q=' + encodeURIComponent(floor.ask || floor.id), { waitUntil: 'load', timeout: 30000 });
    await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); if (!floor.page) await p.waitForTimeout(3000);
    return await p.evaluate(() => (document.body ? document.body.innerText + '\n' + [...document.querySelectorAll('input:not([type=hidden]), textarea, output, select option')].map((e) => e.value || e.textContent || '').join('\n') + '\n' + [...document.querySelectorAll('[aria-label],[title]')].map((e) => e.getAttribute('aria-label') || e.title).join('\n') : ''));
  } catch (_) { return ''; } finally { await ctx.close().catch(() => {}); }
}
/** a floor's chosen sites read and compared with Verse: { host: site entry } for the file, and how many model calls it spent */
export async function scanFloor(browser, floor, sites, { calls = 0, verse = VERSE, read = scanSite, model = modelFeatures } = {}) {
  const vt = await verseText(browser, floor, verse), out = {}; let spent = 0;
  console.log(floor.id + ': Verse\'s page ' + (vt ? 'read (' + vt.length + ' characters)' : 'not read: features left unchecked'));
  for (const s of sites) {
    const r = await read(browser, s.url).catch((e) => ({ url: s.url, problem: 'not read (' + (e && e.message || e) + ')', pages: [] }));
    const entry = { url: s.url, scanned: today(), ...(s.leader ? { leader: true } : {}), ...(r.final && hostOf(r.final) && s.host && hostOf(r.final) !== s.host ? { went_to: hostOf(r.final) } : {}), pages: r.pages.map((p) => p.url) };
    if (r.problem || !r.pages.length) { out[s.host] = { ...entry, problem: r.problem || 'no page read', features: [] }; console.log('  ' + s.host + ': ' + out[s.host].problem); continue; }
    let feats = null, method = 'heuristic';
    if (spent < calls) { spent++; feats = await model(s.host, r.pages); if (feats) method = 'model'; }
    if (!feats) feats = heuristicFeatures(r.pages);
    out[s.host] = { ...entry, method, features: compare(feats, vt, floor.page) };
    const c = (v) => out[s.host].features.filter((f) => f.verse === v).length;
    console.log('  ' + s.host + ': ' + r.pages.length + ' pages, ' + out[s.host].features.length + ' features by ' + method + ' (Verse has ' + c('has') + ', partly ' + c('partial') + ', lacks ' + c('missing') + ')');
  }
  return { sites: out, calls: spent };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = {}, words = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (['--stale', '--max-floors', '--max-sites', '--max-calls', '--out', '--put', '--jobs'].includes(a)) opt[a.slice(2)] = argv[++i]; else if (a.startsWith('--')) opt[a.slice(2)] = true; else words.push(a); }
  if (opt.put) { // the workflow's landing: this run's blocks folded into the files as they stand on the newest main
    const mine = JSON.parse(fs.readFileSync(opt.put, 'utf8')); let n = 0;
    for (const [slug, m] of Object.entries(mine)) { const cur = readFile(slug), next = putMine(cur, m); if (next && JSON.stringify(next) !== JSON.stringify(cur)) { writeFile(slug, next); n++; } }
    console.log(n + ' features file' + (n === 1 ? '' : 's') + ' updated'); process.exit(0);
  }
  const floors = floorsOf(), files = readAll(), id = words.join(' ').trim();
  if (id && !floors.some((f) => f.id === id)) { const lane = FLOORS.find((f) => f.id === id); console.error(lane && lane.lane ? id + ' is a lane site: scan its floor, "' + lane.lane + '"' : 'no floor ' + id + '; floors: ' + floors.map((f) => f.id).join(', ')); process.exit(2); }
  const scanning = !!(id || opt.missing || opt.stale !== undefined);
  const plan = scanning ? planOf({ floors, files, order: towerOrder(), only: id || null, missing: !!opt.missing, stale: opt.stale !== undefined ? Number(opt.stale) : null, maxFloors: Number(opt['max-floors']) || 2, maxSites: Number(opt['max-sites']) || 30 }) : [];
  if (opt.list) { for (const p of plan) console.log(p.floor.id + ': ' + p.sites.map((s) => s.host).join(', ')); if (!plan.length) console.log('nothing to scan'); process.exit(0); }
  if (!scanning && !opt.queue) { console.error('usage: feature-scan.mjs "<floor id>" | --missing | --stale DAYS [--queue] | --queue | --put mine.json (see the header)'); process.exit(2); }
  const mine = {}; let calls = opt['max-calls'] !== undefined ? Number(opt['max-calls']) : Number(process.env.FEATURE_SCAN_MAX_CALLS || 12), spentAll = 0;
  if (plan.length) {
    console.log('scanning ' + plan.reduce((n, p) => n + p.sites.length, 0) + ' sites on ' + plan.length + ' floors, at most ' + calls + ' model calls');
    const { chromium } = await import('playwright-core');
    const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    try {
      for (const p of plan) {
        const r = await scanFloor(b, p.floor, p.sites, { calls: Math.max(0, calls - spentAll) }); spentAll += r.calls;
        const next = mergeAuto(files[p.floor.slug] || null, p.floor, r.sites); files[p.floor.slug] = next;
        mine[p.floor.slug] = next.source === 'auto' ? { file: next } : { auto: next.auto };
        if (!opt.dry) writeFile(p.floor.slug, next);
      }
    } finally { await b.close(); }
    console.log(spentAll + ' model call' + (spentAll === 1 ? '' : 's') + ' spent');
  }
  if (opt.queue) for (const slug of await queueJobs(files, floors, { max: Number(opt.jobs) || 3, dry: !!opt.dry })) {
    const f = files[slug]; mine[slug] = f.source === 'auto' ? { file: f } : { ...(mine[slug] || {}), auto: f.auto }; if (!opt.dry) writeFile(slug, f);
  }
  if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(mine));
}
