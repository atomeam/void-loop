/**
 * guide skill — the book: everything V01D can do, one page each, that you flip through like a strategy guide. "open the book",
 * "the guide", "show me everything you can do", "the book at chess". A two-page spread (one page on a phone) with chapter tabs
 * down the edge, arrows, the ← and → keys and a swipe to turn, a running page number, a contents page and an index at the back.
 * Every page carries a one-line "what it does", two or three asks to tap (they run on the stage), its rating and a glyph.
 * The pages come from one file, skills/guide.json, written by tools/guide.mjs from the site's own data (skills/index.json,
 * each skill's own header and examples, skills/families.json, the rack's games, skills/mini/), so no skill can be left out:
 * tools/checks.mjs fails when the file is stale. The owner, 2026-10-16: "a book you could flip through that contains
 * everything so you don't have to search ... like a BradyGames or Prima strategy guide". No network beyond the site's own JSON.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { glyphSvg, openerSvg, spreadOf, pagesOfSpread, TIERS, TIER_MEANING } from '../lib/guide.js';

const BOOK_WORDS = '(?:book|guide|manual|handbook|strategy guide|book of everything|book of all)';
const OPEN = '(?:(?:open|show(?:\\s+me)?|read|flip through|browse|bring|summon|let me see|see|get)\\s+(?:up\\s+)?)?';
const WHOSE = '(?:the\\s+|your\\s+|v01d\\s*\'?s?\\s+|void\\s*\'?s?\\s+|a-to-mind\'?s?\\s+)';
const RE_BOOK = new RegExp('^' + OPEN + '(?:' + WHOSE + '(?:v01d\\s+|void\\s+)?' + BOOK_WORDS + '|(?:v01d|void)\\s+' + BOOK_WORDS + '|strategy guide|handbook|book of everything)(?:\\s+of\\s+everything(?:\\s+(?:you|it|v01d|void)\\s+can\\s+do)?)?(?:\\s+please)?$', 'i'); // a bare "book" or "guide" stays a word or a book search
const RE_AT = new RegExp('^' + OPEN + WHOSE + '(?:v01d\\s+|void\\s+)?' + BOOK_WORDS + '\\s+(?:at|on|to|for|about)\\s+(?:the\\s+)?([a-z0-9][a-z0-9 \'-]{1,40})$', 'i');
const RE_ALL = /^(?:(?:show|tell)\s+me\s+|list\s+|i want to see\s+|what(?:'s| is|s)\s+)?(?:everything|all(?: the things)?|every single thing)\s+(?:that\s+)?(?:you|void|v01d|it)\s+(?:can|could)\s+do(?:,?\s+(?:all of it|in one place))?(?:\s+please)?$/i;
const RE_MORE = /^(?:(?:what's|whats|what is)\s+in\s+the\s+(?:book|guide)|(?:the\s+)?table\s+of\s+contents|(?:show\s+me\s+)?(?:the\s+)?(?:whole|complete|full)\s+(?:list|guide|book|manual)(?:\s+of\s+(?:skills|everything))?|every\s+skill(?:\s+(?:you|void|v01d)\s+(?:have|has))?|(?:the\s+)?(?:v01d|void)\s+(?:book|guide|manual|handbook))$/i;

/** { at } for an ask that opens the book (at: a name to open it on, or ''), null otherwise. Pure. */
export function guideOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  const at = RE_AT.exec(t);
  if (at) return { at: at[1].trim() };
  if (RE_BOOK.test(t) || RE_ALL.test(t) || RE_MORE.test(t)) return { at: '' };
  return null;
}

