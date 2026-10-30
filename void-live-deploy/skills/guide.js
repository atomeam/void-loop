/**
 * guide skill — the book: everything Verse can do, one page each, read like a Skyrim book. "open the book", "the guide",
 * "show me everything you can do", "the book at chess". Say it and the stage dims, a worn leather tome comes up to fill the
 * screen, its cover swings open in half a second (Skyrim's fBookOpenTime) and you are reading two parchment pages set in a
 * serif: a running head, a title with a rule under it, a drop capital, the asks as lines of italic ink, the folio in the outer
 * corner. There is no menu, no tabs, no card: your controls are turning the page (← →, the wheel, a tap on a page's outer
 * edge, a swipe) and closing the book (Esc, or a tap on the dark). Touching an ask on a page closes the book and does it.
 * The pages come from one file, skills/guide.json, written by tools/guide.mjs from the site's own data (skills/index.json,
 * each skill's own header and examples, skills/families.json, the rack's games, skills/mini/), so no skill can be left out:
 * tools/checks.mjs fails when the file is stale. The look is lib/tome.js (pure, tested). The owner, 2026-10-16: "research
 * how the books on Skyrim work and make it like that ... the graphic style and visuals of the way they do books".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { spreadOf, pagesOfSpread } from '../lib/guide.js';
import { withNews, newSince, dayLabel } from '../lib/book-news.js';
const cleanAsk = (s) => String(s || '').trim().toLowerCase().replace(/[\u2019']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
import { playable, start as showcase } from './showcase.js'; // What's new as a live walkthrough (asked by Verse)
import { searchBook, SEARCH_CSS } from '../lib/tome-search.js';
import { TOME_CSS, sheetHtml, stacks, PROMPT, coverHtml, backCoverHtml, pageHtml, tocHtml, parchmentFilter } from '../lib/tome.js';
import { loadHealth } from '../lib/success-pulse.js';

export { pageHtml, tocHtml };

const BOOK_WORDS = '(?:book|guide|manual|handbook|strategy guide|book of everything|book of all)';
const OPEN = '(?:(?:open|show(?:\\s+me)?|read|flip through|browse|bring|summon|let me see|see|get)\\s+(?:up\\s+)?)?';
const WHOSE = '(?:the\\s+|your\\s+|(?:verse|v01d)\\s*\'?s?\\s+|(?:verse|void)\\s*\'?s?\\s+|a-to-mind\'?s?\\s+)';
const RE_BOOK = new RegExp('^' + OPEN + '(?:' + WHOSE + '(?:v01d\\s+|(?:verse|void)\\s+)?' + BOOK_WORDS + '|(?:v01d|(?:verse|void)|verse)\\s+' + BOOK_WORDS + '|strategy guide|handbook|book of everything)(?:\\s+of\\s+everything(?:\\s+(?:you|it|(?:verse|v01d)|(?:verse|void)|verse)\\s+can\\s+do)?)?(?:\\s+please)?$', 'i'); // a bare "book" or "guide" stays a word or a book search
const RE_AT = new RegExp('^' + OPEN + WHOSE + '(?:v01d\\s+|(?:verse|void)\\s+)?' + BOOK_WORDS + '\\s+(?:at|on|to|for|about)\\s+(?:the\\s+)?([a-z0-9][a-z0-9 \'-]{1,40})$', 'i');
const RE_ALL = /^(?:(?:show|tell)\s+me\s+|list\s+|i want to see\s+|what(?:'s| is|s)\s+)?(?:everything|all(?: the things)?|every single thing)\s+(?:that\s+)?(?:you|void|v01d|verse|it)\s+(?:can|could)\s+do(?:,?\s+(?:all of it|in one place))?(?:\s+please)?$/i;
const RE_NEWS = /^(?:(?:what'?s|whats|what is)\s+new\s+in\s+(?:the\s+)?(?:v01d\s+|(?:verse|void)\s+)?(?:book|guide)|(?:the\s+)?(?:v01d\s+|(?:verse|void)\s+)?(?:book|guide)(?:'s)?\s+(?:news|what'?s new))$/i;
const RE_MORE = /^(?:(?:what's|whats|what is)\s+in\s+the\s+(?:book|guide)|(?:the\s+)?table\s+of\s+contents|(?:show\s+me\s+)?(?:the\s+)?(?:whole|complete|full)\s+(?:list|guide|book|manual)(?:\s+of\s+(?:skills|everything))?|every\s+skill(?:\s+(?:you|(?:verse|void)|(?:verse|v01d)|verse)\s+(?:have|has))?|(?:the\s+)?(?:v01d|(?:verse|void)|verse)\s+(?:book|guide|manual|handbook))$/i;
// the rule registry (asked by Verse): "rule registry", "show the router rules", "list all active router rules" open the book at that chapter
const RE_RULES = /^(?:(?:open|show(?:\s+me)?|read|list|see|browse)\s+)?(?:(?:the|your|all(?:\s+the)?|every)\s+)?(?:(?:v01d|(?:verse|void)|verse)\s*'?s?\s+)?(?:active\s+)?(?:rule[- ]?registry|(?:router|routing)\s+rules|rules\s+of\s+the\s+router)(?:\s+(?:in|from)\s+the\s+(?:book|tome|guide))?(?:\s+please)?$/i;

/** { at } for an ask that opens the book (at: a name to open it on, or ''), null otherwise. Pure. */
export function guideOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  const at = RE_AT.exec(t);
  if (at) return { at: at[1].trim() };
  if (RE_NEWS.test(t)) return { at: "what\u2019s new" };
  if (RE_RULES.test(t)) return { at: 'rule registry' };
  if (RE_BOOK.test(t) || RE_ALL.test(t) || RE_MORE.test(t)) return { at: '' };
  return null;
}

