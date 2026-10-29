// Site histories (owner, 2026-10-28: give every site in the tower and the obituaries a full history, every fact with its source, unknowns
// marked unknown, never invented). For each floor's site this reads only public, citable sources and writes docs/HISTORY/<slug>.md:
//   - Wikidata (matched by the site's own address, P856, or by its Wikipedia article whose Wikidata item names that address): founding date
//     (P571), founders that have their own Wikipedia article (public figures only, P112), owners with dates (P127), parent (P749), end (P576),
//     the best traffic rank Wikidata records (P1661, with its date).
//   - Wikipedia (the matched article only): sentences quoted from its History, Features, Controversy/Criticism sections and any sentence that
//     says acquired, redesigned, shut down, renamed or pivoted, each linked to its section.
//   - The Wayback Machine: the first archived copy and one archived copy a year (links), so redesigns can be seen, not claimed.
// Anything with no source is written "unknown". Sites are named in plain text only. Nothing is fetched at page load: the page reads
// void-live-deploy/history.json, built from these files by tools/parity.mjs.
//   node tools/site-history.mjs                 every floor of the tower (obituary sites first)
//   node tools/site-history.mjs random.org      one site
//   node tools/site-history.mjs --missing       only sites with no history file yet
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'VerseHistory/1.0 (https://a-to-mind.com; public research for site histories)';
export const slugOf = (site) => String(site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, json = true, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(25000) }); // a retry loop for one request, no database (void-review: ok)
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue; }
      if (!r.ok) return null;
      return json ? await r.json() : await r.text();
    } catch (_) { await sleep(800 * (i + 1)); }
  }
  return null;
}
const wdApi = (q) => 'https://www.wikidata.org/w/api.php?format=json&' + q;
const wpApi = (q) => 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&' + q;
const wdLink = (id) => 'https://www.wikidata.org/wiki/' + id;
const wpLink = (title, section) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')) + (section ? '#' + encodeURIComponent(section.replace(/ /g, '_')) : '');

// the Wikidata item whose official website is this host (exact address variants, so the match is the site itself)
async function itemByWebsite(url) {
  const h = hostOf(url); if (!h) return null;
  const variants = [];
  for (const s of ['https://', 'http://']) for (const w of ['', 'www.']) for (const t of ['', '/']) variants.push('<' + s + w + h + t + '>');
  const q = 'SELECT ?item WHERE { VALUES ?w { ' + variants.join(' ') + ' } ?item wdt:P856 ?w . } LIMIT 5'; // SPARQL from URL().hostname, which cannot hold < > or spaces (void-review: ok)
  const j = await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q));
  const ids = ((j && j.results && j.results.bindings) || []).map((b) => b.item.value.split('/').pop());
  return ids;
}
async function entities(ids) {
  if (!ids.length) return {};
  const out = {};
  for (let i = 0; i < ids.length; i += 40) {
    const j = await get(wdApi('action=wbgetentities&props=labels|claims|sitelinks&languages=en&sitefilter=enwiki&ids=' + ids.slice(i, i + 40).join('|')));
    Object.assign(out, (j && j.entities) || {});
  }
  return out;
}
const label = (e) => (e && e.labels && e.labels.en && e.labels.en.value) || '';
const enwiki = (e) => (e && e.sitelinks && e.sitelinks.enwiki && e.sitelinks.enwiki.title) || '';
const claims = (e, p) => ((e && e.claims && e.claims[p]) || []).filter((c) => c.rank !== 'deprecated' && c.mainsnak && c.mainsnak.datavalue);
const timeOf = (v) => { if (!v || !v.time) return ''; const m = /^([+-]\d+)-(\d\d)-(\d\d)/.exec(v.time); if (!m) return ''; const y = String(+m[1]); return v.precision >= 11 ? y + '-' + m[2] + '-' + m[3] : v.precision === 10 ? y + '-' + m[2] : y; };
const qual = (c, p) => { const q = c.qualifiers && c.qualifiers[p]; return q && q[0] && q[0].datavalue ? q[0].datavalue.value : null; };