const CSS = '.vbook{width:min(940px,calc(100vw - 24px))!important;max-height:calc(100vh - 110px)!important;padding:16px 18px 12px!important;display:flex;flex-direction:column;font-size:var(--fs-s,13px);color:var(--ink,#e9ebf2)}'
  + '.vbook h2{font-size:18px;margin:0}.vbook .gb-top{display:flex;align-items:baseline;gap:12px;margin-bottom:8px}.vbook .gb-top .sub{margin:0}'
  + '.vbook .gb-body{display:flex;gap:10px;min-height:0;flex:1}.vbook .gb-tabs{display:flex;flex-direction:column;gap:3px;width:118px;flex:none;overflow:auto;padding-right:2px}'
  + '.vbook .gb-tab{background:none;border:1px solid rgba(255,255,255,.08);color:var(--ink-3,#8b90a0);border-radius:8px;padding:5px 8px;text-align:left;font:inherit;font-size:12px;cursor:pointer;line-height:1.2}'
  + '.vbook .gb-tab.on{color:var(--ink,#e9ebf2);border-color:rgba(150,175,255,.45);background:rgba(150,175,255,.10)}.vbook .gb-tab:hover{color:var(--ink,#e9ebf2)}'
  + '.vbook .gb-spread{display:flex;gap:14px;flex:1;min-width:0;min-height:300px;position:relative}'
  + '.vbook .gb-page{flex:1;min-width:0;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px 12px;background:linear-gradient(170deg,rgba(255,255,255,.035),rgba(255,255,255,.01));position:relative;display:flex;flex-direction:column}'
  + '.vbook .gb-page.gb-left{box-shadow:inset -14px 0 24px -20px rgba(0,0,0,.8)}.vbook .gb-page.gb-right{box-shadow:inset 14px 0 24px -20px rgba(0,0,0,.8)}.vbook .gb-page.gb-blank{border-style:dashed;opacity:.35}'
  + '.vbook .gb-page h3{margin:0;font-size:17px;font-weight:500;color:var(--ink,#e9ebf2)}.vbook .gb-page h3 small{font-weight:400;color:var(--ink-3,#8b90a0);font-size:12px;margin-left:8px}'
  + '.vbook .gb-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#8b90a0);margin-bottom:6px}'
  + '.vbook .gb-head{display:flex;gap:12px;align-items:flex-start}.vbook .gb-head .gglyph{flex:none}'
  + '.vbook .gb-line{margin:8px 0 10px;color:var(--ink-2,#b9bdcb);line-height:1.45}.vbook p{color:var(--ink-2,#b9bdcb);margin:0 0 8px;line-height:1.45}'
  + '.vbook .gb-try{margin:0;padding:0;list-style:none}.vbook .gb-try li{margin:3px 0}.vbook .gb-try a,.vbook a.gjump{color:var(--ink,#e9ebf2);text-decoration:none;border-bottom:1px dotted rgba(255,255,255,.3)}.vbook .gb-try a::before{content:"› ";color:var(--ink-3,#8b90a0)}'
  + '.vbook .gb-try a:hover,.vbook a.gjump:hover{border-bottom-color:currentColor}.vbook .gb-sub{font-size:12px;color:var(--ink-3,#8b90a0);margin:4px 0 6px}'
  + '.vbook .gb-tier{display:inline-block;align-self:flex-start;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.18);color:var(--ink-2,#b9bdcb);margin-top:auto}'
  + '.vbook .gb-tier-proven{border-color:rgba(120,220,160,.6);color:#bdf0d0}.vbook .gb-tier-checked{border-color:rgba(150,175,255,.6);color:#cfdaff}.vbook .gb-tier-tested{border-color:rgba(240,210,120,.55);color:#f3e2b0}.vbook .gb-tier-experiment{border-color:rgba(255,255,255,.2)}'
  + '.vbook .gb-foot{margin-top:auto;padding-top:8px;font-size:11px;color:var(--ink-3,#8b90a0);display:flex;justify-content:space-between}'
  + '.vbook .gopener{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:8px 0}.vbook .gopener a{display:flex;justify-content:center;border-radius:8px;border-bottom:0}.vbook .gopener a:hover{background:rgba(255,255,255,.06)}'
  + '.vbook .gb-cover{align-items:center;text-align:center;justify-content:center}.vbook .gb-cover h3{font-size:26px;margin-top:10px}.vbook .gb-cover .gopener{grid-template-columns:repeat(6,1fr)}'
  + '.vbook .gb-list{columns:2;column-gap:14px;margin:0;padding:0;list-style:none;font-size:12px}.vbook .gb-list li{display:flex;justify-content:space-between;gap:6px;margin:2px 0;break-inside:avoid}.vbook .gb-list li .n{color:var(--ink-3,#8b90a0)}'
  + '.vbook .gb-toc li{font-size:13px}.vbook .gb-legend dt{color:var(--ink,#e9ebf2);margin-top:6px}.vbook .gb-legend dd{margin:0;color:var(--ink-2,#b9bdcb)}'
  + '.vbook .gb-nav{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:10px}.vbook .gb-nav button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:var(--ink,#e9ebf2);border-radius:999px;width:38px;height:32px;font:inherit;font-size:16px;cursor:pointer}'
  + '.vbook .gb-nav button:disabled{opacity:.3;cursor:default}.vbook .gb-num{font-size:12px;color:var(--ink-3,#8b90a0);min-width:150px;text-align:center}'
  + '.vbook .gb-3d{flex:1;min-width:0;height:clamp(320px,60vh,540px);position:relative;border-radius:12px;overflow:hidden;background:radial-gradient(120% 90% at 50% 30%,#1c2236,#0a0d18)}.vbook .gb-3d .void-mini{width:100%;height:100%}'
  + '.vbook.gb-flat .gb-3d{display:none}.vbook:not(.gb-flat) .gb-spread{display:none}.vbook .gb-view{background:none;border:1px solid rgba(255,255,255,.14);color:var(--ink-3,#8b90a0);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;margin-left:auto}.vbook .gb-view:hover{color:var(--ink,#e9ebf2)}'
  + '@media (max-width:700px){.vbook{padding:12px 10px 10px!important;max-height:calc(100vh - 90px)!important}.vbook .gb-body{flex-direction:column}.vbook .gb-tabs{flex-direction:row;width:auto;overflow-x:auto;padding-bottom:4px}.vbook .gb-tab{white-space:nowrap}.vbook .gb-spread{min-height:0}.vbook .gb-list{columns:1}.vbook .gb-cover .gopener,.vbook .gopener{grid-template-columns:repeat(4,1fr)}}';