// a page's rustle (a short brush of filtered noise), only while the page's ambient sound is on (the speaker button, aria-pressed)
let rustleCtx = null;
export function rustle() {
  try {
    const btn = document.getElementById('sound'); if (!btn || btn.getAttribute('aria-pressed') !== 'true') return false;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    rustleCtx = rustleCtx || new AC(); const c = rustleCtx, n = Math.floor(c.sampleRate * 0.16), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) ** 2 * (0.5 + 0.5 * Math.sin(t * 40)); }
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.18; src.connect(f); f.connect(g); g.connect(c.destination); src.start();
    return true;
  } catch (_) { return false; }
}

// The book's pages are written at build time (skills/guide.json), but "what's new" is read live: the growth ledger is fetched each time
// the book opens, revalidated (no-cache: a deploy shows at once, an unchanged file costs a 304), and its newest entries become the
// chapter after the contents (lib/book-news.js). If the ledger cannot be read the book opens without that chapter.
async function load() {
  const [r, led, proof] = await Promise.all([fetch('/skills/guide.json', { cache: 'no-cache' }), fetch('/void.growth.json', { cache: 'no-cache' }).then((x) => (x.ok ? x.json() : null)).catch(() => null), fetch('/claims-verified.json', { cache: 'no-cache' }).then((x) => (x.ok ? x.json() : null)).catch(() => null)]);
  if (!r.ok) throw new Error('guide.json ' + r.status);
  // a build is played on the stage only when its ask answered with its own card, never the fallback (tools/claims-verify.mjs; owner, 2026-10-15)
  const base = await r.json(), book = withNews(base, led, { tryOf: (e) => (playable(e) || {}).ask }); // an entry with no try of its own gets showcase's
  book.verified = new Set(proof && Array.isArray(proof.ok) ? proof.ok : []);
  // a line plays on the stage only when its ask answered live; its day offers "play all N on the stage" only for those (it used to offer the
  // walkthrough for any try, then close the book and show nothing when none had answered)
  if (book.news) for (const e of book.news.entries) e.live = !!e.try && e.try.charAt(0) !== '/' && book.verified.has(cleanAsk(e.try));
  if (book.news) { const seen = readSeen(); book.news.unseen = newSince(book.news.entries, seen); if (!seen) keepSeen(book.news.latest); } // a first visit has no "since": it just starts counting
  return book;
}

const KEY = 'a2m.void.book.v1'; // the page you were on, this browser only
const SEEN = 'a2m.void.book.seen.v1'; // the newest ledger time shown to you in the book, this browser only (never required)
const readSeen = () => { try { return localStorage.getItem(SEEN) || ''; } catch (_) { return ''; } };
const keepSeen = (at) => { try { if (at && at > readSeen()) localStorage.setItem(SEEN, at); } catch (_) {} };
const readKept = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch (_) { return 0; } };
const keep = (n) => { try { localStorage.setItem(KEY, String(n)); } catch (_) {} };

