// /tools/: the index of everything Verse does (owner, 2026-10-26: "whoever finally finds us cant believe we cover literally everything on the internet
// in one site"). Every page of the sitemap and every skill of the stage, grouped by what people want to do, searchable as you type on the device, with the
// count shown big (pages, skills, sites beaten) and, on each page, the sites it beat (the tower). Generated from what already knows: the sitemap's page
// list (tools/sitemap.mjs pages()), each page's own title and description, the tool names (lib/toolkit.js TOOLS and PAGES), the skill families
// (skills/families.json), the skills (skills/index.json) and what each does (skills/what.json), and the tower (lib/tower.js tower()). So a new page or a
// new skill is in the index at the next deploy without anyone touching it (refresh.mjs runs this; checks.mjs 'everything' fails when a sitemap page is not in it).
//   node tools/everything.mjs           write void-live-deploy/tools/index.html
//   node tools/everything.mjs --check   exit 1 when the committed page differs from what it would write (refresh.mjs: volatile, the tower moves)
//   node tools/everything.mjs --og      also draw og/tools.png (Chromium; by hand when the words change)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages as sitemapPages } from './sitemap.mjs';
import { TOOLS, PAGES } from '../void-live-deploy/lib/toolkit.js';
import { tower } from '../void-live-deploy/lib/tower.js';
import { isIt } from '../void-live-deploy/skills/is-it.js';
import { seoOf } from './seo-pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), D = resolve(root, 'void-live-deploy');
export const OUT = 'void-live-deploy/tools/index.html';
const read = (f) => { try { return readFileSync(resolve(D, f), 'utf8'); } catch (_) { return ''; } };
const json = (f, d) => { try { return JSON.parse(read(f)); } catch (_) { return d; } };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unent = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// what people want to do, in the order a visitor scans for it; a page goes to the first group whose test it meets, anything new to "More"
export const GROUPS = [
  ['Plan a trip', (p) => p.startsWith('/flights/')],
  ['Keep track of time', (p) => ['/calendar/', '/time/', '/stopwatch/', '/weather/'].includes(p) || p.startsWith('/is-it/')],
  ['Get work organised', (p) => p.startsWith('/kanban/') || p === '/notes/'],
  ['Write, read and translate', (p) => ['/word-count/', '/translate/', '/news/', '/podcasts/', '/generators/', '/boards/'].includes(p)],
  ['Work with PDFs', (p) => p.startsWith('/pdf/')],
  ['Edit photos and pictures', (p) => p.startsWith('/photos/') || ['/resize-image/', '/image/', '/color/', '/gradient/'].includes(p)],
  ['Count, convert and calculate', (p) => ['/calculator/', '/convert/', '/base-converter/', '/base64/', '/markets/'].includes(p)],
  ['Pick at random', (p) => ['/wheel/', '/random/', '/flip/', '/random-user/'].includes(p)],
  ['Stay safe online', (p) => ['/password/', '/password-strength/'].includes(p)],
  ['Make music', (p) => ['/music/', '/metronome/', '/piano/', '/tuner/', '/bpm/', '/chords/'].includes(p)],
  ['Cook', (p) => p === '/recipes/'],
  ['Follow sport', (p) => ['/scores/', '/sports/', '/fantasy/'].includes(p)],
  ['Fix an automation or code', (p) => p.startsWith('/fix/') || ['/one-time-fix/', '/keep-it-running/', '/full-stack-audit/', '/first-automation-setup/', '/code-review/', '/cheat-codes/'].includes(p)],
  ['Verse itself', (p) => ['/', '/store/', '/conquered/', '/compare/', '/llms.txt', '/tools/'].includes(p)],
];
export const groupOf = (path) => (GROUPS.find(([, t]) => t(path)) || ['More'])[0];