const chapterOf = (book, id) => (book.chapters || []).find((c) => c.id === id) || {};
const jump = (n, label, esc) => '<a href="#" class="gjump" data-page="' + n + '">' + esc(label) + '</a>';
const tries = (p, esc) => (p.examples && p.examples.length ? '<div class="gb-sub">Try it: tap one</div><ul class="gb-try">' + p.examples.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>' : '');
const tier = (p, esc) => (p.tier ? '<span class="gb-tier gb-tier-' + esc(p.tier) + '" title="' + esc(p.why || '') + '">' + esc(p.tier) + '</span>' : '');

/** the contents: every chapter with its first page, as jumps. Pure. */
export function tocHtml(book, esc) {
  return '<ul class="gb-toc gb-try">' + (book.chapters || []).filter((c) => c.id !== 'front').map((c) => '<li>' + jump(c.from, c.name, esc) + ' <span class="n">· pages ' + c.from + '–' + c.to + (c.for ? ' · ' + esc(c.for) : '') + '</span></li>').join('') + '</ul>';
}

/** one page's HTML. Pure. */
export function pageHtml(p, book, esc) {
  const t = book.totals || {}, chap = chapterOf(book, p.chapter);
  const foot = '<div class="gb-foot"><span>' + esc(chap.name || '') + '</span><span>' + p.n + '</span></div>';
  if (p.kind === 'cover') {
    const firsts = (book.chapters || []).filter((c) => c.kind === 'family' || c.kind === 'games').map((c) => book.pages.slice(c.from, c.to).find((x) => x.kind === 'skill')).filter(Boolean);
    return '<div class="gb-kicker">a-to-mind.com</div>' + openerSvg({ skills: firsts.map((x) => x.name) }, book, 12) + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.line) + '</p>'
      + '<p class="gb-sub">' + t.skills + ' skills · ' + t.games + ' games · ' + t.minis + ' 3D miniatures · ' + t.pages + ' pages</p><p class="gb-sub">Turn with the arrows, ← →, or a swipe.</p>' + foot;
  }
  if (p.kind === 'how') {
    return '<div class="gb-kicker">Start here</div><h3>' + esc(p.title) + '</h3><p class="gb-line">The stage is the dark space behind this book. The box at the bottom is where you ask, in plain words. '
      + 'Say what you want and it appears on the stage: a card you can read, a thing you can drag, a board you can play on.</p><p>Esc or a tap on the void closes a card. Tap any ask in this book to run it.</p>'
      + (p.core || []).map((c) => '<div class="gb-sub"><b>' + esc(c.name) + '</b> · ' + esc(c.line) + '</div><ul class="gb-try">' + c.examples.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>').join('') + foot;
  }
  if (p.kind === 'legend') {
    return '<div class="gb-kicker">Start here</div><h3>' + esc(p.title) + '</h3><p class="gb-line">Each page is one thing V01D does: its name, one line on what it does, two or three asks to tap, and a rating.</p>'
      + '<p>The rating is earned from evidence, never claimed:</p><dl class="gb-legend">' + TIERS.slice().reverse().map((k) => '<dt><span class="gb-tier gb-tier-' + k + '">' + k + '</span></dt><dd>' + esc(TIER_MEANING[k]) + '</dd>').join('') + '</dl>'
      + '<p class="gb-sub">A page with a box on it is a game on the rack; a page marked 3D is a miniature a card carries.</p>' + foot;
  }
  if (p.kind === 'toc') return '<div class="gb-kicker">Start here</div><h3>' + esc(p.title) + '</h3>' + tocHtml(book, esc) + foot;
  if (p.kind === 'opener') {
    const n = (p.skills || []).length, counts = chap.count ? TIERS.slice().reverse().filter((k) => chap.count[k]).map((k) => chap.count[k] + ' ' + k).join(' · ') : '';
    return '<div class="gb-kicker">Chapter</div><h3>' + esc(p.title) + '</h3><p class="gb-line">' + esc(p.line || '') + '</p>' + openerSvg(p, book, 16)
      + '<p class="gb-sub">' + n + (p.chapter === 'minis' ? ' miniatures' : ' skills') + (counts ? ' · ' + counts : '') + ' · pages ' + chap.from + '–' + chap.to + '</p>' + foot;
  }
  if (p.kind === 'index') {
    return '<div class="gb-kicker">Index</div><h3>' + esc(p.title) + '</h3><ul class="gb-list">' + (p.entries || []).map((e) => '<li>' + jump(e.page, e.name, esc) + '<span class="n">' + e.page + '</span></li>').join('') + '</ul>' + foot;
  }
  // a skill, a boxed game, a miniature
  const kicker = p.kind === 'mini' ? '3D miniature' : p.game ? 'On the rack' : (chap.name || '');
  const sub = p.kind === 'skill' && p.game && p.name !== p.title.toLowerCase() ? '<small>' + esc(p.name) + '</small>' : p.kind === 'mini' ? '<small>3D</small>' : '';
  let body = '<div class="gb-kicker">' + esc(kicker) + '</div><div class="gb-head">' + glyphSvg(p, 72) + '<div><h3>' + esc(p.title) + sub + '</h3><p class="gb-line">' + esc(p.line || '') + '</p></div></div>';
  if (p.kind === 'mini' && p.ownerPage) body += '<p class="gb-sub">Carried by the ' + jump(p.ownerPage, (p.card || p.owner) + ' card, page ' + p.ownerPage, esc) + '.</p>';
  else if (p.kind === 'mini' && p.card) body += '<p class="gb-sub">Carried by ' + esc(p.card) + '.</p>';
  body += tries(p, esc);
  return body + tier(p, esc) + foot;
}

let BOOK = null;
async function load() {
  if (BOOK) return BOOK;
  const r = await fetch('/skills/guide.json', { cache: 'force-cache' });
  if (!r.ok) throw new Error('guide.json ' + r.status);
  BOOK = await r.json();
  return BOOK;
}

const KEY = 'a2m.void.book.v1'; // the page you were on, this browser only
const readKept = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch (_) { return 0; } };
const keep = (n) => { try { localStorage.setItem(KEY, String(n)); } catch (_) {} };