/** the page a name opens the book on: a skill, a game box, a chapter or a miniature; 0 when nothing matches. Pure. */
export function pageFor(book, name) {
  const q = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\u2019/g, "'");
  if (!q) return 0;
  const c = (book.chapters || []).find((x) => x.name.toLowerCase().replace(/\u2019/g, "'") === q || x.id === q); if (c) return c.from;
  const hit = (f) => (book.pages || []).find(f);
  const p = hit((x) => x.kind === 'skill' && (x.name === q || x.title.toLowerCase() === q || x.name === q.replace(/ /g, '-')))
    || hit((x) => x.game && x.game.title.toLowerCase() === q) || hit((x) => x.kind === 'game' && x.name === q)
    || hit((x) => x.kind === 'mini' && x.name === q.replace(/\s*\(3d\)$/, '').replace(/ /g, '-'))
    || hit((x) => (x.kind === 'skill' || x.kind === 'game') && (x.title.toLowerCase().includes(q) || (x.examples || []).some((e) => e.toLowerCase() === q)));
  return p ? p.n : 0;
}

const onePage = () => window.matchMedia('(max-width: 700px)').matches;
const motionless = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
const after = (el, prop, ms, fn) => { // when a transition ends (or would have), once
  let done = false; const go = () => { if (done) return; done = true; fn(); };
  el.addEventListener('transitionend', (e) => { if (e.target === el && (!prop || e.propertyName === prop)) go(); }, { once: true });
  setTimeout(go, ms + 80);
};

/** the one tome on the screen, or null */
export const current = () => document.getElementById('vtome');

/** shut and take down the tome: the cover swings shut, then the screen clears */
export function closeTome(why = 'esc') {
  const root = current(); if (!root || root._closing) return false;
  // Esc or a tap on the dark shuts an open book and leaves it there, cover showing; once it is shut, the same again puts it away
  const t0 = root.querySelector('.tome');
  if ((why === 'esc' || why === 'tap') && t0 && !t0.classList.contains('shut') && root._toCover) { root._toCover(); return true; }
  root._closing = true;
  const tome = root.querySelector('.tome'), wasShut = tome.classList.contains('shut'); // a shut book has no cover to swing: it goes at once
  tome.classList.remove('opened'); tome.classList.remove('open'); tome.classList.add('shut');
  const gone = () => { root.classList.remove('on'); after(root, 'opacity', 350, () => { root.remove(); document.documentElement.classList.remove('v-tome'); }); };
  if (motionless() || wasShut) gone(); else after(tome.querySelector('.tome-cover'), 'transform', 550, gone);
  if (root._cleanup) root._cleanup();
  if (window.__voidBook) window.__voidBook.open = false;
  try { document.dispatchEvent(new CustomEvent('void:book', { detail: { open: false, why } })); } catch (_) {}
  return true;
}