/** the first sentence of a description, never cut mid-sentence (no ellipsis): a long one stops at its first colon or semicolon. Pure. */
export function blurbOf(desc) {
  let s = unent(desc).replace(/\s+/g, ' ').trim(); const m = /^(.{20,}?[.!?])(?:\s|$)/.exec(s); if (m) s = m[1];
  if (s.length > 170) { const c = s.search(/[:;](?=\s)/); if (c > 30) s = s.slice(0, c) + '.'; }
  return s;
}
const metaOf = (html, name) => (new RegExp('<meta (?:name|property)="' + name + '" content="([^"]*)"').exec(html) || [])[1] || '';
const titleOf = (html) => unent(((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '').replace(/\s*·\s*Verse\s*$/, '').trim());
const pathOf = (u) => { try { return new URL(u, 'https://a-to-mind.com').pathname; } catch (_) { return ''; } };

/** every page of the sitemap as { path, name, blurb, group, beats: [site] }, in the sitemap's order. */
export function pageEntries({ list = sitemapPages({ fixPages: json('../tools/fix-pages.json', []) }), beaten = [] } = {}) {
  const beatsOf = new Map(); for (const f of beaten) { const p = pathOf(f.page); if (!p) continue; if (!beatsOf.has(p)) beatsOf.set(p, []); if (!beatsOf.get(p).includes(f.site)) beatsOf.get(p).push(f.site); }
  return list.map(({ loc }) => {
    let name = TOOLS[loc] || PAGES[loc] || '', blurb = '';
    if (loc.startsWith('/is-it/')) { const a = isIt('is it ' + loc.slice(7).replace(/-/g, ' ')); name = 'Is it ' + (a ? a.what : loc.slice(7).replace(/-/g, ' ')) + '?'; blurb = 'One giant yes or no, by your own clock, with a feed.'; }
    else if (loc === '/llms.txt') { name = name || 'Verse for AI agents'; blurb = 'What Verse is and does, in plain text for assistants and agents.'; }
    else { const html = read(loc.slice(1) + 'index.html'); name = loc === '/' ? 'Ask Verse anything' : name || titleOf(html) || loc; blurb = blurbOf(metaOf(html, 'description') || metaOf(html, 'og:description')); }
    return { path: loc, name, blurb, group: groupOf(loc), beats: beatsOf.get(loc) || [] };
  });
}
/** the stage's skills by family: [{ name, for, skills: [{ name, ask, what }] }], every skill of skills/index.json once (one with no family goes to "More"). */
export function skillFamilies({ fams = json('skills/families.json', {}).families || [], index = json('skills/index.json', []), what = json('skills/what.json', {}) } = {}) {
  const live = new Set(index), seen = new Set();
  const one = (n) => { const w = unent(what[n] || '').replace(/…/g, '').trim(), q = /^"([^"]{3,60})"/.exec(w); seen.add(n); return { name: n, ask: q ? q[1] : n.replace(/-/g, ' '), what: w.replace(/^(?:"[^"]*",?\s*)+:?\s*/, '') }; };
  const out = fams.map((f) => ({ name: f.name, for: f.for, skills: (f.skills || []).map((s) => s.name).filter((n) => live.has(n) && !seen.has(n)).map(one) })).filter((f) => f.skills.length);
  const rest = index.filter((n) => !seen.has(n)); if (rest.length) out.push({ name: 'More', for: 'everything else the stage answers', skills: rest.map(one) });
  return out;
}
const human = (n) => n.replace(/-/g, ' ');