/** the page a name opens the book on: a skill, a game box, a chapter or a miniature; 0 when nothing matches. Pure. */
export function pageFor(book, name) {
  const q = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return 0;
  const c = (book.chapters || []).find((x) => x.name.toLowerCase() === q || x.id === q); if (c) return c.from;
  const hit = (f) => (book.pages || []).find(f);
  const p = hit((x) => x.kind === 'skill' && (x.name === q || x.title.toLowerCase() === q || x.name === q.replace(/ /g, '-')))
    || hit((x) => x.game && x.game.title.toLowerCase() === q) || hit((x) => x.kind === 'game' && x.name === q)
    || hit((x) => x.kind === 'mini' && x.name === q.replace(/\s*\(3d\)$/, '').replace(/ /g, '-'))
    || hit((x) => (x.kind === 'skill' || x.kind === 'game') && (x.title.toLowerCase().includes(q) || (x.examples || []).some((e) => e.toLowerCase() === q)));
  return p ? p.n : 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const want = guideOf(text) || { at: '' };
  const el = showPage((p) => { p.classList.add('vbook'); p.innerHTML = '<style>' + CSS + '</style><div class="gb-top"><h2>The V01D Book</h2><span class="sub">opening…</span></div>'; });
  if (!el) return 'guide';
  load().then((book) => {
    if (!api._pageStill(el)) return;
    const total = book.pages.length, onePage = () => window.matchMedia('(max-width: 700px)').matches;
    let cur = (want.at && pageFor(book, want.at)) || Math.min(Math.max(readKept(), 1), total) || 1;
    el.innerHTML = '<style>' + CSS + '</style><div class="gb-top"><h2>The V01D Book</h2><span class="sub">' + book.totals.skills + ' skills · ' + book.totals.games + ' games · ' + book.totals.minis + ' miniatures · nothing left out</span><button type="button" class="gb-view" hidden></button></div>'
      + '<div class="gb-body"><nav class="gb-tabs" aria-label="chapters">' + book.chapters.map((c) => '<button type="button" class="gb-tab" data-page="' + c.from + '" data-chapter="' + esc(c.id) + '">' + esc(c.name) + '</button>').join('') + '</nav>'
      + '<div class="gb-3d" aria-label="the book, lying open on a desk" hidden></div><div class="gb-spread"></div></div>'
      + '<div class="gb-nav"><button type="button" class="gb-prev" aria-label="previous page">←</button><span class="gb-num" aria-live="polite"></span><button type="button" class="gb-next" aria-label="next page">→</button></div>'
      + '<div class="src">Written by V01D from its own skill files · ← → or swipe to turn · Esc closes</div>';
    const spread = el.querySelector('.gb-spread'), num = el.querySelector('.gb-num'), prev = el.querySelector('.gb-prev'), next = el.querySelector('.gb-next');
    // the 3D book (skills/mini/book.js): the same pages on a hardcover you open and turn; the flat spread below stays the text version
    // and the fallback where WebGL is missing. The cover is shut until you open it (a tap, "Open the book", or an ask for a page).
    const host = el.querySelector('.gb-3d'), view = el.querySelector('.gb-view');
    // the hardcover shows from the first paint wherever WebGL runs (owner, 2026-10-16: the book came up as the flat text, "no book no
    // cover no turning pages"): the host was hidden until the miniature had mounted, so a slow or stuck mount left the text with no
    // word why. Now the 3D host is visible while it loads; only a failed mount, or no WebGL, falls to the text, and a failure says why.
    const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } })();
    let open3 = !!(want.at && pageFor(book, want.at)) || readKept() > 1, has3d = webgl, mounted = false;
    const miniData = () => ({ book, cur, open: open3, onTurn: (d) => turn(d), onJump: (n) => go(n), onAsk: (a) => { try { api.stage.ask(a); } catch (_) {} },
      onOpen: () => { open3 = true; cur = Math.max(cur, 1); draw(); }, onClose: () => { open3 = false; draw(); } });
    const mount3d = () => api.stage.miniature(host, 'book', miniData(), { key: 'v01d-book' });
    const showView = () => { el.classList.toggle('gb-flat', !has3d || localStorage.getItem('a2m.void.book3d.v1') === 'flat'); view.hidden = !has3d; view.textContent = el.classList.contains('gb-flat') ? 'See the book' : 'Read as text'; };
    view.addEventListener('click', () => { try { localStorage.setItem('a2m.void.book3d.v1', el.classList.contains('gb-flat') ? '3d' : 'flat'); } catch (_) {} showView(); });
    const shown = () => (onePage() ? [cur] : pagesOfSpread(spreadOf(cur), total).filter(Boolean));
    const draw = () => {
      const ns = onePage() ? [cur] : pagesOfSpread(spreadOf(cur), total);
      spread.innerHTML = ns.map((n, i) => '<section class="gb-page ' + (onePage() ? '' : i === 0 ? 'gb-left' : 'gb-right') + (n ? '' : ' gb-blank') + '" data-page="' + n + '"' + (n ? '' : ' aria-hidden="true"') + '>' + (n ? pageHtml(book.pages[n - 1], book, esc) : '') + '</section>').join('');
      const vis = ns.filter(Boolean), chapter = (book.pages[cur - 1] || {}).chapter;
      num.textContent = (vis.length > 1 ? 'pages ' + vis[0] + '–' + vis[vis.length - 1] : 'page ' + vis[0]) + ' of ' + total;
      prev.disabled = vis[0] <= 1; next.disabled = vis[vis.length - 1] >= total;
      for (const b of el.querySelectorAll('.gb-tab')) b.classList.toggle('on', b.getAttribute('data-chapter') === chapter);
      keep(cur);
      if (has3d && mounted) mount3d().catch(() => {});
      if (window.__voidBook) window.__voidBook.cur = cur;
    };
    const go = (n) => { cur = Math.min(Math.max(Number(n) || 1, 1), total); draw(); };
    const turn = (d) => { const vis = shown(); go(d > 0 ? vis[vis.length - 1] + 1 : (onePage() ? cur - 1 : Math.max(1, vis[0] - 2))); };
    prev.addEventListener('click', () => turn(-1)); next.addEventListener('click', () => turn(1));
    el.addEventListener('click', (e) => {
      const j = e.target.closest && e.target.closest('.gjump, .gb-tab'); if (!j) return;
      e.preventDefault(); e.stopPropagation(); go(j.getAttribute('data-page'));
    });
    // the ← and → keys turn pages while the book is open and nobody is typing
    const onKey = (e) => {
      if (!api._pageStill(el)) { document.removeEventListener('keydown', onKey); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const a = document.activeElement; if (a && /^(input|textarea)$/i.test(a.tagName) && a.value) return;
      e.preventDefault(); turn(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    // a swipe turns pages (touch or pointer), a tap does not
    let x0 = null;
    const start = (x) => { x0 = x; }, end = (x) => { if (x0 == null) return; const dx = x - x0; x0 = null; if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1); };
    spread.addEventListener('touchstart', (e) => start(e.touches[0].clientX), { passive: true });
    spread.addEventListener('touchend', (e) => end(e.changedTouches[0].clientX), { passive: true });
    spread.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') start(e.clientX); });
    spread.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(e.clientX); });
    window.addEventListener('resize', () => { if (api._pageStill(el)) draw(); });
    window.__voidBook = { open3: () => open3, totals: book.totals, index: book.index, chapters: book.chapters, go, get cur() { return cur; }, set cur(v) {} }; // tools/test_void.mjs reads it
    draw();
    host.hidden = !webgl; showView();
    const no3d = (e) => {
      has3d = false; host.remove(); showView();
      const why = String((e && e.message) || e || 'unknown').slice(0, 80), sub = el.querySelector('.gb-top .sub');
      if (sub) sub.textContent += ' · the 3D book did not load (' + why + '): this is the text version';
      el.dataset.book3d = 'failed';
      try { fetch('/api/miss', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: String(text || 'open the book').slice(0, 200), fallback: 'mini:book:' + why.slice(0, 60) }), keepalive: true }).catch(() => {}); } catch (_) {}
    };
    if (webgl) { try { mount3d().then(() => { mounted = true; el.dataset.book3d = 'on'; showView(); }).catch(no3d); } catch (e) { no3d(e); } } else el.dataset.book3d = 'no-webgl';
  }).catch((e) => { const s = el.querySelector('.sub'); if (s) s.textContent = "the book didn't load: " + (e && e.message); });
  return 'guide';
}

export default {
  name: 'guide',
  examples: ['open the book', 'the guide', 'show me everything you can do', 'the book at chess', 'everything you can do', 'the manual', 'flip through the book', 'what\'s in the book'],
  nearMisses: ['what can you do', 'books by octavia butler', 'book called dune', 'open a notepad', 'a book about dogs', 'the book thief', 'menu', 'help', 'guide me to the station', 'make a book'],
  match(lower, text) { return !!guideOf(text || lower); },
  run,
};