function mount(book, api, startAt, text) {
  const { esc } = api;
  const old = current(); if (old) { old._cleanup && old._cleanup(); old.remove(); }
  book.title = book.title || 'The Verse Book';
  const total = book.pages.length;
  let cur = Math.min(Math.max(startAt || readKept() || 1, 1), total), turning = false;
  const root = document.createElement('div'); root.id = 'vtome'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', book.title); root.setAttribute('aria-modal', 'true');
  root.innerHTML = '<style>' + TOME_CSS + SEARCH_CSS + '</style><div class="tome-dim"></div><div class="tome shut" data-pages="' + total + '">'
    + '<div class="tome-boards"></div><div class="tome-stack left"></div><div class="tome-stack right"></div>'
    + '<section class="tome-page left" data-page=""></section><section class="tome-page right" data-page=""></section><div class="tome-spine"></div>'
    + '<div class="tome-cover">' + coverHtml(book, esc) + '</div><div class="tome-backcover">' + backCoverHtml(book, esc) + '</div></div><button type="button" class="tome-tocover" aria-label="Back to the cover">Cover</button><form class="tome-search" role="search" autocomplete="off"><input type="search" name="q" placeholder="Search the tome: a skill, an ask" aria-label="Search the tome" maxlength="80" enterkeyhint="go" aria-controls="tome-hits"><ul class="tome-hits" id="tome-hits" role="listbox" aria-label="Pages found"></ul></form><div class="tome-prompt" aria-hidden="true">' + PROMPT + '</div><div class="sr-only" aria-live="polite"></div>';
  // the parchment's tone follows the site's health at the Status card's last check (asked by Verse); untouched with no reading
  const tone = parchmentFilter(loadHealth()); if (tone) { root.dataset.tone = tone; root.querySelector('.tome').style.setProperty('--tome-tone', tone); }
  document.body.appendChild(root);
  document.documentElement.classList.add('v-tome');
  const tome = root.querySelector('.tome'), left = root.querySelector('.tome-page.left'), right = root.querySelector('.tome-page.right'), live = root.querySelector('[aria-live]');
  const stackL = root.querySelector('.tome-stack.left'), stackR = root.querySelector('.tome-stack.right');

  // scale a sheet's words down until the last line ends above its footer (a browser zoom or a short window shrinks the book; the
  // words scale with it, so the fit only depends on the page). Nothing is cut and nothing scrolls; the words are never shortened.
  const fitSheet = (sec, again) => {
    const f = sec && sec.querySelector(':scope > .tome-fit'); if (!f) return;
    f.style.zoom = ''; const floor = () => sec.getBoundingClientRect().bottom - parseFloat(getComputedStyle(sec).paddingBottom);
    const over = () => f.getBoundingClientRect().bottom > floor() + 0.5;
    if (!over()) return;
    let lo = 0.3, hi = 1; for (let i = 0; i < 9; i++) { const z = (lo + hi) / 2; f.style.zoom = z; if (over()) hi = z; else lo = z; }
    f.style.zoom = Math.max(0.3, lo - 0.01); // a hair of room, so a late reflow never pushes the last line over
    if (!again) setTimeout(() => { if (sec.isConnected && over()) fitSheet(sec, true); }, 300); // art and faces that land late: measured again
  };
  const shown = () => (onePage() ? [cur] : pagesOfSpread(spreadOf(cur), total));
  const lay = (ns) => { // the two sheets (one on a phone) and the stacks beside them
    const [l, r] = onePage() ? [0, ns[0]] : ns;
    left.classList.toggle('has-tier', !!(l && book.pages[l - 1].tier)); right.classList.toggle('has-tier', !!(r && book.pages[r - 1].tier));
    left.innerHTML = l ? sheetHtml(book.pages[l - 1], book, 'left', esc) : ''; left.dataset.page = l || ''; left.style.visibility = l || !onePage() ? '' : 'hidden'; // no page on the left (the title spread): the blank endpaper shows
    right.innerHTML = r ? sheetHtml(book.pages[r - 1], book, 'right', esc) : ''; right.dataset.page = r || ''; right.style.visibility = r ? '' : 'hidden';
    fitSheet(left); fitSheet(right);
    const s = stacks(cur, total); stackL.style.setProperty('--k', s.left.toFixed(3)); stackR.style.setProperty('--k', s.right.toFixed(3));
    live.textContent = (l && r ? 'pages ' + l + ' and ' + r : 'page ' + (r || l)) + ' of ' + total;
  };
  const draw = () => { lay(shown()); keep(cur); if (book.news && shown().some((n) => n >= book.news.from && n <= book.news.to)) keepSeen(book.news.latest); if (window.__voidBook) window.__voidBook.cur = cur; };

  // a leaf swings over the spine: forward carries the right page across and lands as the new left page; backward the reverse
  const turnTo = (n) => {
    n = Math.min(Math.max(Number(n) || 1, 1), total);
    const was = shown(), fwd = n > cur; cur = n; const now = shown();
    if (was.join() === now.join()) { draw(); return; }
    if (turning || motionless() || onePage()) { draw(); rustle(); return; }
    turning = true;
    const leaf = document.createElement('div'); leaf.className = 'tome-leaf ' + (fwd ? 'fwd' : 'back');
    // forward: the leaf's face is the old right page, its underside the new left page; the sheets beneath show old left and new right
    const face = fwd ? was[1] : was[0], under = fwd ? now[0] : now[1];
    leaf.innerHTML = '<div class="tome-face ' + (fwd ? 'right' : 'left') + '">' + sheetHtml(book.pages[face - 1], book, fwd ? 'right' : 'left', esc) + '</div><div class="tome-face under ' + (fwd ? 'left' : 'right') + '">' + sheetHtml(book.pages[under - 1], book, fwd ? 'left' : 'right', esc) + '</div>';
    if (fwd) { right.innerHTML = now[1] ? sheetHtml(book.pages[now[1] - 1], book, 'right', esc) : ''; right.dataset.page = now[1] || ''; right.style.visibility = now[1] ? '' : 'hidden'; }
    else { left.innerHTML = now[0] ? sheetHtml(book.pages[now[0] - 1], book, 'left', esc) : ''; left.dataset.page = now[0] || ''; left.style.visibility = now[0] ? '' : 'hidden'; }
    for (const f of leaf.querySelectorAll('.tome-face')) { const pg = book.pages[(f.classList.contains('under') ? under : face) - 1]; f.classList.toggle('has-tier', !!(pg && pg.tier)); }
    if (fwd) right.classList.toggle('has-tier', !!(now[1] && book.pages[now[1] - 1].tier)); else left.classList.toggle('has-tier', !!(now[0] && book.pages[now[0] - 1].tier));
    tome.appendChild(leaf);
    leaf.querySelectorAll('.tome-face').forEach(fitSheet); fitSheet(fwd ? right : left);
    leaf.getBoundingClientRect(); // laid out flat before it moves
    leaf.classList.add('going'); leaf.style.transform = 'rotateY(' + (fwd ? -180 : 180) + 'deg)';
    rustle();
    after(leaf, 'transform', 720, () => { leaf.remove(); turning = false; draw(); });
  };
  // the cover is part of the book (owner, 2026-10-16: "the cover swings open and I can't go back to view it ever"): turning back from
  // the title page swings it shut over the pages; turning forward, a tap or a key opens it again
  const shutCover = () => { if (tome.classList.contains('shut') || turning) return; tome.classList.remove('opened'); tome.classList.remove('open'); tome.classList.remove('back'); tome.classList.add('shut'); rustle(); live.textContent = 'the cover'; if (window.__voidBook) { window.__voidBook.shut = true; window.__voidBook.side = 'front'; } };
  // closing the book leaves it on the table, shut: the front cover, or the back cover after the last page (owner, 2026-10-17: when I close the book it should stay so I can see the cover or back cover)
  const shutBack = () => { if (tome.classList.contains('shut') || turning) return; tome.classList.remove('opened'); tome.classList.remove('open'); tome.classList.add('shut'); tome.classList.add('back'); rustle(); live.textContent = 'the back cover'; if (window.__voidBook) { window.__voidBook.shut = true; window.__voidBook.side = 'back'; } };
  const openBack = () => { cur = total; tome.classList.remove('back'); tome.classList.remove('shut'); tome.classList.add('open'); tome.classList.add('opened'); rustle(); if (window.__voidBook) { window.__voidBook.shut = false; window.__voidBook.side = 'front'; } draw(); };
  const openCover = () => { if (!tome.classList.contains('shut')) return; if (tome.classList.contains('back')) { openBack(); return; } tome.classList.remove('shut'); tome.classList.add('open'); rustle(); if (window.__voidBook) window.__voidBook.shut = false; const opened = () => { tome.classList.add('opened'); draw(); }; if (motionless()) opened(); else after(tome.querySelector('.tome-cover'), 'transform', 550, opened); };
  const turn = (d) => { if (tome.classList.contains('shut')) { if (tome.classList.contains('back')) { if (d < 0) openBack(); } else if (d > 0) openCover(); return; } if (d < 0 && shown().filter(Boolean)[0] === 1) { shutCover(); return; } const vis = shown().filter(Boolean); if (d > 0 && vis[vis.length - 1] >= total) { shutBack(); return; } turnTo(d > 0 ? vis[vis.length - 1] + 1 : (onePage() ? cur - 1 : Math.max(1, vis[0] - 2))); };
  const go = (n) => { if (tome.classList.contains('shut')) openCover(); turnTo(n); };
  // the way back to the cover from any page, however far in (owner, 2026-10-17: "still can't get to the cover of the book"): the Cover button, the Home key
  const toCover = () => { if (tome.classList.contains('shut') && !tome.classList.contains('back')) return; turning = false; cur = 1; tome.classList.remove('shut'); shutCover(); };
  root._toCover = toCover;
  root.querySelector('.tome-tocover').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toCover(); });
  root.querySelector('.tome-tocover').addEventListener('pointerdown', (e) => e.stopPropagation());

  // ---- the search bar docked at the top (asked by Verse): type, pick a page, the book turns to it; it stays while you read
  const bar = root.querySelector('.tome-search'), box = bar.querySelector('input'), hits = bar.querySelector('.tome-hits');
  const find = () => {
    const list = searchBook(book, box.value);
    hits.innerHTML = list.map((h) => '<li role="option"><button type="button" data-n="' + esc(h.n) + '">' + esc(h.title) + '<em>p. ' + esc(h.n) + '</em>' + (h.hint ? '<small>' + esc(h.hint) + '</small>' : '') + '</button></li>').join('')
      + (box.value.trim().length >= 2 && !list.length ? '<li role="option"><button type="button" disabled>Nothing in the book by that name</button></li>' : '');
    return list;
  };
  box.addEventListener('input', find);
  bar.addEventListener('submit', (e) => { e.preventDefault(); const first = find()[0]; if (first) { go(first.n); hits.innerHTML = ''; box.blur(); } });
  hits.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button[data-n]'); if (b) { go(b.dataset.n); hits.innerHTML = ''; box.value = ''; box.blur(); } });
  // ---- the controls, Skyrim's: turn or close, nothing else
  const onKey = (e) => {
    if (!current()) { document.removeEventListener('keydown', onKey, true); return; }
    if (e.key === '/' && document.activeElement !== box) { e.preventDefault(); e.stopImmediatePropagation(); box.focus(); return; }
    if (e.key === 'Escape' && (box.value || hits.children.length)) { e.preventDefault(); e.stopImmediatePropagation(); box.value = ''; hits.innerHTML = ''; box.blur(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeTome('esc'); return; }
    if (e.key === 'Home' && !(document.activeElement && /^(input|textarea)$/i.test(document.activeElement.tagName))) { e.preventDefault(); e.stopImmediatePropagation(); toCover(); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'PageDown' && e.key !== 'PageUp') return;
    const a = document.activeElement; if (a && /^(input|textarea)$/i.test(a.tagName) && a.value) return;
    e.preventDefault(); e.stopImmediatePropagation(); turn(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
  };
  document.addEventListener('keydown', onKey, true); // before the page's own Esc (which would close a card instead)
  let wheelAt = 0;
  const onWheel = (e) => { e.preventDefault(); const now = Date.now(); if (now - wheelAt < 380 || Math.abs(e.deltaY) < 4) return; wheelAt = now; turn(e.deltaY > 0 ? 1 : -1); };
  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (tome.classList.contains('shut') && tome.contains(t)) { e.preventDefault(); e.stopPropagation(); openCover(); return; }
    // asked by Verse: "Connect the 'What's new' chapter entries with the 'showcase' skill so every new update can be viewed as a live, interactive
    // demonstration": a day's "play all N on the stage" closes the book and walks through that day's changes, each one asked for real
    const day = t.closest && t.closest('a[data-showcase-day]');
    if (day) { e.preventDefault(); e.stopPropagation(); const d = day.getAttribute('data-showcase-day'),
        steps = ((book.news && book.news.entries) || []).filter((x) => x.day === d && x.live).reverse().map((x) => ({ line: x.line, ask: x.try }));
      if (!steps.length) return; // never close the book onto nothing
      closeTome('ask'); setTimeout(() => { try { showcase(api.stage, steps, { label: 'What\u2019s new, ' + dayLabel(d) }); } catch (_) {} }, 650); return; }
    if (t.closest && t.closest('a.tome-tryit[href^="/"]')) { e.stopPropagation(); return; } // a page of the site opens as a link, never turns the page
    const ask = t.closest && t.closest('a[data-ask]'); if (ask) { e.preventDefault(); e.stopPropagation(); const a = ask.getAttribute('data-ask'); closeTome('ask'); setTimeout(() => { try { api.stage.ask(a); } catch (_) {} }, 60); return; }
    const j = t.closest && t.closest('a[data-page]'); if (j) { e.preventDefault(); e.stopPropagation(); go(j.getAttribute('data-page')); return; }
    if (t.classList.contains('tome-dim') || t === root) { closeTome('tap'); return; }
    const page = t.closest && t.closest('.tome-page'); if (!page) return;
    const r = page.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; // the outer third of a page turns it
    if (page.classList.contains('right') && x > 0.66) turn(1); else if (page.classList.contains('left') && x < 0.34) turn(-1);
    else if (onePage() && x > 0.66) turn(1); else if (onePage() && x < 0.34) turn(-1);
  });
  let x0 = null; // a swipe turns, a tap does not
  const start = (x) => { x0 = x; }, end = (x) => { if (x0 == null) return; const dx = x - x0; x0 = null; if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1); };
  tome.addEventListener('touchstart', (e) => start(e.touches[0].clientX), { passive: true });
  tome.addEventListener('touchend', (e) => end(e.changedTouches[0].clientX), { passive: true });
  tome.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') start(e.clientX); });
  tome.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(e.clientX); });
  // a resize, a browser zoom (devicePixelRatio), a phone's address bar (visualViewport) or the tome's own box changing all refit the open pages
  let refit = 0; const onResize = () => { cancelAnimationFrame(refit); refit = requestAnimationFrame(() => { if (current()) draw(); }); };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  let dpr = null; const watchDpr = () => { if (!window.matchMedia) return; dpr = matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)'); dpr.addEventListener('change', onDpr, { once: true }); };
  const onDpr = () => { onResize(); watchDpr(); }; watchDpr();
  let ro = null; if (window.ResizeObserver) { let last = ''; ro = new ResizeObserver((es) => { const r = es[0].contentRect, k = Math.round(r.width) + 'x' + Math.round(r.height); if (k !== last) { last = k; onResize(); } }); ro.observe(tome); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize, () => {});
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onResize); // a face first used on this page (italic, bold) lands after the fit
  document.documentElement.classList.add('vtome-open');
  root._cleanup = () => { document.documentElement.classList.remove('vtome-open'); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize); if (dpr) dpr.removeEventListener('change', onDpr); if (ro) ro.disconnect(); if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onResize); };

  window.__voidBook = { open: true, totals: book.totals, index: book.index, chapters: book.chapters, go, turn, close: () => closeTome('api'), get cur() { return cur; }, set cur(v) {}, get turning() { return turning; }, ask: text, news: book.news ? { from: book.news.from, to: book.news.to, count: book.news.count, unseen: book.news.unseen } : null }; // tools/test_void.mjs reads it
  // ---- the opening: the shut tome comes up, the cover swings open on the spine, the pages are there
  draw();
  requestAnimationFrame(() => {
    root.classList.add('on');
    setTimeout(() => {
      tome.classList.remove('shut'); tome.classList.add('open');
      const opened = () => { tome.classList.add('opened'); try { document.dispatchEvent(new CustomEvent('void:book', { detail: { open: true, page: cur } })); } catch (_) {} };
      if (motionless()) opened(); else after(tome.querySelector('.tome-cover'), 'transform', 550, opened);
    }, motionless() ? 0 : 180);
  });
  return root;
}

function run(text, api) {
  const want = guideOf(text) || { at: '' };
  if (api.stage && typeof api.stage.closePage === 'function') { try { api.stage.closePage(); } catch (_) {} }
  api.say('opening the book…');
  load().then((book) => {
    const at = want.at ? pageFor(book, want.at) : 0;
    if (want.at && !at) api.say('nothing in the book is called ' + want.at + ': opening it at the contents');
    mount(book, api, at || (want.at ? 4 : 0), text);
    api.say('');
  }).catch((e) => { api.say("the book didn't open: " + (e && e.message)); });
  return 'guide';
}

export default {
  name: 'guide',
  examples: ['open the book', 'the guide', 'show me everything you can do', 'the book at chess', 'everything you can do', 'the manual', 'flip through the book', 'what\'s in the book', 'rule registry', 'show the router rules'],
  nearMisses: ['what can you do', 'books by octavia butler', 'book called dune', 'open a notepad', 'a book about dogs', 'the book thief', 'menu', 'help', 'guide me to the station', 'make a book', 'the rules of chess', 'house rules'],
  match(lower, text) { return !!guideOf(text || lower); },
  run,
};