/** the page. Pure given its inputs. */
export function render({ entries, fams, beatenCount, skillCount }) {
  const groups = [...new Set([...GROUPS.map(([g]) => g), 'More'])].map((g) => [g, entries.filter((e) => e.group === g)]).filter(([, l]) => l.length);
  const bench = new Set(Object.keys(TOOLS));
  const li = (e) => '<li data-s="' + esc((e.name + ' ' + e.blurb + ' ' + e.path + ' ' + e.beats.join(' ')).toLowerCase()) + '"><a href="' + esc(e.path) + '">' + esc(e.name) + '</a>'
    + (e.blurb ? '<span>' + esc(e.blurb) + '</span>' : '') + (e.beats.length ? '<em>Beats ' + esc(e.beats.slice(0, 3).join(', ')) + (e.beats.length > 3 ? ' and ' + (e.beats.length - 3) + ' more' : '') + '</em>' : '')
    + (bench.has(e.path) && e.path !== '/tools/' ? '<button type="button" data-open="' + esc(e.path) + '">Open here</button>' : '') + '</li>';
  const pagesHtml = groups.map(([g, l]) => '<section><h2>' + esc(g) + ' <small>' + l.length + '</small></h2><ul>' + l.map(li).join('') + '</ul></section>').join('\n');
  const chip = (s) => '<li class="k" data-s="' + esc((human(s.name) + ' ' + s.ask + ' ' + s.what).toLowerCase()) + '"><a href="/?q=' + esc(encodeURIComponent(s.ask)) + '"' + (s.what ? ' title="' + esc(s.what) + '"' : '') + '>' + esc(human(s.name)) + '</a></li>';
  const skillsHtml = fams.map((f) => '<section class="fam"><h2>' + esc(f.name) + ' <small>' + f.skills.length + '</small></h2><p class="for">' + esc(f.for) + '</p><ul class="chips">' + f.skills.map(chip).join('') + '</ul></section>').join('\n');
  const n = entries.length, desc = 'Everything Verse does in one place: ' + n + ' pages and ' + skillCount + ' skills, grouped by what you want to do and searchable as you type, with the ' + beatenCount + ' sites they beat. Free, private, no account.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Everything Verse does</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="https://a-to-mind.com/tools/">
<meta property="og:type" content="website"><meta property="og:site_name" content="Verse"><meta property="og:title" content="Everything Verse does"><meta property="og:description" content="${esc(n + ' tools, ' + skillCount + ' skills, ' + beatenCount + ' sites beaten. Search them all as you type.')}"><meta property="og:url" content="https://a-to-mind.com/tools/"><meta property="og:image" content="https://a-to-mind.com/og/tools.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<style>
  :root{--bg:#0b0b12;--ink:#f1f1f6;--soft:#a9a9b8;--line:#2a2a38;--accent:#6d4aff}html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:960px;margin:0 auto;padding:20px 16px 40px;box-sizing:border-box}h1{font-size:28px;margin:8px 0 2px}.lead{color:var(--soft);margin:0 0 10px}
  .count{display:flex;flex-wrap:wrap;gap:4px 18px;margin:6px 0 14px;font-size:15px;color:var(--soft)}.count b{display:block;font-size:44px;line-height:1.05;color:var(--ink);font-weight:800;letter-spacing:-.02em}
  .find{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0;display:flex;gap:8px;align-items:center}.find input{flex:1;min-width:0;font:inherit;font-size:17px;min-height:46px;box-sizing:border-box;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:transparent;color:inherit}.find input:focus{outline:2px solid var(--accent);outline-offset:1px}
  .find button{font:inherit;font-size:14px;min-height:46px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:none;color:inherit;cursor:pointer}#hits{color:var(--soft);font-size:14px;min-height:21px;margin:0 0 6px}
  section{margin:16px 0}h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);margin:0 0 6px}h2 small{letter-spacing:0;font-size:12px;opacity:.8}h3{font-size:20px;margin:28px 0 4px}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
  li{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}li a{color:var(--ink);font-weight:600;text-decoration:none;min-height:32px;display:flex;align-items:center}li a:hover{color:var(--accent)}li span{color:var(--soft);font-size:14px}li em{font-style:normal;font-size:13px;color:#8fd19e}
  li button{font:inherit;font-size:13px;align-self:flex-start;margin-top:4px;color:var(--ink);background:none;border:1px solid var(--line);border-radius:999px;padding:4px 12px;min-height:34px;cursor:pointer}li button:hover{border-color:var(--accent)}
  ul.chips{display:flex;flex-wrap:wrap;gap:6px}li.k{padding:0;border-radius:999px}li.k a{font-weight:500;font-size:14px;padding:4px 12px;min-height:34px}.for{color:var(--soft);font-size:14px;margin:0 0 8px}
  [hidden]{display:none!important}.none{color:var(--soft)}footer{color:var(--soft);font-size:13px;margin-top:20px}footer a{color:var(--ink)}
  @media (prefers-color-scheme:light){:root{--bg:#fff;--ink:#111;--soft:#555;--line:#ddd}li em{color:#1e7a3a}}
  .bench{display:none;gap:10px;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));margin:0 0 18px}.bench.on{display:grid}
  .pane{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;min-height:420px;resize:vertical}
  .pane header{display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid var(--line);font-size:13px}.pane header b{flex:1;font-weight:600}.pane header a,.pane header button{font:inherit;font-size:12px;color:var(--soft);background:none;border:1px solid var(--line);border-radius:999px;padding:4px 10px;min-height:32px;cursor:pointer;text-decoration:none}
  .pane iframe{flex:1;border:0;width:100%;background:#fff}
</style>
</head>
<body>
<main>
  <h1>Everything Verse does</h1>
  <p class="lead">Every page and every skill in one place, grouped by what you want to do. Free, private, no account; each page opens offline after one visit.</p>
  <p class="count"><span><b>${n}</b>tools</span><span><b>${skillCount}</b>skills</span><span><b>${beatenCount}</b>sites beaten</span></p>
  <form class="find" role="search" onsubmit="return false"><input type="search" id="q" placeholder="Search everything: pdf, flight, calendar, password" aria-label="Search everything Verse does" autocomplete="off" enterkeyhint="search"><button type="button" id="share">Share link</button></form>
  <p id="hits" role="status"></p>
  <div class="bench" id="bench" aria-label="Open tools"></div>
${pagesHtml}
  <h3 id="skills">Ask the stage <small>${skillCount} skills</small></h3>
  <p class="lead">Type any of these on <a href="/" style="color:inherit">the stage</a> and Verse answers with a card; each link asks it for you.</p>
${skillsHtml}
  <p class="none" id="none" hidden>Nothing here by that name yet. <a href="/" id="ask" style="color:inherit">Ask Verse for it on the stage</a>: what nobody has built becomes work for Verse.</p>
  <nav id="related" aria-label="Related tools"></nav>
  <footer>Nothing you type leaves this device on any of them. Made from the sitemap, the skills and the tower, so it grows with every page. <a href="/conquered/">Every site Verse has beaten</a> · <a href="/">Ask Verse anything</a></footer>
</main>
<script>
  // the search, on the device, as you type: a card stays when every word is in its name, words, path or the sites it beats; ?q= carries it in a link
  (function () {
    var q = document.getElementById('q'), hits = document.getElementById('hits'), items = [].slice.call(document.querySelectorAll('main li[data-s]')), secs = [].slice.call(document.querySelectorAll('main section'));
    function run() {
      var w = q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean), n = 0;
      items.forEach(function (li) { var s = li.getAttribute('data-s'), on = w.every(function (x) { return s.indexOf(x) >= 0; }); li.hidden = !on; if (on) n++; });
      secs.forEach(function (s) { s.hidden = !s.querySelector('li:not([hidden])'); });
      document.getElementById('skills').hidden = w.length > 0 && !document.querySelector('section.fam:not([hidden])');
      hits.textContent = w.length ? n + (n === 1 ? ' match' : ' matches') : '';
      var none = document.getElementById('none'); none.hidden = !w.length || n > 0; document.getElementById('ask').href = '/?q=' + encodeURIComponent(q.value.trim());
      try { history.replaceState(null, '', location.pathname + (q.value.trim() ? '?q=' + encodeURIComponent(q.value.trim()) : '') + location.hash); } catch (e) {}
    }
    var s0 = new URLSearchParams(location.search).get('q'); if (s0) { q.value = s0; run(); }
    q.addEventListener('input', run);
    addEventListener('keydown', function (e) { if (e.key === '/' && document.activeElement !== q && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
    document.getElementById('share').addEventListener('click', function () { var b = this, u = location.href; (navigator.share ? navigator.share({ title: document.title, url: u }) : navigator.clipboard.writeText(u).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Share link'; }, 1400); })).catch(function () {}); });
  })();
</script>
<script type="module">
  // the bench (owner, 2026-10-25: "the kit should allow for use of all pages simultaneously if needed"): each open tool is its own page in a pane,
  // same origin, so it keeps its own state and offline cache; ?open=calculator,convert keeps the set in the address
  const bench = document.getElementById('bench'), names = Object.fromEntries([...document.querySelectorAll('main li a')].map((a) => [a.getAttribute('href'), a.textContent]));
  const open = () => [...bench.querySelectorAll('.pane')].map((p) => p.dataset.path.replace(/^\\//, '').replace(/\\/$/, ''));
  const keep = () => { const q = open(), u = new URL(location.href); if (q.length) u.searchParams.set('open', q.join(',')); else u.searchParams.delete('open'); try { history.replaceState(null, '', u.pathname + u.search); } catch (_) {} bench.classList.toggle('on', q.length > 0); };
  function add(path) { if (!names[path] || bench.querySelector('.pane[data-path="' + path + '"]')) return; const pane = document.createElement('section'); pane.className = 'pane'; pane.dataset.path = path;
    const head = document.createElement('header'); const b = document.createElement('b'); b.textContent = names[path]; const full = document.createElement('a'); full.href = path; full.textContent = 'Full page'; const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Close'; x.setAttribute('aria-label', 'Close ' + names[path]); x.onclick = () => { pane.remove(); keep(); };
    head.append(b, full, x); const f = document.createElement('iframe'); f.src = path; f.title = names[path]; f.loading = 'lazy'; pane.append(head, f); bench.append(pane); keep(); pane.scrollIntoView({ block: 'nearest' }); }
  for (const btn of document.querySelectorAll('button[data-open]')) btn.addEventListener('click', () => add(btn.dataset.open));
  for (const p of (new URLSearchParams(location.search).get('open') || '').split(',').map((x) => x.trim()).filter(Boolean)) { const q = '/' + p.replace(/^\\//, '').replace(/\\/$/, ''); add(names[q + '/'] ? q + '/' : q); }
  addEventListener('load', () => { import('/lib/toolkit.js').then((m) => m.mountRelated(document.getElementById('related'), '/tools/')).catch(() => {}); });
</script>
<script>if ("serviceWorker" in navigator) addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });</script>
</body>
</html>
`;
}

export function build() {
  const t = tower(json('lap.items.json', {}).onlySite || [], json('tower.evidence.json', {}).floors || {}, json('tower.frontier.json', null));
  const beaten = t.floors.filter((f) => f.beaten);
  const entries = pageEntries({ beaten }), fams = skillFamilies();
  // the canonical stays ours; the JSON-LD and the common asks come from lib/seo.js like every tool page's (tools/seo-pages.mjs), so the two generators agree
  return seoOf(render({ entries, fams, beatenCount: t.beaten, skillCount: json('skills/index.json', []).length }), '/tools/');
}
/** the sitemap pages missing from an index page's links (checks.mjs 'everything'). Pure. */
export function missingFrom(html, locs) { const have = new Set([...String(html).matchAll(/<li data-s="[^"]*"><a href="([^"]+)"/g)].map((m) => m[1])); return locs.filter((l) => !have.has(l)); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = build(), file = resolve(root, OUT);
  if (process.argv.includes('--check')) {
    const have = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (have !== html) { console.error('tools/index.html is stale (node tools/everything.mjs)'); process.exit(1); }
    console.log('ok: tools/index.html is current');
  } else {
    writeFileSync(file, html); console.log('wrote ' + OUT + ' (' + Math.round(html.length / 1024) + ' KB)');
    if (process.argv.includes('--og')) {
      const { chromium } = await import('playwright-core');
      const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => existsSync(x));
      const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
      await p.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#14121c 0%,#2a2150 100%);color:#ecebf5;font-family:system-ui,Segoe UI,Arial,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;left:64px;top:56px;font-size:30px;color:#a58bff;font-weight:700;letter-spacing:.04em">VERSE</div>
<div style="position:absolute;left:64px;top:120px;width:1070px;font-size:104px;font-weight:800;line-height:1.02">Everything Verse does</div>
<div style="position:absolute;left:64px;top:360px;width:1070px;font-size:40px;line-height:1.25;color:#d9d6e8">Every tool, every skill and every site it beat, on one page you can search as you type.</div>
<div style="position:absolute;left:64px;bottom:36px;width:800px;font-size:24px;color:#a3a0b3">On your device. No account. Works offline.</div>
<div style="position:absolute;right:64px;bottom:36px;font-size:26px;color:#a58bff;font-weight:700">a-to-mind.com</div></body></html>`);
      await p.screenshot({ path: resolve(D, 'og/tools.png') }); await b.close(); console.log('wrote og/tools.png');
    }
  }
}