// sentences of a plain-text Wikipedia extract, grouped by section heading
function sectionsOf(text) {
  const out = []; let cur = { title: '', body: '' };
  for (const line of String(text || '').split('\n')) {
    const m = /^(=+)\s*(.+?)\s*\1\s*$/.exec(line);
    if (m) { out.push(cur); cur = { title: m[2], body: '' }; } else cur.body += line + '\n';
  }
  out.push(cur);
  return out.filter((s) => s.body.trim());
}
const sentences = (t) => String(t || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map((s) => s.trim()).filter((s) => s.length > 25 && s.length < 400);
const yearIn = (s) => { const m = /\b(19[6-9]\d|20[0-2]\d)\b/.exec(s); return m ? m[1] : ''; };

export async function historyOf(floor) {
  const url = floor.url || '', host = hostOf(url), name = floor.site;
  const facts = { name, url, slug: slugOf(name), qid: '', article: '', founded: [], founders: [], owners: [], parent: [], ended: [], traffic: [], milestones: [], features: [], controversies: [], redesigns: [], shifts: [], snapshots: [], firstSnapshot: null, summary: null };
  // 1. the Wikidata item: by the site's own address; else by a Wikipedia article named like the site whose item lists that address
  let ids = await itemByWebsite(url) || [];
  let ents = await entities(ids);
  let item = ids.map((id) => ents[id]).find((e) => enwiki(e)) || ents[ids[0]];
  if (!item) {
    const s = await get(wpApi('action=query&list=search&srlimit=3&srsearch=' + encodeURIComponent(/\./.test(name) ? '"' + name + '"' : name + ' website')));
    for (const hit of ((s && s.query && s.query.search) || [])) {
      const p = await get(wpApi('action=query&prop=pageprops&ppprop=wikibase_item&titles=' + encodeURIComponent(hit.title)));
      const qid = p && p.query && p.query.pages && p.query.pages[0] && p.query.pages[0].pageprops && p.query.pages[0].pageprops.wikibase_item;
      if (!qid) continue;
      const e = (await entities([qid]))[qid];
      const sites = claims(e, 'P856').map((c) => hostOf(c.mainsnak.datavalue.value));
      if (host && sites.some((x) => x === host || host.endsWith('.' + x) || x.endsWith('.' + host))) { item = e; break; }
    }
  }
  if (item) {
    facts.qid = item.id; facts.article = enwiki(item);
    const src = wdLink(item.id);
    for (const c of claims(item, 'P571')) facts.founded.push({ when: timeOf(c.mainsnak.datavalue.value), src });
    for (const c of claims(item, 'P576')) facts.ended.push({ when: timeOf(c.mainsnak.datavalue.value), src });
    const refIds = [...new Set(['P112', 'P127', 'P749'].flatMap((p) => claims(item, p).map((c) => c.mainsnak.datavalue.value.id)).filter(Boolean))];
    const refs = await entities(refIds);
    for (const c of claims(item, 'P112')) { const e = refs[c.mainsnak.datavalue.value.id]; const t = enwiki(e); if (t) facts.founders.push({ who: label(e) || t, src: wpLink(t), via: src }); }
    for (const c of claims(item, 'P127')) { const e = refs[c.mainsnak.datavalue.value.id]; const who = label(e); if (who) facts.owners.push({ who, from: timeOf(qual(c, 'P580')), to: timeOf(qual(c, 'P582')), src }); }
    for (const c of claims(item, 'P749')) { const e = refs[c.mainsnak.datavalue.value.id]; const who = label(e); if (who) facts.parent.push({ who, src }); }
    const ranks = claims(item, 'P1661').map((c) => ({ rank: +c.mainsnak.datavalue.value.amount, when: timeOf(qual(c, 'P585')) })).filter((r) => r.rank > 0).sort((a, b) => a.rank - b.rank);
    if (ranks.length) facts.traffic.push({ ...ranks[0], src, of: ranks.length });
  }
  // 2. the Wikipedia article's own words, by section
  if (facts.article) {
    const t = facts.article;
    const sum = await get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')));
    if (sum && sum.extract) facts.summary = { text: sentences(sum.extract).slice(0, 2).join(' ') || sum.extract.slice(0, 300), src: wpLink(t) };
    const x = await get(wpApi('action=query&prop=extracts&explaintext=1&exsectionformat=wiki&titles=' + encodeURIComponent(t)));
    const text = x && x.query && x.query.pages && x.query.pages[0] && x.query.pages[0].extract;
    const seen = new Set();
    const add = (list, s, sec, cap) => { if (list.length >= cap || seen.has(s)) return; seen.add(s); list.push({ year: yearIn(s), text: s, src: wpLink(t, sec) }); };
    for (const sec of sectionsOf(text)) {
      const title = sec.title || '';
      if (/^(see also|references|notes|external links|further reading|bibliography|sources)$/i.test(title)) continue;
      const ss = sentences(sec.body);
      if (/controvers|criticis|lawsuit|legal|litigation|privacy|censor|security|incident|reception/i.test(title)) for (const s of ss.slice(0, 4)) add(facts.controversies, s, title, 6);
      else if (/feature|service|function|product|platform|tool|content|design/i.test(title)) for (const s of ss.slice(0, 3)) add(facts.features, s, title, 6);
      for (const s of ss) {
        if (/\b(redesign|new design|new look|relaunch|overhaul|new interface|revamp)/i.test(s)) add(facts.redesigns, s, title, 5);
        else if (/\b(was acquired|acquired by|acquired the|acquisition of|was sold|sold to|merged with|merged into|shut down|shutdown|discontinu|closed down|ceased|rebrand|renamed|spun off|spin-off)/i.test(s)) add(facts.shifts, s, title, 8);
        else if (/history|background|origin|founding|early|develop/i.test(title) && yearIn(s)) add(facts.milestones, s, title, 10);
      }
    }
    const byYear = (a, b) => (a.year || '9999').localeCompare(b.year || '9999');
    facts.milestones.sort(byYear); facts.shifts.sort(byYear); facts.redesigns.sort(byYear);
    if (!facts.milestones.length) for (const sec of sectionsOf(text).slice(0, 1)) for (const s of sentences(sec.body)) if (yearIn(s)) add(facts.milestones, s, '', 4);
  }
  // 3. the Wayback Machine: first copy and one a year
  if (host) {
    const cdx = await get('https://web.archive.org/cdx/search/cdx?output=json&fl=timestamp,original&filter=statuscode:200&collapse=timestamp:4&limit=60&url=' + encodeURIComponent(host + '/'));
    const rows = Array.isArray(cdx) ? cdx.slice(1) : [];
    for (const [ts, orig] of rows) facts.snapshots.push({ year: ts.slice(0, 4), src: 'https://web.archive.org/web/' + ts + '/' + orig });
    if (rows.length) { const [ts, orig] = rows[0]; facts.firstSnapshot = { when: ts.slice(0, 4) + '-' + ts.slice(4, 6) + '-' + ts.slice(6, 8), src: 'https://web.archive.org/web/' + ts + '/' + orig }; }
  }
  return facts;
}

const U = 'unknown (no source found yet)';
const md = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
export function render(f, floors, date) {
  const L = [];
  L.push('# ' + f.name + ': history', '');
  L.push('Every line cites its source. "Unknown" means no source was found yet; nothing here is guessed. Written by `node tools/site-history.mjs` on ' + date + ' from Wikidata, Wikipedia and the Wayback Machine; a person may add cited lines (press, the site\'s own blog) under **Added by hand**, which the tool never overwrites.', '');
  L.push('- Site: ' + f.name + (f.url ? ' (' + f.url + ')' : ''));
  L.push('- Floors: ' + floors.map((x) => x.id + (x.page ? ' (Verse page ' + x.page + ')' : '')).join('; '));
  L.push('- Wikidata: ' + (f.qid ? '[' + f.qid + '](' + wdLink(f.qid) + ')' : U));
  L.push('- Wikipedia: ' + (f.article ? '[' + f.article + '](' + wpLink(f.article) + ')' : U), '');
  if (f.summary) L.push('> ' + md(f.summary.text) + ' ([source](' + f.summary.src + '))', '');
  L.push('## Founding', '');
  L.push('- Founded: ' + (f.founded.length ? f.founded.map((x) => x.when + ' ([source](' + x.src + '))').join('; ') : U));
  L.push('- Founders (public figures only): ' + (f.founders.length ? f.founders.map((x) => '[' + md(x.who) + '](' + x.src + ') (listed on [Wikidata](' + x.via + '))').join('; ') : U));
  L.push('- First archived copy: ' + (f.firstSnapshot ? f.firstSnapshot.when + ' ([Wayback Machine](' + f.firstSnapshot.src + '))' : U), '');
  L.push('## Ownership', '');
  if (f.owners.length || f.parent.length) { for (const o of f.owners) L.push('- Owned by ' + md(o.who) + (o.from ? ' from ' + o.from : '') + (o.to ? ' to ' + o.to : '') + ' ([source](' + o.src + '))'); for (const o of f.parent) L.push('- Parent organisation: ' + md(o.who) + ' ([source](' + o.src + '))'); }
  else L.push('- ' + U);
  L.push('', '## Key milestones', '');
  if (f.milestones.length) for (const m of f.milestones) L.push('- ' + (m.year ? m.year + ': ' : '') + '"' + md(m.text) + '" ([source](' + m.src + '))'); else L.push('- ' + U);
  L.push('', '## Ownership changes, pivots and shutdowns', '');
  if (f.shifts.length || f.ended.length) { for (const e of f.ended) L.push('- Ended: ' + e.when + ' ([source](' + e.src + '))'); for (const m of f.shifts) L.push('- ' + (m.year ? m.year + ': ' : '') + '"' + md(m.text) + '" ([source](' + m.src + '))'); } else L.push('- ' + U);
  L.push('', '## Redesigns', '');
  if (f.redesigns.length) for (const m of f.redesigns) L.push('- ' + (m.year ? m.year + ': ' : '') + '"' + md(m.text) + '" ([source](' + m.src + '))'); else L.push('- No written source for a redesign found yet; the yearly archived copies below show how the site looked over time.');
  L.push('', '## Peak traffic', '');
  if (f.traffic.length) for (const t of f.traffic) L.push('- Best traffic rank recorded on Wikidata: ' + t.rank.toLocaleString('en-US') + (t.when ? ' (' + t.when + ')' : '') + ', the best of ' + t.of + ' recorded ranks (Alexa) ([source](' + t.src + '))'); else L.push('- ' + U);
  L.push('', '## Notable features', '');
  if (f.features.length) for (const m of f.features) L.push('- "' + md(m.text) + '" ([source](' + m.src + '))'); else L.push('- ' + U + '; see the site\'s feature inventory in [docs/PARITY/' + f.slug + '.md](../PARITY/' + f.slug + '.md) when it has one.');
  L.push('', '## Controversies', '');
  if (f.controversies.length) for (const m of f.controversies) L.push('- "' + md(m.text) + '" ([source](' + m.src + '))'); else L.push('- ' + U);
  L.push('', '## Press', '', '- ' + U, '');
  L.push('## Archived copies (Wayback Machine, one a year)', '');
  if (f.snapshots.length) L.push(f.snapshots.map((s) => '[' + s.year + '](' + s.src + ')').join(' · ')); else L.push('- ' + U);
  L.push('', '## Added by hand', '', '<!-- cited lines only: - YYYY: what happened ([source](https://...)) -->', '');
  return L.join('\n');
}
const HAND = /\n## Added by hand\n[\s\S]*$/;
export function write(f, floors, date) {
  const file = path.join(root, 'docs/HISTORY', f.slug + '.md');
  let out = render(f, floors, date);
  try { const old = fs.readFileSync(file, 'utf8'); const m = HAND.exec(old); if (m) out = out.replace(HAND, m[0]); } catch (_) {}
  fs.writeFileSync(file, out);
  return file;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { tower } = await import(pathToFileURL(path.join(root, 'void-live-deploy/lib/tower.js')).href);
  const inv = JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy/lap.items.json'), 'utf8'));
  const ev = JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy/tower.evidence.json'), 'utf8'));
  // every site of the queue, not only the hand floors: the frontier's sites too, in queue order (lightest first when weights are known), so no site is
  // fought without a cited history and none is skipped
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy', f), 'utf8')); } catch (_) { return null; } };
  const floors = tower(inv.onlySite || [], ev.floors || {}, rd('tower.frontier.json'), null, rd('tower.rank.json'), rd('tower.size.json')).floors;
  const bySlug = new Map();
  for (const f of floors) { const s = slugOf(f.site); if (!bySlug.has(s)) bySlug.set(s, []); bySlug.get(s).push(f); }
  let list = [...bySlug.entries()].sort((a, b) => (+b[1].some((f) => f.beaten || (f.n >= 9 && !(f.lost || []).length))) - (+a[1].some((f) => f.beaten || (f.n >= 9 && !(f.lost || []).length))));
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--')).map(slugOf);
  if (only.length) list = list.filter(([s]) => only.includes(s));
  if (args.includes('--retry-archive')) list = list.filter(([s]) => { try { return /## Archived copies[^\n]*\n\n- unknown/.test(fs.readFileSync(path.join(root, 'docs/HISTORY', s + '.md'), 'utf8')); } catch (_) { return true; } });
  if (args.includes('--missing')) list = list.filter(([s]) => !fs.existsSync(path.join(root, 'docs/HISTORY', s + '.md')));
  const mx = args.indexOf('--max'); if (args.includes('--missing') && mx >= 0) { list.sort((a, b) => Math.min(...a[1].map((f) => f.floor)) - Math.min(...b[1].map((f) => f.floor))); list = list.slice(0, Math.max(1, Number(args[mx + 1]) || 40)); }
  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.join(root, 'docs/HISTORY'), { recursive: true });
  const N = args.includes('--slow') ? 1 : 4; let i = 0;
  await Promise.all(Array.from({ length: N }, async () => { while (i < list.length) { const [s, fl] = list[i++]; try { const f = await historyOf(fl[0]); f.slug = s; write(f, fl, date); console.log('ok', s, f.qid || '-', f.article || '-', 'snapshots', f.snapshots.length); if (N === 1) await sleep(2500); } catch (e) { console.log('fail', s, e.message); } } }));
}
