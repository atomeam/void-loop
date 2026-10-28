#!/usr/bin/env node
/**
 * rival-inventory: what each tower floor's rival offers that Verse does not. For every rival site in lib/tower.js FLOORS (one row per host):
 *   1. read its robots.txt; a site that turns robots away (vcalc.com), or a floor marked noRival, is skipped and said so, never fetched;
 *   2. read its sitemap: the Sitemap: lines in robots.txt, then /sitemap.xml (sitemap indexes followed), then the HTML sitemap /sitemap.html;
 *   3. list every tool on it (one per page; "embed" copies of a page count as the same tool), named from the link text or the address;
 *   4. match each against Verse: the /calculators/ library (lib/calculators.js), Verse's own pages, and a short map of plain-name matches;
 *   5. write the result: docs/PARITY.md (between the rival-inventory markers, the gap table), domains/rival-inventory.json (everything) and
 *      domains/rival-gaps.queue.jsonl (one line a gap, the build queue's feed: { floor, site, tool, url, status: 'queued' }).
 *
 * Runs each lap:  node tools/rival-inventory.mjs [--only calculator.net] [--fixture host/path=file ...] [--offline] [--dry]
 * Every fetch sends User-Agent VerseRivalInventory and waits 1 s between requests. Nothing is posted anywhere; the live /api/queue
 * takes these lines only through tools/void_queue.py with its token. Pure parts exported for tools/rival-inventory.test.mjs.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UA = 'VerseRivalInventory/1.0 (+https://a-to-mind.com/)';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), SITE = join(ROOT, 'void-live-deploy');

/** robots.txt as groups: [{ agents: [lowercase], rules: [{ allow, path }] }], plus the Sitemap: lines. Pure. */
export function parseRobots(text) {
  const groups = [], sitemaps = []; let cur = null, lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'sitemap') { if (val) sitemaps.push(val); continue; }
    if (key === 'user-agent') { if (!lastWasAgent || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(val.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false; if (!cur) continue;
    if (key === 'allow' || key === 'disallow') cur.rules.push({ allow: key === 'allow', path: val });
  }
  return { groups, sitemaps };
}
const ruleRe = (p) => new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$'));
/** may `agent` fetch `path` (RFC 9309: the group naming the agent, else '*'; the longest matching rule; Allow wins a tie). Pure. */
export function allowed(robots, path, agent = 'VerseRivalInventory') {
  const a = agent.toLowerCase(), named = robots.groups.filter((g) => g.agents.some((x) => x !== '*' && a.includes(x)));
  const groups = named.length ? named : robots.groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const r of groups.flatMap((g) => g.rules)) {
    if (r.path === '' || !ruleRe(r.path).test(path)) continue; // a bare "Disallow:" allows everything
    const len = r.path.replace(/[*$]/g, '').length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}
/** the <loc> addresses of a sitemap.xml, and whether it is an index of other sitemaps. Pure. */
export function parseSitemapXml(xml) {
  const s = String(xml || ''), locs = [...s.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  return { index: /<sitemapindex[\s>]/i.test(s), locs };
}
const decode = (t) => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const SKIP = /^\/(?:$|index\.html?$|about|privacy|terms|contact|sitemap|search|login|sign|cookie|advert)/i;
/** the same-site links of an HTML sitemap page: [{ url, name, section }] (the heading above a link is its section). Pure. */
export function parseHtmlSitemap(html, base) {
  const out = [], b = new URL(base); let section = '';
  const re = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>|<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of String(html || '').matchAll(re)) {
    if (m[1] !== undefined) { section = decode(m[1]); continue; }
    let u; try { u = new URL(m[2], b); } catch { continue; }
    if (u.host.replace(/^www\./, '') !== b.host.replace(/^www\./, '') || SKIP.test(u.pathname)) continue;
    const name = decode(m[3]); if (!name || name.length > 80) continue;
    out.push({ url: u.origin + u.pathname, name, section });
  }
  return out;
}
/** a tool's plain name from an address: /mortgage-calculator.html → "Mortgage calculator". Pure. */
export function nameFromUrl(url) {
  const p = new URL(url).pathname.replace(/\/$/, '').split('/').pop().replace(/\.(html?|php|aspx?)$/i, '');
  const w = decodeURIComponent(p).replace(/[-_]+/g, ' ').trim(); return w ? w[0].toUpperCase() + w.slice(1) : '';
}
/** an embeddable copy's address → its page's address (/embed/x.html, /x-embed.html, ?embed=1), or null if it is not one. Pure. */
export function embedOf(url) {
  const u = new URL(url); let p = u.pathname;
  if (u.searchParams.has('embed')) { u.searchParams.delete('embed'); return u.origin + p + (u.search || ''); }
  if (/\/embed(ded)?\//i.test(p)) return u.origin + p.replace(/\/embed(ded)?\//i, '/');
  if (/-embed(ded)?(\.[a-z]+)?$/i.test(p)) return u.origin + p.replace(/-embed(ded)?(?=\.[a-z]+$|$)/i, '');
  return null;
}
/** one row a tool: embed copies folded into their page, each address once, sitemap/legal pages left out. Pure. */
export function toolsOf(entries) {
  const by = new Map();
  for (const e of entries) {
    const host = embedOf(e.url), url = host || e.url, key = url.toLowerCase().replace(/\/$/, '');
    if (SKIP.test(new URL(url).pathname)) continue;
    const had = by.get(key);
    if (had) { had.embeds += host ? 1 : 0; if (!had.section && e.section) had.section = e.section; if (host === null && e.name && had.fromUrl) { had.name = e.name; had.fromUrl = false; } continue; }
    by.set(key, { url, name: e.name || nameFromUrl(url), fromUrl: !e.name, section: e.section || '', embeds: host ? 1 : 0 });
  }
  return [...by.values()].map(({ fromUrl, ...t }) => t);
}
// --- matching against Verse
const STOP = new Set(['calculator', 'calculators', 'converter', 'conversion', 'generator', 'calc', 'the', 'a', 'of', 'and', 'or', 'for', 'to', 'online', 'free', 'tool', 'checker', 'finder', 'maker', 'encode', 'decode']);
/** a name as the words that carry it (lowercase, light plural strip). Pure. */
export function words(s) {
  return String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}
/** plain-name matches a word search would miss: a rival tool's words → the Verse page doing that job. Each one checked by hand to do it. */
export const ALIASES = {
  'scientific': '/calculators/#keypad', 'basic': '/calculator/', '': '/convert/', 'unit': '/convert/', 'base64': '/base64/', 'time zone': '/time/',
  'password': '/password/', 'random number': '/calculators/?calc=random-number', 'percentage': '/calculators/?calc=percent-of',
  'triangle': '/calculators/?calc=triangle-solve', 'standard deviation': '/calculators/?calc=descriptive', 'statistic': '/calculators/?calc=descriptive',
  'mean median mode range': '/calculators/?calc=descriptive', 'average': '/calculators/?calc=descriptive', 'fraction': '/calculators/?calc=fraction-math',
  'date': '/calculators/?calc=add-days', 'day counter': '/calculators/?calc=days-between', 'time': '/calculators/?calc=time-add', 'time duration': '/calculators/?calc=hours-worked',
  'hour': '/calculators/?calc=hours-worked', 'calorie': '/calculators/?calc=bmr', 'tdee': '/calculators/?calc=bmr', 'body fat': '/calculators/?calc=body-fat-navy-men',
  'grade': '/calculators/?calc=final-grade', 'interest': '/calculators/?calc=compound-interest', 'payment': '/calculators/?calc=payoff-time', 'finance': '/calculators/?calc=finance-tvm',
  'income tax': '/calculators/?calc=income-tax-us', 'loan': '/calculators/?calc=loan-payment', 'target heart rate': '/calculators/?calc=target-heart-rate-percent',
  'pythagorean theorem': '/calculators/?calc=right-triangle', 'exponent': '/calculators/#keypad', 'log': '/calculators/?calc=logarithm', 'quadratic formula': '/calculators/?calc=quadratic',
  'bac': '/calculators/?calc=blood-alcohol-widmark', 'gfr': '/calculators/?calc=egfr-ckd-epi-men', 'lean body mass': '/calculators/?calc=lean-body-mass-boer-men',
  'gas mileage': '/calculators/?calc=fuel-economy', 'mileage': '/calculators/?calc=fuel-economy', 'ohms law': '/calculators/?calc=ohms-law-voltage', 'electricity': '/calculators/?calc=electricity-cost',
  'least common multiple': '/calculators/?calc=gcd-lcm', 'greatest common factor': '/calculators/?calc=gcd-lcm', 'pregnancy conception': '/calculators/?calc=conception',
  'permutation combination': '/calculators/?calc=combinations', 'bmi': '/calculators/?calc=bmi', 'root': '/calculators/?calc=root',
  'voltage drop': '/calculators/?calc=wire-resistance', 'half life': '/calculators/?calc=half-life', 'z score': '/calculators/?calc=z-score', 'healthy weight': '/calculators/?calc=ideal-weight',
  'mass': '/calculators/?calc=mass-from-density', 'molecular weight': '/calculators/?calc=molar-mass', 'square footage': '/calculators/?calc=rectangle-area',
  'roofing': '/calculators/?calc=roof-area-pitch', 'tire size': '/calculators/?calc=tire-diameter',
  'surface area': '/calculators/?calc=solid-shapes', 'height': '/calculators/?calc=adult-height', 'btu': '/calculators/?calc=room-ac-btu', 'bandwidth': '/calculators/?calc=download-time',
  'golf handicap': '/calculators/?calc=handicap-index', 'sleep': '/calculators/?calc=sleep-cycles', 'roman numeral converter': '/calculators/?calc=roman-numerals',
};
/** Verse's catalogue: [{ name, href, words }] from the calculators library, the tower floors' pages and the site's own folders. */
export async function verseCatalogue() {
  const out = [];
  try {
    const { CALCULATORS } = await import(join(SITE, 'lib/calculators.js'));
    for (const c of CALCULATORS) out.push({ name: c.name, href: '/calculators/?calc=' + c.id, seqs: [words(c.name), words(c.id)] });
  } catch (e) { process.stderr.write('rival-inventory: calculators library not read: ' + e.message + '\n'); }
  try {
    const { FLOORS } = await import(join(SITE, 'lib/tower.js'));
    for (const f of FLOORS) if (f.page) out.push({ name: f.label || f.id, href: f.page, seqs: [words(f.label), words(f.id)] });
  } catch (e) { process.stderr.write('rival-inventory: tower floors not read: ' + e.message + '\n'); }
  for (const d of readdirSync(SITE)) { const p = join(SITE, d); if (statSync(p).isDirectory() && existsSync(join(p, 'index.html'))) out.push({ name: d, href: '/' + d + '/', seqs: [words(d)] }); }
  return out;
}
/** where Verse does a rival's tool: { href, by, name } or null. An alias first; else a Verse entry whose name or id STARTS with the
 *  tool's words ("Period" must not land on "Pendulum period", nor "Volume" on "Unit price by volume"); fewest extra words wins. Pure. */
export function matchTool(name, catalogue) {
  const w = words(name), key = w.join(' ');
  if (Object.prototype.hasOwnProperty.call(ALIASES, key)) return { href: ALIASES[key], by: 'alias', name: '' };
  if (!w.length) return null;
  let best = null;
  for (const e of catalogue) for (const seq of e.seqs || []) {
    if (seq.length < w.length || !w.every((x, i) => seq[i] === x)) continue;
    const extra = seq.length - w.length; if (!best || extra < best.extra) best = { href: e.href, by: 'words', name: e.name, extra };
  }
  return best && { href: best.href, by: best.by, name: best.name };
}
/** the rivals to read: one row a host, with the floors that point at it. Pure. */
export function rivalsOf(floors) {
  const by = new Map();
  for (const f of floors) {
    if (!f || !f.url || !/^https?:/.test(f.url)) continue;
    let u; try { u = new URL(f.url); } catch { continue; }
    const host = u.host.replace(/^www\./, ''), r = by.get(host) || { url: u.origin + '/', floors: [], noRival: '' };
    r.floors.push(f.id); if (f.noRival) r.noRival = String(f.noRival); by.set(host, r);
  }
  return [...by.values()];
}
// --- fetching: polite (one request a second), or from fixture files keyed "host/path" (tests, and laps without network)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, fixtures) {
  const u = new URL(url), key = u.host.replace(/^www\./, '') + u.pathname;
  if (fixtures[key]) return { ok: true, status: 200, text: readFileSync(fixtures[key], 'utf8') };
  if (fixtures.__offline) return { ok: false, status: 0, text: '' };
  await wait(1000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml,text/plain;q=0.9,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
  } catch (e) { return { ok: false, status: 0, text: '', error: String(e.message || e) }; }
}
/** one rival read end to end: { site, floors, status, why, sitemap, tools: [{ url, name, section, embeds, verse }] }. */
export async function inventory(row, catalogue, fixtures = {}) {
  const base = new URL(row.url), origin = base.origin, site = base.host.replace(/^www\./, '');
  const res = { site, origin, floors: row.floors, status: 'read', why: '', sitemap: '', tools: [] };
  if (row.noRival) return { ...res, status: 'skipped', why: 'floor marked noRival: ' + row.noRival };
  const rb = await get(origin + '/robots.txt', fixtures), robots = parseRobots(rb.ok ? rb.text : '');
  if (!allowed(robots, '/')) return { ...res, status: 'skipped', why: 'robots.txt turns robots away' };
  const tries = [...robots.sitemaps, origin + '/sitemap.xml', origin + '/sitemap.html'].filter((x, i, a) => a.indexOf(x) === i);
  let entries = [];
  for (const sm of tries) {
    let at; try { at = new URL(sm, origin); } catch { continue; }
    if (!allowed(robots, at.pathname)) continue;
    const r = await get(at.href, fixtures); if (!r.ok || !r.text) continue;
    entries = await entriesOf(r.text, robots, origin, fixtures);
    if (entries.length) { res.sitemap = at.href; break; }
  }
  if (!entries.length) return { ...res, status: 'no sitemap', why: 'none readable at ' + tries.join(', ') };
  res.tools = toolsOf(entries).map((t) => ({ ...t, verse: matchTool(t.name, catalogue) }));
  return res;
}
/** the pages one sitemap lists: XML (an index's first 8 children followed) or an HTML sitemap; robots-disallowed pages left out. */
async function entriesOf(text, robots, origin, fixtures) {
  if (!/<(urlset|sitemapindex)[\s>]/i.test(text)) return parseHtmlSitemap(text, origin + '/');
  const x = parseSitemapXml(text); let locs = x.locs;
  if (x.index) { locs = []; for (const child of x.locs.slice(0, 8)) { const c = await get(child, fixtures); if (c.ok) locs.push(...parseSitemapXml(c.text).locs); } }
  const ok = (l) => { try { return allowed(robots, new URL(l).pathname); } catch { return false; } };
  return locs.filter(ok).map((l) => ({ url: l, name: '', section: '' }));
}
const START = '<!-- rival-inventory: tools/rival-inventory.mjs writes this part each lap; change the tool, not the table -->', END = '<!-- /rival-inventory -->';
/** the PARITY.md part: one row a rival, then per rival every tool Verse lacks and (folded) what it has. Pure. */
export function parityText(results, when) {
  const L = [START, '## Rival inventory: what each tower rival lists, and what Verse lacks (' + when + ')', '',
    'Written by `node tools/rival-inventory.mjs`, run each lap. It reads each rival\'s robots.txt first and skips a site that turns robots away, then its sitemap, and matches every tool against Verse. A gap is a tool with no Verse page doing that job yet; each gap is also a line in `domains/rival-gaps.queue.jsonl`, the build queue\'s feed.', '',
    '| Rival | Floors | Status | Tools listed | On Verse | Gaps |', '| --- | --- | --- | --- | --- | --- |'];
  for (const r of results) {
    const have = r.tools.filter((t) => t.verse).length, st = r.status === 'read' ? 'read ' + r.sitemap : r.status + (r.why ? ': ' + r.why : '');
    L.push('| ' + r.site + ' | ' + r.floors.join(', ') + ' | ' + st + ' | ' + r.tools.length + ' | ' + have + ' | ' + (r.tools.length - have) + ' |');
  }
  for (const r of results.filter((x) => x.tools.length)) {
    const gaps = r.tools.filter((t) => !t.verse), have = r.tools.filter((t) => t.verse), embeds = r.tools.reduce((s, t) => s + t.embeds, 0);
    L.push('', '### ' + r.site + ': ' + r.tools.length + ' tools' + (embeds ? ' (' + embeds + ' embeddable copies counted with their page)' : '') + ', ' + have.length + ' on Verse, ' + gaps.length + ' gaps', '');
    if (gaps.length) { L.push('| Section | Gap | Rival page |', '| --- | --- | --- |'); for (const t of gaps) L.push('| ' + (t.section || '—') + ' | ' + t.name + ' | ' + t.url + ' |'); L.push(''); }
    L.push('<details><summary>On Verse already (' + have.length + ')</summary>', '', '| Tool | Verse page |', '| --- | --- |');
    for (const t of have) L.push('| ' + t.name + ' | https://a-to-mind.com' + t.verse.href + ' |');
    L.push('', '</details>');
  }
  L.push(END); return L.join('\n');
}
/** PARITY.md with the part put in: replacing the last run's, or (first run) just above the first page entry. Nothing else changes. Pure. */
export function withParity(doc, part) {
  const a = doc.indexOf(START), b = doc.indexOf(END);
  if (a >= 0 && b > a) return doc.slice(0, a) + part + doc.slice(b + END.length);
  const at = doc.search(/\n## /); return at < 0 ? doc.trimEnd() + '\n\n' + part + '\n' : doc.slice(0, at) + '\n\n' + part + '\n' + doc.slice(at);
}
/** the build queue's feed: one JSON line a gap. Pure. */
export const queueLines = (results, when) => results.flatMap((r) => r.tools.filter((t) => !t.verse).map((t) => JSON.stringify({ kind: 'rival-gap', floor: r.floors[0], site: r.site, section: t.section || '', tool: t.name, url: t.url, status: 'queued', seen: when })));

export async function main(argv) {
  const only = [], fixtures = {}; let dry = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') only.push(argv[++i].replace(/^www\./, ''));
    else if (argv[i] === '--fixture') { const [k, f] = argv[++i].split('='); fixtures[k.replace(/^www\./, '')] = f; }
    else if (argv[i] === '--offline') fixtures.__offline = true;
    else if (argv[i] === '--dry') dry = true;
  }
  const { FLOORS } = await import(join(SITE, 'lib/tower.js'));
  const rows = rivalsOf(FLOORS).filter((r) => !only.length || only.includes(new URL(r.url).host.replace(/^www\./, '')));
  const catalogue = await verseCatalogue(), when = new Date().toISOString().slice(0, 10), results = [];
  for (const row of rows) {
    const r = await inventory(row, catalogue, fixtures); results.push(r);
    process.stdout.write(r.site + ': ' + r.status + (r.why ? ' (' + r.why + ')' : '') + (r.tools.length ? ', ' + r.tools.length + ' tools, ' + r.tools.filter((t) => !t.verse).length + ' gaps' : '') + '\n');
  }
  if (dry) return results;
  const json = join(ROOT, 'domains/rival-inventory.json'), all = existsSync(json) ? JSON.parse(readFileSync(json, 'utf8')) : { rivals: {} };
  for (const r of results) if (r.status !== 'no sitemap' || !all.rivals[r.site]) all.rivals[r.site] = { ...r, when }; // a failed read keeps the last good one
  writeFileSync(json, JSON.stringify(all, null, 1) + '\n');
  const list = Object.values(all.rivals).sort((x, y) => x.site.localeCompare(y.site));
  writeFileSync(join(ROOT, 'docs/PARITY.md'), withParity(readFileSync(join(ROOT, 'docs/PARITY.md'), 'utf8'), parityText(list, when)));
  writeFileSync(join(ROOT, 'domains/rival-gaps.queue.jsonl'), queueLines(list, when).join('\n') + '\n');
  return results;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2)).catch((e) => { process.stderr.write(String(e.stack || e) + '\n'); process.exit(1); });
