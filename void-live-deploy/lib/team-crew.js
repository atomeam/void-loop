/**
 * team-crew: Verse's own crew on /team/, the pure half (lib/team-crew-run.js does the D1 and the fetches; functions/api/wants.js shows it).
 * Owner, 2026-11-03: "can you populate /team with real bots for me?"; and Verse's brain should keep a never-ending queue of its own real
 * wants and needs, grounded in evidence, filed as jobs on the team board, each citing the data that triggered it and closed only when its
 * measured outcome improves.
 *
 * Two halves:
 *   - The crew: house members of the team chat that run on Verse's own clock (POST /api/automations/tick, every 15 minutes), on Cloudflare,
 *     with no machine of anyone's in the loop. Each has one lane, does real work in it (probes, crawls, reads the exam and the Tower, drafts
 *     promos), and posts what it did. A crew member never holds a build-queue job (auto = 0), never spends and never writes outside.
 *   - The wants: what Verse's brain reads in its own evidence (the outcome exam, the Tower's verdicts, pages that fail, links that break,
 *     asks it missed, sales, what it learned on TV and radio) becomes a want with a cited source and one measured number. A want is filed as
 *     a build-queue job (a team kind, so any coder claims it) with a thread in #work, and it closes only when that number moves the right way.
 * Pure: no fetch, no storage. Tests: tools/team-crew.test.mjs.
 */

import { slugOf } from './watch-build.js'; // a TV or radio idea's blueprint job is tv:<slug> (tools/watch-build.mjs queues it)
export const CREW = Object.freeze([
  { id: 'c7e0000000a1', slug: 'tower-scout', name: 'TowerScout', every: 240, channel: 'tower', lane: 'tower',
    about: 'Crew · runs on Verse\'s clock. Maps rival sites (robots and sitemaps, the whole site), reads the Tower and files the gaps as jobs.' },
  { id: 'c7e0000000a2', slug: 'exam-coach', name: 'ExamCoach', every: 60, channel: 'exam', lane: 'exam',
    about: 'Crew · runs on Verse\'s clock. Reads the outcome exam, files the weakest domain and missed asks as jobs, closes them when scores rise.' },
  { id: 'c7e0000000a3', slug: 'merge-train', name: 'MergeTrain', every: 60, channel: 'merges', lane: 'merge',
    about: 'Crew · runs on Verse\'s clock. Watches open pull requests and main: which are green and landing, which are red and why.' },
  { id: 'c7e0000000a4', slug: 'broadcast-builder', name: 'BroadcastBuilder', every: 120, channel: 'broadcast', lane: 'idea',
    about: 'Crew · runs on Verse\'s clock. Turns what Verse learned on TV and radio into a paid-linked feature job on a-to-mind.com.' },
  { id: 'c7e0000000a5', slug: 'status-watch', name: 'StatusWatch', every: 30, channel: 'status', lane: 'page',
    about: 'Crew · runs on Verse\'s clock. Probes the key pages and the hourly guards; a failure becomes a heal job at once.' },
  { id: 'c7e0000000a6', slug: 'growth', name: 'Growth', every: 360, channel: 'growth', lane: 'revenue',
    about: 'Crew · runs on Verse\'s clock. Drafts promos from what Verse just won, with one-tap X links for the owner. Never posts outside.' },
  { id: 'c7e0000000a7', slug: 'site-operator', name: 'SiteOperator', every: 180, channel: 'site', lane: 'link',
    about: 'Crew · runs on Verse\'s clock. Walks the links on the home, store and team pages; a broken one becomes a heal job.' },
  { id: 'c7e0000000a8', slug: 'tech-radar', name: 'TechRadar', every: 360, channel: 'radar', lane: 'radar',
    about: 'Crew · runs on Verse\'s clock. Reads browser release notes and posts what Verse can use, with the page it fits.' },
]);
export const byLane = (lane) => CREW.find((b) => b.lane === lane) || null;
export const LANES = Object.freeze({ exam: 'gap', tower: 'versus', page: 'heal', link: 'heal', miss: 'gap', revenue: 'feature', idea: 'feature', merge: 'heal' });
export const CREW_AWAY_MS = 40 * 60e3; // the clock knocks every 15 minutes: a crew member is here while it has worked in the last 40
export const MAX_OPEN = 12, FILE_PER_TICK = 2, REOPEN_MAX = 3, REOPEN_GAP_MS = 24 * 3600e3, SETTLE_MS = 2 * 3600e3;
export const TAG = 'Want key: ';
export const WANT_KEY = /^[a-z0-9][a-z0-9-]{2,60}$/;
// the pages StatusWatch probes every run (plus the page of every open page want)
export const KEY_PAGES = Object.freeze(['/', '/team/', '/store/', '/calculator/', '/convert/', '/scores/', '/random/', '/progress/', '/brain/', '/fix/', '/tools.json']);
export const LINK_PAGES = Object.freeze(['/', '/store/', '/team/', '/fix/']);
export const LINKS_PER_RUN = 14;
export const PRODUCTS = Object.freeze([
  { name: 'Void Monthly', url: 'https://moonbeam846.gumroad.com/l/yinmj' },
  { name: 'One-Time Fix', url: 'https://moonbeam846.gumroad.com/l/eozcma' },
  { name: 'Full-Stack Audit', url: 'https://moonbeam846.gumroad.com/l/full-stack-audit' },
]);

const s = (x, n = 160) => String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export const slug = (x, n = 40) => s(x, 200).toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n).replace(/-+$/, '') || 'root';
/** FNV-1a, base 36: the same text gives the same short key */
export const hash = (t) => { let h = 0x811c9dc5; for (const c of String(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const WIN = new Set(['better', 'equal-and-better']);

/** a Tower floor's aspects that are not a win yet: [{ aspect, verdict, evidence }] */
export function towerMisses(rows) {
  return Object.entries(rows || {}).filter(([, v]) => v && typeof v === 'object' && v.verdict && !WIN.has(v.verdict))
    .map(([aspect, v]) => ({ aspect: s(aspect, 80), verdict: s(v.verdict, 30), evidence: s(v.evidence, 220) }));
}
/** the rival's host in a floor id ("sports: flashscore.com" -> flashscore.com, "sycophanthex.com" -> itself), or '' */
export function rivalOf(floor) {
  const m = /(?:^|:\s*)((?:[a-z0-9-]+\.)+[a-z]{2,})$/i.exec(s(floor, 120));
  return m ? m[1].toLowerCase() : '';
}
const towerWeight = (miss) => miss.reduce((n, m) => n + (m.verdict === 'worse' ? 3 : 1), 0);

/**
 * Verse's wants, from its evidence, most urgent first. ev (every field optional; a missing one makes no want and measures nothing):
 *   exam     /exam/latest.json { domains: { <d>: { score, fails: [{ ask }] } } } or /progress/exam.json { cases: [{ id, ask, ok }] }
 *   tower    /tower.evidence.json { floors: { <floor>: { <aspect>: { verdict, evidence } } } }
 *   probe    [{ path, status, ms }]        StatusWatch's probes of a-to-mind.com
 *   guards   lib/status.js summarize(...).guards [{ id, name, now: up|down|unknown }]
 *   links    [{ path, status, from }]      SiteOperator's link walk
 *   misses7  distinct asks Verse missed in the last 7 days (a count only: what visitors typed stays private)
 *   sales30  verified sales in the last 30 days (a count only)
 *   ideas    [{ h, topic, note, show, station, value_cents }] what Verse learned on TV and radio (kind idea)
 *   at       ISO time of the read (the month and week in a key)
 * -> [{ key, lane, kind, title, why, done, cite: [{ what, url }], metric: { id, label, better, value }, private }]
 */
export function wantsOf(ev = {}) {
  const out = [], at = s(ev.at || '', 30) || new Date(0).toISOString();
  const want = (w) => { if (WANT_KEY.test(w.key) && w.metric && num(w.metric.value) != null) out.push({ private: false, ...w, kind: LANES[w.lane] }); };
  // pages that fail and guards that are down come first: a visitor sees them now
  for (const p of ev.probe || []) if (p && p.path && p.status !== 200) {
    want({ key: 'page-' + slug(p.path), lane: 'page', title: 'Make ' + s(p.path, 60) + ' answer again (it answered ' + (p.status || 'nothing') + ')',
      why: 'StatusWatch probed https://a-to-mind.com' + s(p.path, 80) + ' and got ' + (p.status || 'no answer') + (p.ms ? ' after ' + p.ms + ' ms' : '') + '.',
      done: 'The page answers 200 on a-to-mind.com.', cite: [{ what: 'StatusWatch probe', url: 'https://a-to-mind.com' + s(p.path, 80) }],
      metric: { id: 'page:' + s(p.path, 80), label: s(p.path, 60) + ' answers 200', better: 'up', value: 0 } });
  }
  for (const g of ev.guards || []) if (g && g.id && g.now === 'down') {
    want({ key: 'guard-' + slug(g.id), lane: 'page', title: 'Fix what the ' + s(g.name, 40) + ' guard sees broken',
      why: 'The hourly guard "' + s(g.name, 40) + '" (' + s(g.what, 120) + ') reads down on /status/.', done: 'The guard reads up again.',
      cite: [{ what: 'Verse status', url: 'https://a-to-mind.com/status/' }], metric: { id: 'guard:' + s(g.id, 60), label: s(g.name, 40) + ' guard up', better: 'up', value: 0 } });
  }
  for (const l of ev.links || []) if (l && l.path && l.status !== 200) {
    want({ key: 'link-' + slug(l.path), lane: 'link', title: 'Fix the broken link to ' + s(l.path, 60) + (l.from ? ' on ' + s(l.from, 30) : ''),
      why: 'SiteOperator followed the link to ' + s(l.path, 80) + (l.from ? ' from ' + s(l.from, 40) : '') + ' and got ' + (l.status || 'no answer') + '.',
      done: 'The link opens a page that answers 200, or the link goes.', cite: [{ what: 'SiteOperator link walk', url: 'https://a-to-mind.com' + s(l.from || '/', 40) }],
      metric: { id: 'link:' + s(l.path, 80), label: s(l.path, 60) + ' answers 200', better: 'up', value: 0 } });
  }
  // the outcome exam: the lowest domains (or a case that regressed)
  const doms = ev.exam && ev.exam.domains && typeof ev.exam.domains === 'object' ? Object.entries(ev.exam.domains) : [];
  const low = doms.filter(([, d]) => d && num(d.score) != null && d.score < 100).sort((a, b) => a[1].score - b[1].score || (a[0] < b[0] ? -1 : 1)).slice(0, 2);
  for (const [d, x] of low) {
    const fails = (x.fails || []).map((f) => s(f && f.ask, 60)).filter(Boolean).slice(0, 3);
    want({ key: 'exam-' + slug(d, 30), lane: 'exam', title: 'Raise the ' + s(d, 30) + ' exam score from ' + x.score,
      why: 'The outcome exam scores ' + s(d, 30) + ' ' + x.score + '/100, among the lowest of ' + doms.length + ' domains' + (fails.length ? '. It fails: ' + fails.join('; ') : '') + '.',
      done: 'The next exam run scores ' + s(d, 30) + ' higher, with no other domain lower.', cite: [{ what: 'outcome exam', url: 'https://a-to-mind.com/exam/latest.json' }, { what: 'scoreboard', url: 'https://a-to-mind.com/progress/' }],
      metric: { id: 'exam:' + s(d, 30), label: s(d, 30) + ' exam score', better: 'up', value: x.score } });
  }
  if (!doms.length) for (const c of (ev.exam && ev.exam.cases) || []) if (c && c.id && c.ok === false) {
    want({ key: 'exam-case-' + slug(c.id, 30), lane: 'exam', title: 'Make "' + s(c.ask, 50) + '" pass the outcome exam again',
      why: 'The outcome exam case "' + s(c.ask, 60) + '" regressed.', done: 'The case passes on the next exam run.',
      cite: [{ what: 'outcome exam', url: 'https://a-to-mind.com/progress/exam.json' }], metric: { id: 'examcase:' + s(c.id, 40), label: '"' + s(c.ask, 40) + '" passes', better: 'up', value: 0 } });
  }
  // the Tower: the floors furthest from a clean win
  const floors = ev.tower && ev.tower.floors && typeof ev.tower.floors === 'object' ? Object.entries(ev.tower.floors) : [];
  const weak = floors.map(([f, rows]) => ({ f, miss: towerMisses(rows) })).filter((x) => x.miss.length)
    .sort((a, b) => towerWeight(b.miss) - towerWeight(a.miss) || (a.f < b.f ? -1 : 1)).slice(0, 2);
  for (const { f, miss } of weak) {
    const rival = rivalOf(f);
    want({ key: 'tower-' + slug(f, 40), lane: 'tower', title: 'Win ' + miss.length + ' more aspect' + (miss.length === 1 ? '' : 's') + ' on the ' + s(f, 50) + ' floor',
      why: 'The Tower has Verse short on ' + s(f, 50) + ': ' + miss.slice(0, 4).map((m) => m.aspect + ' (' + m.verdict + ')').join(', ') + '. ' + (miss[0].evidence ? 'Evidence: ' + miss[0].evidence : ''),
      done: 'The next Tower run has fewer aspects short on this floor' + (rival ? ', measured against ' + rival + ' across its whole site' : '') + '.',
      cite: [{ what: 'Tower evidence', url: 'https://a-to-mind.com/tower.evidence.json' }].concat(rival ? [{ what: 'rival', url: 'https://' + rival + '/' }] : []),
      metric: { id: 'tower:' + s(f, 80), label: s(f, 40) + ' aspects short', better: 'down', value: miss.length } });
  }
  // what visitors asked and Verse missed: a count only, the asks stay on the owner-only list
  if (num(ev.misses7) != null && ev.misses7 >= 5) {
    want({ key: 'misses-' + weekOf(at), lane: 'miss', title: 'Answer more of the asks Verse missed this week', private: true,
      why: ev.misses7 + ' different asks went unanswered in the last 7 days.', done: 'Fewer different asks go unanswered over the next 7 days.',
      cite: [{ what: 'missed asks (owner only)', url: 'https://a-to-mind.com/api/misses' }], metric: { id: 'misses7', label: 'different asks missed in 7 days', better: 'down', value: ev.misses7 } });
  }
  // revenue: one want a month, measured by verified sales
  if (num(ev.sales30) != null) {
    want({ key: 'revenue-' + at.slice(0, 7), lane: 'revenue', title: 'Turn more visits into sales this month', private: true,
      why: ev.sales30 + ' verified sale' + (ev.sales30 === 1 ? '' : 's') + ' in the last 30 days. Put a paid product (' + PRODUCTS.map((p) => p.name).join(', ') + ') where the free page that wins most leaves off.',
      done: 'More verified sales in the 30 days after.', cite: [{ what: 'store', url: 'https://a-to-mind.com/store/' }],
      metric: { id: 'sales30', label: 'verified sales in 30 days', better: 'up', value: ev.sales30 } });
  }
  // TV and radio: the most valuable idea Verse noted, built onto the site
  const idea = (ev.ideas || []).filter((i) => i && i.h && i.topic).sort((a, b) => (b.value_cents || 0) - (a.value_cents || 0))[0];
  if (idea) {
    const key = 'idea-' + slug(idea.h, 10);
    want({ key, lane: 'idea', title: 'Build "' + s(idea.topic, 60) + '" onto a-to-mind.com, linked to a paid product',
      why: 'Verse noted on ' + s(idea.show || idea.station, 60) + ': ' + s(idea.note, 220) + '. Extend the page that already covers it (combine pages); build new only if none fits.',
      done: 'The change is live on a-to-mind.com and links one of: ' + PRODUCTS.map((p) => p.name).join(', ') + '.',
      cite: [{ what: 'Verse\'s TV and radio notes', url: 'https://a-to-mind.com/api/watchalong?kind=idea' }], metric: { id: 'joblive:want-' + key, label: 'the build is live', better: 'up', value: 0 },
      // one build, not two (the owner asked on 2026-11-06 for every blueprint to build by itself): the idea is built
      // by the blueprint lane's own tv: job, so the want adopts that job when it exists and files one in that lane when it does not
      target: ('tv:' + slugOf(idea.topic)).slice(0, 40) });
  }
  return out;
}
/** the ISO week of a time, "2026-w45" */
export function weekOf(iso) {
  const d = new Date(Date.parse(iso) || 0), t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + '-w' + String(w).padStart(2, '0');
}

/** the number a metric reads in this evidence, or null when this read did not measure it. ev as wantsOf, plus jobs: { <id>: state } */
export function measure(id, ev = {}) {
  const m = /^([a-z]+):(.*)$/.exec(String(id || '')), k = m ? m[1] : String(id || ''), arg = m ? m[2] : '';
  if (k === 'exam') { const d = ev.exam && ev.exam.domains && ev.exam.domains[arg]; return d ? num(d.score) : null; }
  if (k === 'examcase') { const c = ((ev.exam && ev.exam.cases) || []).find((x) => x && x.id === arg); return c ? (c.ok ? 1 : 0) : null; }
  if (k === 'tower') { const rows = ev.tower && ev.tower.floors && ev.tower.floors[arg]; return rows ? towerMisses(rows).length : null; }
  if (k === 'page') { const p = (ev.probe || []).find((x) => x && x.path === arg); return p ? (p.status === 200 ? 1 : 0) : null; }
  if (k === 'link') { const p = (ev.links || []).find((x) => x && x.path === arg) || (ev.probe || []).find((x) => x && x.path === arg); return p ? (p.status === 200 ? 1 : 0) : null; }
  if (k === 'guard') { const g = (ev.guards || []).find((x) => x && x.id === arg); return g && g.now !== 'unknown' ? (g.now === 'up' ? 1 : 0) : null; }
  if (k === 'misses7') return num(ev.misses7);
  if (k === 'sales30') return num(ev.sales30);
  if (k === 'joblive') { const st = ev.jobs && ev.jobs[arg]; return st == null ? null : st === 'live' ? 1 : 0; }
  return null;
}
/** did the number move the right way? */
export const improved = (better, baseline, value) => num(value) != null && num(baseline) != null && (better === 'down' ? value < baseline : value > baseline);

/** the build-queue job for a want: { id, target, ask } (the ask cites its source and names its number) */
export function jobOf(w) {
  const id = 'want-' + w.key;
  return { id, target: w.target || w.kind + ':' + id, ask: s(w.title + '. Why: ' + w.why + ' Done when: ' + w.done + ' Source: ' + w.cite.map((c) => c.url).join(' '), 900) };
}
/** the #work post that files a want */
export function wantPost(w, bot) {
  return [
    'Verse wants: ' + w.title,
    'Why: ' + w.why,
    'Source: ' + w.cite.map((c) => c.what + ' ' + c.url).join(' · '),
    'Measured by: ' + w.metric.label + ', now ' + (w.private ? 'on record' : w.metric.value) + '. It closes only when that number ' + (w.metric.better === 'down' ? 'falls' : 'rises') + '.',
    'Done when: ' + w.done,
    (bot ? '@' + bot.name + ' keeps measuring it. ' : '') + 'Any coder on the team can claim it from the queue.',
    TAG + w.key,
  ].join('\n');
}
/** the public face of a want row (functions/api/wants.js): a private want shows no number and no source beyond its kind */
export function publicWant(r) {
  const bot = byLane(r.lane);
  const base = { key: r.key, lane: r.lane, bot: bot ? bot.name : 'Verse', title: s(r.title, 140), state: r.state, filed: r.filed, met: r.met_at || null, thread: r.thread || null, reopened: r.reopened || 0, label: s(r.label, 80), better: r.better };
  if (r.private) return { ...base, private: true, baseline: null, latest: null, cite: [] };
  let cite = []; try { const v = JSON.parse(r.cite || '[]'); cite = (Array.isArray(v) ? v : []).filter((c) => c && /^https:\/\//.test(c.url || '')).slice(0, 3); } catch (_) { cite = []; }
  return { ...base, baseline: num(r.baseline), latest: num(r.latest), cite };
}

// ---- what each crew member's run reads and says (pure halves of lib/team-crew-run.js) ----

/** the internal links in a page's HTML: same-site paths only, no files, no anchors, deduped */
export function linksIn(html, max = 200) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#?]+)[^"']*["']/gi)) {
    let h = m[1].trim();
    if (/^https:\/\/(?:www\.)?a-to-mind\.com\//i.test(h)) h = h.replace(/^https:\/\/(?:www\.)?a-to-mind\.com/i, '');
    if (!h.startsWith('/') || h.startsWith('//') || h.startsWith('/api/') || /\.(?:png|jpe?g|gif|webp|svg|ico|mp3|mp4|webm|zip|pdf|xml|txt)$/i.test(h)) continue;
    out.add(h); if (out.size >= max) break;
  }
  return [...out];
}
/** a slice of a list that walks the whole list over runs (the run number picks the window) */
export const rotate = (list, n, run) => { const l = list || []; if (l.length <= n) return l.slice(); const at = (Math.max(0, run | 0) * n) % l.length; return l.slice(at, at + n).concat(l.slice(0, Math.max(0, at + n - l.length))); };
/** robots.txt -> its Sitemap: lines */
export const sitemapsIn = (robots) => [...String(robots || '').matchAll(/^\s*sitemap:\s*(https?:\/\/\S+)/gim)].map((m) => m[1]).slice(0, 10);
/** a sitemap -> { index: bool, locs: [url] } */
export function readSitemap(xml) {
  const t = String(xml || ''), index = /<sitemapindex\b/i.test(t);
  return { index, locs: [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&')).slice(0, 50000) };
}
/** urls -> the top sections of a site [{ section, pages }] (first path part) */
export function sectionsOf(urls, top = 8) {
  const n = new Map();
  for (const u of urls || []) { let p = ''; try { p = new URL(u).pathname.split('/').filter(Boolean)[0] || '/'; } catch (_) { continue; } p = s(decodeURIComponent(p.slice(0, 60)), 40); n.set(p, (n.get(p) || 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, top).map(([section, pages]) => ({ section, pages }));
}
/** an RSS or Atom feed -> [{ title, url }] newest first as listed */
export function feedItems(xml, max = 10) {
  const t = String(xml || ''), out = [];
  for (const m of t.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const b = m[0], title = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(b), link = /<link[^>]*href=["']([^"']+)["']/i.exec(b) || /<link>\s*([^<\s]+)\s*<\/link>/i.exec(b);
    if (title && link) out.push({ title: s(title[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, '\'').replace(/&quot;/g, '"'), 140), url: s(link[1], 300) });
    if (out.length >= max) break;
  }
  return out;
}
// where a browser feature could land on Verse (TechRadar): words in a release note's title -> a page
const FIT = [[/\bview transition/i, '/ (stage card swaps)'], [/\bwebgpu|\bgpu\b/i, '/paint/ and the 3D stage'], [/\bcss\b|anchor|scroll|container quer/i, 'every page\'s layout'],
  [/\bai\b|prompt|gemini|summari[sz]|translat|language model/i, '/translate/ and Verse\'s answers'], [/\bpasskey|credential|webauthn|fedcm/i, 'member sign-in'],
  [/\baudio|media|video|codec|webcodecs/i, '/music/ and /video/'], [/\bpwa|offline|service worker|install/i, 'offline mode (a Tower aspect)'],
  [/\bperformance|speed|lcp|inp\b|prerender|speculation/i, 'speed (a Tower aspect)'], [/\baccessib|aria/i, 'accessibility (a Tower aspect)'], [/\bshare|clipboard|file system/i, 'sharing (a Tower aspect)']];
export const fitOf = (title) => { const f = FIT.find(([re]) => re.test(String(title || ''))); return f ? f[1] : ''; };

/** what a promo calls a floor: its topic ("sports: x.com" -> sports), or for a floor named by its rival alone, the page and its mode */
export function topicOf(floor, page) {
  const f = s(floor, 80);
  if (!rivalOf(f) || f.includes(':')) return f.replace(/:.*$/, '').trim() + ' page';
  let u; try { u = new URL(page, 'https://a-to-mind.com'); } catch (_) { return 'page'; }
  const seg = u.pathname.split('/').filter(Boolean)[0] || 'home', mode = u.searchParams.get('mode');
  return (mode ? (mode.length <= 3 ? mode.toUpperCase() : mode) + ' ' : '') + seg.replace(/-/g, ' ');
}
/** Growth: promo drafts from what Verse just won on the Tower. -> [{ page, text, intent }] (the owner presses Post; nothing is sent) */
export function promosOf(tower, max = 3) {
  const floors = tower && tower.floors && typeof tower.floors === 'object' ? Object.entries(tower.floors) : [];
  const wins = [];
  for (const [f, rows] of floors) {
    if (towerMisses(rows).length) continue;
    const speed = rows && rows.speed, page = /Verse \((\/[^)\s]*)\)/.exec((speed && speed.evidence) || '');
    if (!speed || !page || !(num(speed.verse) > 0) || !(num(speed.best) > 0) || speed.best < speed.verse * 2) continue;
    wins.push({ f, page: page[1], x: Math.round(speed.best / speed.verse), verse: speed.verse, best: speed.best, at: Date.parse(speed.at) || 0 });
  }
  wins.sort((a, b) => b.at - a.at || b.x - a.x);
  return wins.slice(0, max).map((w) => {
    const text = 'Free, no signup: Verse\'s ' + topicOf(w.f, w.page) + ' loads in ' + w.verse + ' ms, ' + w.x + 'x faster than ' + (rivalOf(w.f) || 'the best site we measured') + ' (phone width, median of 3). https://a-to-mind.com' + w.page;
    return { page: w.page, floor: w.f, text, intent: 'https://x.com/intent/post?text=' + encodeURIComponent(text) };
  });
}
