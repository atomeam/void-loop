// /fanfic/'s module (owner, 2026-10-29: "build the page"; the same night: "a clean, dedicated fanfiction archive view that matches legacy layouts
// (like Sycophant Hex)", "without raw board form fields", "zero seeded or fake stories"). The archive has no endpoint of its own: it reads GET
// /api/boards and posts through POST /api/boards, so every story, chapter, review and fandom passes the boards' bot check and rates. A fandom is a
// board, a story is a thread (lib/fanfic.js says how chapters and reviews are told apart). Nothing is written into the page: an empty archive
// shows the empty state, and every row is a real post. What this device keeps: drafts, read marks, the pen name and its signing secret.
import * as F from '/lib/fanfic.js';
import { doWork, excerpt } from '/lib/boards.js';
import { mountRelated } from '/lib/toolkit.js';
import { connectBrain } from '/lib/brain-bridge.js';
import * as DE from '/lib/fanfic-de.js';

const $ = (id) => document.getElementById(id), API = '/api/boards', KEY = 'a2m.void.fanfic.v1', BOARDS_KEY = 'a2m.void.boards.v1', LANG_KEY = 'a2m.void.fanfic.lang';
// German for a reader who asks for it (?lang=de, the switch in the header, or a German browser): the archive's own words change after each
// draw, what readers wrote never does (lib/fanfic-de.js). English is the page as written.
const lang = (() => { let saved = ''; try { saved = localStorage.getItem(LANG_KEY) || ''; } catch (_) {} return DE.langOf(location.search, saved, navigator.language); })();
const german = lang === 'de';
// Verse Brain (lib/brain-bridge.js, owner 2026-10-29: "all the pages are supposed to be able to work together"): the fandom a reader opens and
// the words they search go to the brain when one is open in this browser (BroadcastChannel, never a server); the footer says what it is
// thinking about then, and nothing at all when no brain is open
const brain = connectBrain();
brain.on((m) => { const p = $('brainSay'); if (!p) return; const t = m.thinking || (m.words && m.words[m.words.length - 1]); p.hidden = !t; if (t) p.textContent = 'Verse Brain, open in another tab, is thinking about "' + t + '"' + (m.related && m.related.length ? ', near ' + m.related.map((r) => r.word).join(', ') : '') + '.'; });
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (_) { return { ...d }; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
const api = async (qs, body) => {
  try {
    const r = await fetch(API + qs, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
  } catch (_) { return { ok: false, say: 'the archive could not be reached; check the connection and try again' }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const date = (t) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : s < 30 * 86400 ? Math.floor(s / 86400) + ' d ago' : date(t); };
const timeEl = (t) => { const x = el('time', '', ago(t)); x.dateTime = new Date(t).toISOString(); x.title = new Date(t).toLocaleString(); return x; };
const href = (o) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v != null && v !== '') u.set(k, v); const s = u.toString(); return '/fanfic/' + (s ? '?' + s : ''); };
const link = (text, to, cls) => { const a = el('a', cls, text); a.href = to; a.dataset.go = ''; return a; };
const boardLink = (b, t, no) => '/boards/?b=' + b + (t ? '&t=' + t : '') + (no ? '#p' + no : '');
const say = (node, text, tone) => { node.textContent = text || ''; node.classList.toggle('bad', tone === 'bad'); node.classList.toggle('good', tone === 'good'); };
const words = (n) => n.toLocaleString() + (n === 1 ? ' word' : ' words');

// ---- what this device keeps ----
let me = load(KEY, { drafts: [], cur: '', days: {}, read: { all: 0, seen: {} }, period: 'all', pen: '', secret: '', pw: '', mine: {}, recs: { name: '', items: [] } });
me.read = { all: 0, seen: {}, ...(me.read || {}) }; me.mine = me.mine || {}; me.days = me.days || {}; me.drafts = Array.isArray(me.drafts) ? me.drafts : [];
if (!me.secret) me.secret = F.newSecret();
if (!me.pw) me.pw = F.newSecret();
const keep = () => save(KEY, me);
keep();
const adultOk = () => !!load(BOARDS_KEY, {}).adult; // the same 18+ answer the boards keep
const setAdult = () => { const b = load(BOARDS_KEY, {}); b.adult = true; save(BOARDS_KEY, b); };

// ---- the sky: a still starfield on a canvas, drawn once per size ----
(function stars() {
  const c = $('stars'), g = c.getContext && c.getContext('2d'); if (!g) return;
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0, n = Math.round((w * h) / 5200); i < n; i++) {
      const x = r() * w, y = r() * h, big = r() < 0.06, rad = big ? 1.1 + r() * 0.6 : 0.3 + r() * 0.6, a = 0.18 + r() * 0.55, tint = r();
      g.fillStyle = tint < 0.12 ? 'rgba(255,170,214,' + a + ')' : tint < 0.3 ? 'rgba(158,178,255,' + a + ')' : 'rgba(242,244,251,' + a + ')';
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  };
  let t = 0; draw(); addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
})();

// ---- the bot check, the boards' own: Turnstile when the site has it, else a proof of work done on this device ----
const cfgP = api('?config');
let tsLoad = null;
const turnstile = () => tsLoad || (tsLoad = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = () => res(window.turnstile); s.onerror = () => { tsLoad = null; rej(new Error('the person check did not load; reload the page')); }; document.head.append(s); }));
function botFor(box) { // { start(), proof(): Promise<proof>, reset() }; nothing runs until a form is opened
  let cfg = null, token = '', wid = null, work = null, ready = null, waiters = [];
  const startWork = () => work || (work = (async () => {
    const c = await api('?challenge'); if (!c.ok) throw new Error(c.say || 'the person check could not start');
    box.textContent = 'Checking on this device that you are a person…'; const n = await doWork(c.c, c.bits); box.textContent = 'Checked: you are a person.'; return { c: c.c, sig: c.sig, n };
  })().catch((e) => { work = null; box.textContent = 'The person check did not finish. It tries again when you post.'; throw e; }));
  const start = () => ready || (ready = cfgP.then(async (c) => {
    cfg = c || {};
    if (cfg.turnstile) {
      const ts = await turnstile();
      wid = ts.render(box, { sitekey: cfg.turnstile, theme: 'dark', callback: (t) => { token = t; waiters.splice(0).forEach((f) => f()); }, 'expired-callback': () => { token = ''; } });
    } else { box.textContent = 'A short check that you are a person runs on this device while you write.'; startWork().catch(() => {}); }
  }));
  return {
    start,
    async proof() {
      await start();
      if (cfg.turnstile) {
        if (!token) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); await Promise.race([new Promise((r) => waiters.push(r)), sleep(90000)]); }
        if (!token) throw new Error('finish the person check first');
        const t = token; token = ''; return { turnstile: t };
      }
      const p = await startWork(); work = null; return p;
    },
    reset() { if (cfg && cfg.turnstile) { token = ''; try { window.turnstile.reset(wid); } catch (_) {} } else if (cfg) startWork().catch(() => {}); },
  };
}

// ---- reading the archive: every fandom board and its catalog ----
let loaded = null;
async function readArchive() {
  const r = await api('');
  if (!r.ok) throw new Error(r.say || 'the archive could not be read');
  const boards = (r.boards || []).filter(F.isFicBoard).sort((a, b) => (b.last || b.created || 0) - (a.last || a.created || 0));
  const lists = await Promise.all(boards.slice(0, 40).map((b) => api('?b=' + encodeURIComponent(b.code)).then((c) => (c.ok ? c.threads || [] : []))));
  // a writing challenge is a thread too, but not a story: it goes on the Challenges list, never on the story lists (lib/fanfic.js challengeOf)
  const topics = [], challenges = [];
  boards.slice(0, 40).forEach((b, i) => { for (const t of lists[i]) if (!t.hidden) { const c = F.challengeOf(t, b); if (c) challenges.push(c); else topics.push(F.topicOf(t, b)); } });
  topics.sort((a, b) => b.bumped - a.bumped); challenges.sort((a, b) => b.bumped - a.bumped);
  // a story a later chapter finished says so in that chapter, not on chapter 1, so one search finds those chapters (lib/fanfic.js finishedLater)
  const open = topics.some((t) => t.status === 'In progress' && t.replies > 0);
  const done = open ? await api('?q=' + encodeURIComponent('chapter status complete')).catch(() => ({})) : {};
  return { boards, topics: F.finishedLater(topics, done.ok ? done.results : []), challenges };
}
const archive = (fresh) => (!fresh && loaded) || (loaded = readArchive().catch((e) => { loaded = null; throw e; }));
const shown = (topics) => topics.filter((t) => !t.nsfw || adultOk()); // adult fandoms' stories stay off the shared lists until this device said 18+

// ---- topic lists: pinned notices, then the stories, with the period filter, paging and read marks ----
const NOTICES = [['news', 'Site news and the news archive'], ['format', 'How to format chapters'], ['report', 'Report spam or abuse here'], ['rules', 'Writing rules & guidelines'], ['help', 'Help desk: questions and answers'], ['reviews', 'Reviews and stars: how they work']];
// the site's own pages (terms, disclaimer, credits): opened from the footer like a notice, never pinned on the story lists
const SITE_PAGES = [['terms', 'Terms of use'], ['disclaimer', 'Disclaimer'], ['credits', 'Credits']];
function dot(kind, label) { const d = el('i', 'dot' + (kind ? ' ' + kind : '')); d.setAttribute('role', 'img'); d.setAttribute('aria-label', label); return d; }
function noticeRow([id, title]) {
  const tr = el('tr', 'pin'), ic = el('td', 'ic'), main = el('td', 'm'), rep = el('td', 'num hide-s', '0'), who = el('td', 'who hide-s', 'Verse'), when = el('td', 'when', 'Pinned');
  ic.append(dot('pin', 'Announcement'));
  main.append(link(title, href({ notice: id }), 't'), el('span', 'in', 'Announcement by Verse'));
  rep.dataset.l = 'Replies'; when.dataset.l = '';
  tr.append(ic, main, rep, who, when); return tr;
}
// a story's hits: real reads counted by the server (/api/fanfic-hits), one a visitor a day, never made up. Rows ask together, up to 100 in one read
const HITS = '/api/fanfic-hits';
let hitAsk = null;
function hitsOf(k) {
  if (!hitAsk || hitAsk.keys.size >= 100) {
    const ask = (hitAsk = { keys: new Set() });
    ask.p = new Promise((r) => setTimeout(r, 0)).then(() => { if (hitAsk === ask) hitAsk = null; return fetch(HITS + '?ids=' + encodeURIComponent([...ask.keys].join(','))); })
      .then((r) => r.json()).then((j) => (j && j.hits) || {}).catch(() => ({}));
  }
  hitAsk.keys.add(k); return hitAsk.p.then((h) => +h[k] || 0);
}
// one read of an open story, counted once per page load; the server decides whether it counts (not a bot, not already today)
const hitSent = new Map();
const countHit = (code, no) => { const k = code + '/' + no;
  if (!hitSent.has(k)) hitSent.set(k, fetch(HITS + '?b=' + encodeURIComponent(code) + '&t=' + no, { method: 'POST' }).then((r) => r.json()).then((j) => (j && j.ok ? +j.hits || 0 : null)).catch(() => null)
    .then((n) => (n === null ? hitsOf(k) : n)));
  return hitSent.get(k); };
// a row's own figures (chapters, words, reviews, stars, hits) come from the whole story: each row reads its thread once, at most 4 at a time, and
// keeps the answer until the thread is bumped. An empty archive has no rows, so nothing is read and nothing is shown
const figs = new Map(), figWait = []; let figBusy = 0;
const slot = () => new Promise((r) => { if (figBusy < 4) { figBusy++; r(); } else figWait.push(r); });
const free = () => { const r = figWait.shift(); if (r) r(); else figBusy--; };
function figuresOf(t) {
  const k = t.board + '/' + t.no, had = figs.get(k);
  if (had && had.bumped === t.bumped) return had.p;
  const p = Promise.all([slot().then(() => api('?b=' + encodeURIComponent(t.board) + '&t=' + t.no)).finally(free), hitsOf(k)])
    .then(([r, hits]) => (r.ok && r.thread ? F.rowFigures(F.storyOf(r.thread, r.posts || []), hits) : null)).catch(() => null);
  figs.set(k, { bumped: t.bumped, p }); p.then((x) => { if (!x) figs.delete(k); });
  return p;
}
function figuresLine(t) {
  const line = el('span', 'in figs');
  figuresOf(t).then((f) => { if (f) f.forEach((x, i) => { if (i) line.append(' · '); line.append(el('span', '', x)); }); });
  return line;
}
function topicRow(t, { inFandom } = {}) {
  const tr = el('tr'), ic = el('td', 'ic'), main = el('td', 'm'), rep = el('td', 'num hide-s', String(t.replies)), who = el('td', 'who hide-s', t.author), when = el('td', 'when'); who.translate = false;
  ic.append(t.locked ? dot('lock', 'Locked') : F.unread(t, me.read) ? dot('new', 'New posts') : dot('', 'No new posts'));
  const a = link(t.title, href({ f: t.board, s: t.no }), 't'); a.translate = false; main.append(a);
  if (t.nsfw) main.append(el('span', 'tag adult', '18+'));
  const by = el('span', 'in'), pen = link(t.author, href({ by: F.authorKey(t) })); pen.translate = false; by.append('by ', pen);
  if (!inFandom) { const fl = link(t.fandom, href({ f: t.board })); fl.translate = false; by.append(' in ', fl); }
  main.append(by);
  const line = F.detailsLine(t); if (line) { const d = el('span', 'in det', line); d.translate = false; main.append(d); }
  main.append(figuresLine(t));
  rep.dataset.l = 'Replies'; when.dataset.l = 'Last post'; when.append(timeEl(t.bumped));
  tr.append(ic, main, rep, who, when); return tr;
}
function quietRow(text, cols = 5) { const tr = el('tr'), td = el('td', 'quiet', text); td.colSpan = cols; td.style.gridColumn = '1 / -1'; tr.append(td); return tr; }
function drawList(view, list, { inFandom, emptySay } = {}) {
  const box = $(view), rows = box.querySelector('[data-rows]'), tools = box.querySelector('[data-tools]'), pages = box.querySelector('[data-pages]');
  const period = F.PERIODS[me.period] ? me.period : 'all', inP = F.inPeriod(list, period), page = F.pageOf(inP, new URLSearchParams(location.search).get('page'));
  rows.replaceChildren(...NOTICES.map(noticeRow));
  if (page.items.length) rows.append(...page.items.map((t) => topicRow(t, { inFandom })));
  else rows.append(quietRow(list.length ? (period === 'today' ? 'Nothing was posted today.' : 'Nothing was posted this week.') + ' Choose All topics to see every story.' : emptySay || 'No stories yet. The first one posted shows here.'));
  // tools: the period and Mark all read
  const lab = el('label', 'vh', 'Show'), sel = el('select'), mark = el('button', '', 'Mark all read'), sid = view + 'Period';
  lab.htmlFor = sid; sel.id = sid;
  for (const [k, v] of Object.entries(F.PERIODS)) { const o = el('option', '', v); o.value = k; sel.append(o); }
  sel.value = period; sel.onchange = () => { me.period = sel.value; keep(); setPage(1, false); };
  mark.type = 'button'; mark.disabled = !list.some((t) => F.unread(t, me.read));
  mark.onclick = () => { me.read = { all: Date.now(), seen: {} }; keep(); route(); };
  tools.replaceChildren(lab, sel, mark);
  // pages
  pages.hidden = page.pages < 2; pages.replaceChildren();
  if (page.pages > 1) {
    pages.append(el('span', '', 'Page ' + page.page + ' of ' + page.pages));
    const btn = (text, n, cur) => { const b = el('button', '', text); b.type = 'button'; if (cur) b.setAttribute('aria-current', 'page'); b.onclick = () => setPage(n, true); return b; };
    if (page.page > 1) pages.append(btn('Previous', page.page - 1));
    let last = 0;
    for (let n = 1; n <= page.pages; n++) {
      if (n !== 1 && n !== page.pages && Math.abs(n - page.page) > 2) continue;
      if (last && n - last > 1) pages.append(el('span', '', '…'));
      pages.append(btn(String(n), n, n === page.page)); last = n;
    }
    if (page.page < page.pages) pages.append(btn('Next', page.page + 1));
  }
}
function setPage(n, push) {
  const u = new URLSearchParams(location.search); if (n > 1) u.set('page', n); else u.delete('page');
  const to = location.pathname + (u.toString() ? '?' + u : '');
  history[push ? 'pushState' : 'replaceState'](null, '', to); route(); if (push) scrollTo(0, 0);
}

// ---- views ----
const VIEWS = ['index', 'forum', 'recent', 'story', 'post', 'fandom', 'search', 'room', 'glossary', 'notice', 'authors', 'series', 'recs', 'challenges', 'challenge', 'random', 'gate', 'gone'];
const NAV = { index: 'index', forum: 'index', story: 'index', post: 'index', fandom: 'index', recent: 'recent', search: 'search', room: 'room', glossary: 'glossary', notice: 'notice', authors: 'authors', series: 'series', recs: 'recs', challenges: 'challenges', challenge: 'challenges', random: 'index' };
// what the view on screen hands to the other pages (owner, 2026-10-29: "all the pages are supposed to be able to work together"): the chapter
// being read, the draft in the Writing Room, or chapter 1 typed in the post form (the stage card's "Post a story" lands there); the index and the lists hand nothing. A link carries at most LINK_MAX encoded characters (a longer
// address is refused by the edge), so the translator gets the opening of a long chapter (it takes 5,000 characters) and the word counter opens
// only when the whole text fits; the story page and the room already count the words of a long one.
const LINK_MAX = 12000;
const fitted = (text) => { let t = String(text || '').slice(0, 5000); while (t && encodeURIComponent(t).length > LINK_MAX) t = t.slice(0, Math.floor(t.length * 0.8)); return t; };
let handing = null;
function drawRelated() {
  const h = handing, hand = !h ? [] : [{ label: 'Translate it', href: () => (h().trim() ? '/translate/?q=' + encodeURIComponent(fitted(h())) : null) },
    { label: 'Count the words', href: () => (h().trim() && encodeURIComponent(h()).length <= LINK_MAX ? '/word-count/?t=' + encodeURIComponent(h()) : null) }];
  mountRelated($('related'), '/fanfic/', hand);
}
function show(id, title, nav = NAV[id]) {
  for (const v of VIEWS) $(v).classList.toggle('on', v === id);
  for (const a of document.querySelectorAll('.nav a')) { if (a.dataset.v === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  const t = (title ? title + ' · ' : '') + 'Fan fiction · Verse'; document.title = german ? DE.deTitle(t) : t;
  handing = id === 'room' ? () => draft().text : id === 'post' ? () => $('stForm').elements.text.value : null; drawRelated();
}
const fail = (node, e) => say(node, e && e.message ? e.message.replace(/^./, (c) => c.toUpperCase()) + '.' : 'Something went wrong. Try again.', 'bad');

async function viewIndex() {
  show('index', 'Archive Descriptions & Stories');
  const s = $('indexSay'), box = $('fandomBox'); s.hidden = false; say(s, 'Opening the archive…');
  $('find').value = findQ(); idx = null;
  box.classList.add('loading'); drawList('index', [], { emptySay: 'Opening the stories…' }); // the notices and tools are fixed: they show at once
  let a; try { a = await archive(); } catch (e) { box.classList.remove('loading'); fail(s, e); return; }
  box.classList.remove('loading'); s.hidden = true;
  const { boards, topics } = a, body = $('fandoms');
  body.replaceChildren(...boards.map((b) => {
    const tr = el('tr'), ic = el('td', 'ic'), main = el('td', 'm'), n = el('td', 'num'), p = el('td', 'num'), when = el('td', 'when');
    const mine = topics.filter((t) => t.board === b.code);
    ic.append(mine.some((t) => F.unread(t, me.read)) ? dot('new', 'New posts') : dot('', 'No new posts'));
    const fl = link(b.title, href({ f: b.code }), 't'); fl.translate = false; main.append(fl);
    if (b.nsfw) main.append(el('span', 'tag adult', '18+'));
    if (b.about && !/^Fan fiction: /.test(b.about)) { const ab = el('span', 'about', b.about); ab.translate = false; main.append(ab); }
    n.textContent = String(mine.length); n.dataset.l = 'Stories'; p.textContent = String(b.posts || 0); p.dataset.l = 'Posts';
    when.dataset.l = 'Last post'; if (b.last) when.append(timeEl(b.last)); else when.textContent = 'No posts yet';
    tr.append(ic, main, n, p, when); return tr;
  }));
  $('fandomList').hidden = !boards.length; $('emptyArchive').hidden = !!boards.length;
  drawFeatured(F.featuredOf(shown(topics)));
  idx = { list: shown(topics), empty: boards.length ? 'No stories yet. Open a fandom and post the first one.' : 'No stories yet. The first one posted shows here.' };
  drawIndexList();
  const st = F.statsOf(boards, topics);
  $('nFandoms').textContent = st.fandoms.toLocaleString(); $('nStories').textContent = st.stories.toLocaleString();
  $('nPosts').textContent = st.posts.toLocaleString(); $('nAuthors').textContent = st.authors.toLocaleString();
}

// the featured story on the archive home (lib/fanfic.js featuredOf): hidden while no story qualifies, so an empty archive shows no empty panel
function drawFeatured(f) {
  $('featured').hidden = !f; if (!f) return;
  const t = f.t, a = $('featLink'), by = $('featBy'), pen = link(t.author, href({ by: F.authorKey(t) })), fl = link(t.fandom, href({ f: t.board }));
  a.textContent = t.title; a.href = href({ f: t.board, s: t.no }); pen.translate = false; fl.translate = false;
  by.replaceChildren('by ', pen, ' in ', fl); $('featSum').textContent = t.summary || ''; $('featWhy').textContent = f.why;
}
// the index's story list, narrowed by the find field (lib/fanfic.js findIn: title, fandom and pen name, accents ignored)
let idx = null;
const findQ = () => (new URLSearchParams(location.search).get('find') || '').slice(0, 100);
// the catalog's browse filters (lib/fanfic.js filterStories, sortStories): sort, rating, genres (a story has every one ticked), characters, hide
// warnings, and a title letter A to Z; they combine with the find field and live in the address, so a filtered list can be shared
const filtersQ = () => { const q = new URLSearchParams(location.search);
  return { sort: F.SORTS[q.get('sort')] ? q.get('sort') : 'recent', rating: (q.get('rated') || '').slice(0, 20), genres: (q.get('genre') || '').split(',').filter(Boolean).slice(0, 15),
    characters: (q.get('char') || '').slice(0, 120), noWarnings: q.get('nowarn') === '1', letter: (q.get('letter') || '').slice(0, 1), by: (q.get('by') || '').slice(0, 120),
    status: F.STATUSES.includes(q.get('status')) ? q.get('status') : '', series: (q.get('series') || '').slice(0, 200) }; };
const filtering = (f) => !!(f.rating || f.genres.length || f.characters.trim() || f.noWarnings || f.letter || f.by || f.status || f.series);
// one series reads in part order unless a sort is chosen
const indexList = () => { if (!idx) return []; const f = filtersQ(), got = F.filterStories(F.findIn(idx.list, findQ()), f); return f.series && f.sort === 'recent' ? F.inPartOrder(got) : F.sortStories(got, f.sort); };
function drawIndexList() {
  if (!idx) return;
  const q = findQ().trim(), f = filtersQ(); drawFilters(f);
  drawList('index', indexList(), { emptySay: idx.list.length && filtering(f) ? 'No story matches these filters.' : q && idx.list.length ? 'No story matches "' + q + '".' : idx.empty });
}
function setFilter(key, value) {
  const u = new URLSearchParams(location.search); if (value) u.set(key, value); else u.delete(key); u.delete('page');
  history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '') + location.hash); drawIndexList();
}
let filtersBuilt = false;
function drawFilters(f) {
  const sort = $('fSort'), rated = $('fRated'), genres = $('fGenres'), az = $('fAz');
  if (!filtersBuilt) {
    filtersBuilt = true;
    for (const [k, v] of Object.entries(F.SORTS)) { const o = el('option', '', v); o.value = k; sort.append(o); }
    for (const [n, line] of F.RATINGS) { const o = el('option', '', n + ': ' + line); o.value = n; rated.append(o); }
    for (const g of F.GENRES) { const l = el('label'), c = el('input'); c.type = 'checkbox'; c.value = g; l.append(c, ' ' + g); genres.append(l); }
    for (const x of ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']) { const b = el('button', '', x); b.type = 'button'; b.dataset.letter = x === 'All' ? '' : x; if (x === '#') b.setAttribute('aria-label', 'Titles that start with a number or a sign'); az.append(b); }
    sort.onchange = () => setFilter('sort', sort.value === 'recent' ? '' : sort.value);
    rated.onchange = () => setFilter('rated', rated.value);
    $('fStatus').onchange = () => setFilter('status', $('fStatus').value);
    genres.onchange = () => setFilter('genre', [...genres.querySelectorAll('input:checked')].map((c) => c.value).join(','));
    $('fChars').oninput = () => setFilter('char', $('fChars').value.slice(0, 120));
    $('fNoWarn').onchange = () => setFilter('nowarn', $('fNoWarn').checked ? '1' : '');
    az.onclick = (ev) => { const b = ev.target.closest('button[data-letter]'); if (b) setFilter('letter', b.dataset.letter); };
  }
  sort.value = f.sort; rated.value = F.RATINGS.some(([n]) => n === f.rating) ? f.rating : ''; $('fStatus').value = f.status;
  for (const c of genres.querySelectorAll('input')) c.checked = f.genres.includes(c.value);
  if (document.activeElement !== $('fChars')) $('fChars').value = f.characters; $('fNoWarn').checked = f.noWarnings;
  for (const b of az.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.letter === f.letter.toUpperCase()));
  $('fGenresSay').textContent = f.genres.length ? f.genres.join(', ') : 'any';
  // one author's stories (a pen name in a row, or a row of the Authors list, opens them): the name shows, with a way back to every author
  $('fBy').hidden = !f.by; const who = $('fByName'); who.textContent = f.by.replace(/!.*/, ''); who.translate = false;
  // one series (its name on a story, or a row of the Series list, opens it): its name and writer show, with a way back to every story
  const one = f.series && idx ? idx.list.find((t) => F.seriesKey(t) === f.series) : null;
  $('fSeries').hidden = !f.series; const sn = $('fSeriesName'); sn.textContent = one ? one.series : f.series.replace(/^.*~/, ''); sn.translate = false;
  const sw = $('fSeriesBy'); sw.textContent = one ? one.author : f.series.replace(/[!~].*/, ''); sw.translate = false;
}
$('fByAll').onclick = () => setFilter('by', '');
$('fSeriesAll').onclick = () => setFilter('series', '');
$('find').addEventListener('input', () => {
  const u = new URLSearchParams(location.search), v = $('find').value.slice(0, 100);
  if (v.trim()) u.set('find', v); else u.delete('find'); u.delete('page');
  history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : '') + location.hash); drawIndexList();
});
const listSay = (text, tone) => say($('listSay'), text, tone);
$('copyLink').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); listSay('Link copied.', 'good'); } catch (_) { listSay('The link could not be copied. Copy it from the address bar.', 'bad'); }
};
$('exportCsv').onclick = () => {
  const list = indexList(); if (!list.length) { listSay('No stories to export yet.'); return; }
  const url = URL.createObjectURL(new Blob([F.storiesCsv(list, location.origin)], { type: 'text/csv' })), a = el('a'); a.href = url; a.download = 'fan-fiction-stories.csv';
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  listSay('Exported ' + list.length + (list.length === 1 ? ' story.' : ' stories.'), 'good');
};

async function viewForum(code) {
  let a; try { a = await archive(); } catch (e) { gone(e.message); return; }
  const b = a.boards.find((x) => x.code === code);
  if (!b) { gone('There is no fandom at that link. It may have been removed, or the link is not complete.'); return; }
  if (b.nsfw && !adultOk()) { gate(); return; }
  show('forum', b.title);
  brain.tell(b.title);
  $('forumCrumb').textContent = b.title; $('forumH').textContent = b.title;
  $('forumAbout').textContent = b.about && !/^Fan fiction: /.test(b.about) ? b.about : 'Stories in ' + b.title + '.';
  $('forumPost').href = href({ new: 'story', f: code });
  drawList('forum', a.topics.filter((t) => t.board === code), { inFandom: true, emptySay: 'No stories in ' + b.title + ' yet. Post the first one.' });
}

// the Authors list: every pen name A to Z, how many stories each has posted and its newest post; a name opens that writer's stories on the index
async function viewAuthors() {
  show('authors', 'Authors');
  const rows = $('authorRows'); rows.replaceChildren(quietRow('Opening the archive…', 3));
  let a; try { a = await archive(); } catch (e) { rows.replaceChildren(quietRow(e.message, 3)); return; }
  const list = F.authorsOf(shown(a.topics));
  $('authorsSay').textContent = list.length ? list.length.toLocaleString() + (list.length === 1 ? ' author has' : ' authors have') + ' posted here.' : '';
  if (!list.length) { rows.replaceChildren(quietRow('No authors yet. The first person to post a story shows here.', 3)); return; }
  const twice = new Set(list.filter((w, i) => list.findIndex((x) => x.author === w.author) !== i).map((w) => w.author)); // a pen name two writers use
  rows.replaceChildren(...list.map((w) => {
    const tr = el('tr'), main = el('td', 'm'), n = el('td', 'num', String(w.stories)), when = el('td', 'when');
    const a = link(w.author, href({ by: w.key }), 't'); a.translate = false; main.append(a);
    if (w.trip && twice.has(w.author)) { const m = el('span', 'in', 'Signed'), code = el('span', '', ' ' + w.trip.slice(0, 12)); code.translate = false; m.append(code); main.append(m); } // tells namesakes apart
    n.dataset.l = 'Stories'; when.dataset.l = 'Last post'; when.append(timeEl(w.last));
    tr.append(main, n, when); return tr;
  }));
}

// the Series list: every series A to Z, its writer, how many parts are posted and its newest post; a name opens the series in part order
async function viewSeries() {
  show('series', 'Series');
  const rows = $('seriesRows'); rows.replaceChildren(quietRow('Opening the archive…', 4));
  let a; try { a = await archive(); } catch (e) { rows.replaceChildren(quietRow(e.message, 4)); return; }
  const list = F.seriesOf(shown(a.topics));
  $('seriesSay').textContent = list.length ? list.length.toLocaleString() + (list.length === 1 ? ' series' : ' series') + ' posted here.' : '';
  if (!list.length) { rows.replaceChildren(quietRow('No series yet. A writer starts one by giving a story a series name and a part number.', 4)); return; }
  rows.replaceChildren(...list.map((x) => {
    const tr = el('tr'), main = el('td', 'm'), who = el('td', 'who hide-s'), n = el('td', 'num', String(x.parts)), when = el('td', 'when');
    const a = link(x.name, href({ series: x.key }), 't'); a.translate = false; main.append(a);
    const pen = link(x.author, href({ by: F.authorKey(x) })); pen.translate = false; who.append(pen);
    n.dataset.l = 'Parts'; when.dataset.l = 'Last post'; when.append(timeEl(x.last));
    tr.append(main, who, n, when); return tr;
  }));
}

// Rec lists: this device's list of stories it recommends (put there with Recommend on a story), or a list someone sent by its link. Each story's
// title, writer and details are read from the boards now; one that is gone or hidden says so and keeps its place, nothing is made up for it
async function viewRecs() {
  const shared = F.readRecs(location.hash), list = shared || F.cleanRecs(me.recs);
  show('recs', shared ? shared.name || 'A rec list' : 'Rec lists');
  $('recsShared').hidden = !shared; $('recsNameBox').hidden = !!shared; $('recsActs').hidden = !!shared;
  $('recsListH').textContent = shared ? shared.name || 'A rec list' : 'My rec list'; $('recsListH').translate = !shared || !shared.name;
  $('recsSay').textContent = list.items.length ? list.items.length + (list.items.length === 1 ? ' story' : ' stories') : '';
  say($('recsShareSay'), '');
  if (shared) {
    $('recsSharedSay').textContent = 'Someone sent you this rec list by its link. It is not posted anywhere.';
    const clear = () => go(href({ v: 'recs' }), true);
    $('recsKeep').onclick = () => { let m = F.cleanRecs(me.recs); for (const x of shared.items) { const n = F.recsWith(m, x.f, x.s); if (n.items.length > m.items.length) n.items[n.items.length - 1].note = x.note; m = n; }
      me.recs = m; keep(); clear(); };
    $('recsMine').onclick = clear;
  } else {
    const name = $('recsName'); name.value = list.name; name.oninput = () => { me.recs = F.cleanRecs({ ...F.cleanRecs(me.recs), name: name.value }); keep(); };
    $('recsShare').disabled = !list.items.length;
    $('recsShare').onclick = async () => { const u = location.origin + href({ v: 'recs' }) + '#' + F.recsHash(me.recs), t = F.cleanRecs(me.recs).name || 'My rec list';
      if (navigator.share) { try { await navigator.share({ title: t, url: u }); return; } catch (_) {} }
      try { await navigator.clipboard.writeText(u); say($('recsShareSay'), 'Link copied. It holds the whole list.', 'good'); } catch (_) { say($('recsShareSay'), 'The link could not be copied.', 'bad'); } };
  }
  const rows = $('recRows');
  if (!list.items.length) { rows.replaceChildren(el('li', 'quiet', 'Your rec list is empty. Open a story and press Recommend to put it here.')); handing = null; drawRelated(); return; }
  rows.replaceChildren(el('li', 'quiet', 'Opening the archive…'));
  let a; try { a = await archive(); } catch (e) { rows.replaceChildren(el('li', 'quiet', e.message)); return; }
  const byKey = new Map(shown(a.topics).map((t) => [t.board + '/' + t.no, t]));
  const found = list.items.map((x) => ({ x, t: byKey.get(x.f + '/' + x.s) }));
  handing = () => found.filter((r) => r.t).map((r) => r.t.title + ' by ' + r.t.author + (r.x.note ? ': ' + r.x.note : '')).join('\n'); drawRelated();
  const redraw = () => viewRecs();
  rows.replaceChildren(...found.map(({ x, t }, i) => {
    const li = el('li'), main = el('div');
    if (t) {
      const ti = link(t.title, href({ f: t.board, s: t.no }), 't'); ti.translate = false; main.append(ti);
      const by = el('span', 'in'), pen = link(t.author, href({ by: F.authorKey(t) })), fl = link(t.fandom, href({ f: t.board })); pen.translate = false; fl.translate = false;
      by.append('by ', pen, ' in ', fl); main.append(by);
      const line = F.detailsLine(t); if (line) { const d = el('span', 'in det', line); d.translate = false; main.append(d); }
      main.append(figuresLine(t));
    } else main.append(el('span', 'quiet', 'This story is not on the boards now.'));
    if (shared) { if (x.note) { const w = el('p', 'why', x.note); w.translate = false; main.append(w); } }
    else {
      const lab = el('label', 'f'), inp = el('input'); inp.type = 'text'; inp.maxLength = F.RECS_LIMITS.note; inp.value = x.note; inp.placeholder = 'Why you recommend it';
      lab.append(el('span', 'vh', 'Why you recommend it'), inp);
      inp.oninput = () => { const m = F.cleanRecs(me.recs); if (m.items[i]) { m.items[i].note = inp.value; me.recs = F.cleanRecs(m); keep(); } };
      const acts = el('div', 'acts'), b = (text, on, off) => { const n = el('button', '', text); n.type = 'button'; n.disabled = !!off; n.onclick = on; return n; };
      acts.append(b('Up', () => { me.recs = F.recsMoved(me.recs, i, -1); keep(); redraw(); }, i === 0), b('Down', () => { me.recs = F.recsMoved(me.recs, i, 1); keep(); redraw(); }, i === found.length - 1),
        b('Take off', () => { me.recs = F.recsWith(me.recs, x.f, x.s, true); keep(); redraw(); }));
      main.append(lab, acts);
    }
    li.append(main); return li;
  }));
}

// Writing challenges (sycophanthex.com runs writing contests): the list of challenges this device may see, newest post first, and a form to set
// one. A challenge is a thread in a fandom (lib/fanfic.js challengeBody) signed with this device's mark, which is how its page knows who may
// name the winners. Nothing is seeded: with no challenge posted, the list says so.
const dayLabel = (day) => date(new Date(day + 'T12:00:00').getTime());
const closesLabel = (c) => (!c.closes ? 'Open, no last day' : F.challengeOpen(c) ? 'Open until ' + dayLabel(c.closes) : 'Closed ' + dayLabel(c.closes));
async function viewChallenges() {
  show('challenges', 'Writing challenges');
  const rows = $('challengeRows'), form = $('cgForm'), note = form.querySelector('[data-say]'); rows.replaceChildren(quietRow('Opening the archive…', 4));
  botOf(form);
  if (!form.elements.pen.value) form.elements.pen.value = me.pen || '';
  form.elements.closes.min = F.dayOf();
  let a; try { a = await archive(); } catch (e) { rows.replaceChildren(quietRow(e.message, 4)); return; }
  fandomOptions($('cgFandom'), a.boards, $('cgFandom').value);
  if (!a.boards.length) say(note, 'There is no fandom yet. Start one first, then set a challenge in it.');
  const list = a.challenges.filter((c) => !c.nsfw || adultOk());
  $('challengesSay').textContent = list.length ? list.length.toLocaleString() + (list.length === 1 ? ' challenge' : ' challenges') : '';
  if (!list.length) rows.replaceChildren(quietRow('No challenges yet. Set the first one below.', 4));
  else rows.replaceChildren(...list.map((c) => {
    const tr = el('tr'), main = el('td', 'm'), fd = el('td', 'who hide-s'), cl = el('td', '', closesLabel(c)), when = el('td', 'when');
    const ti = link(c.title, href({ f: c.board, s: c.no }), 't'); ti.translate = false; main.append(ti);
    const by = el('span', 'about'), pen = el('span', '', c.author); pen.translate = false; by.append('Set by ', pen); main.append(by);
    const fl = link(c.fandom, href({ f: c.board })); fl.translate = false; fd.append(fl);
    cl.dataset.l = 'Entries close'; when.dataset.l = 'Last post'; when.append(timeEl(c.bumped));
    tr.append(main, fd, cl, when); return tr;
  }));
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const b = $('cgFandom').value, title = form.elements.title.value.trim(), prompt = form.elements.prompt.value.trim(), closes = form.elements.closes.value;
    if (!b) { say(note, 'Choose a fandom first.', 'bad'); $('cgFandom').focus(); return; }
    if (!title) { say(note, 'Give the challenge a title.', 'bad'); form.elements.title.focus(); return; }
    if (!prompt) { say(note, 'Write the prompt and its rules.', 'bad'); form.elements.prompt.focus(); return; }
    if (closes && closes < F.dayOf()) { say(note, 'Choose a last day from today on, or leave it empty.', 'bad'); form.elements.closes.focus(); return; }
    me.pen = F.penName(form.elements.pen.value); keep();
    const s = sig(b, title, prompt, closes, me.pen);
    if (!form._job || form._job.sig !== s) form._job = { sig: s, b, t: 0, sub: title, parts: [F.challengeBody(prompt, closes)], name: F.signedName(me.pen, me.secret), i: 0, onThread: (t, trip) => { me.mine[b + '/' + t] = trip || 1; keep(); } };
    busy(form, true);
    try { const job = await sendParts(form, form._job); form._job = null; form.reset(); loaded = null; say(note, 'The challenge is set.', 'good'); go(href({ f: job.b, s: job.t })); }
    catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

// one challenge: its prompt and last day, its winners, and its entries (lib/fanfic.js entriesOf, winnersOf: only replies signed with the story's
// mark enter a story, only the setter's mark names a winner, and only stories posted in the challenge's fandom count). r is the thread as read.
async function viewChallenge(code, no, r) {
  const b = r.board, op = r.thread, c = F.readChallenge(op.body), key = code + '/' + no, posts = r.posts || [];
  const title = op.sub || excerpt(c.prompt, 60) || 'Untitled challenge', open = F.challengeOpen(c) && !op.locked && !op.archived;
  me.read.seen[key] = Math.max(op.bumped || 0, ...posts.map((p) => p.at || 0)); keep();
  show('challenge', title);
  handing = () => c.prompt; drawRelated();
  $('challengeH').textContent = title;
  const by = $('challengeBy'), pen = el('b', '', op.name || 'Anonymous'), fl = link(b.title, href({ f: code })); pen.translate = false; fl.translate = false;
  by.replaceChildren('Set by ', pen, ' in ', fl); if (b.nsfw) by.append(el('span', 'tag adult', '18+'));
  const prompt = $('challengePrompt'); prompt.replaceChildren(); paras(c.prompt, prompt);
  $('challengeWrite').href = href({ new: 'story', f: code, for: key }); $('challengeWrite').hidden = !open;
  $('challengeReport').href = boardLink(code, no);
  const info = (n, w) => $('challengeInfo').replaceChildren(...[['Fandom', b.title], ['Set', date(op.at || 0)], ['Entries close', c.closes ? dayLabel(c.closes) : 'No last day'],
    ['Status', open ? 'Open' : 'Closed'], ['Entries', n], ...(w ? [['Winners', String(w)]] : [])].map(([k, v]) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); return d; }));
  info('…', 0);
  const entryRows = $('entryRows'), en = $('enForm'), wn = $('wnForm');
  entryRows.replaceChildren(el('li', 'quiet', 'Opening the archive…')); wn.hidden = true;
  let a; try { a = await archive(); } catch (e) { entryRows.replaceChildren(el('li', 'quiet', e.message)); return; }
  const here = a.topics.filter((t) => t.board === code), entries = F.entriesOf(posts, here, c.closes), winners = F.winnersOf(posts, entries, op.trip || '', c.closes);
  info(String(entries.length), winners.length);
  $('entriesSay').textContent = entries.length ? entries.length + (entries.length === 1 ? ' story' : ' stories') : '';
  const row = (t, extra) => { const li = el('li'), main = el('div'), ti = link(t.title, href({ f: t.board, s: t.no }), 't'); ti.translate = false; main.append(ti);
    const line = el('span', 'in'), p = link(t.author, href({ by: F.authorKey(t) })); p.translate = false; line.append('by ', p, ' · ', extra); main.append(line);
    const det = F.detailsLine(t); if (det) { const d = el('span', 'in det', det); d.translate = false; main.append(d); }
    main.append(figuresLine(t)); li.append(main); return li; };
  const PLACES = ['First place', 'Second place', 'Third place'];
  $('winnersBox').hidden = !winners.length;
  $('winnerRows').replaceChildren(...winners.map((t, i) => row(t, PLACES[i])));
  entryRows.replaceChildren(...(entries.length ? entries.map((t) => { const when = el('span'); when.append('entered ', timeEl(t.entered)); return row(t, when); })
    : [el('li', 'quiet', open ? 'No entries yet. Write a story for this challenge, or enter one you posted in ' + b.title + '.' : 'No story was entered.')]));
  // enter a story: the stories this device posted in this fandom, signed, not entered yet
  const enNote = en.querySelector('[data-say]'), mine = here.filter((t) => t.trip && me.mine[t.board + '/' + t.no] === t.trip && !entries.some((e) => e.no === t.no));
  $('enStory').replaceChildren(...(mine.length ? mine.map((t) => { const o = el('option', '', t.title); o.value = t.no; o.translate = false; return o; }) : [el('option', '', 'No story to enter')]));
  say(enNote, !open ? (c.closes ? 'Entries closed on ' + dayLabel(c.closes) + '.' : 'This challenge is closed.') : mine.length ? '' : 'No story of yours in ' + b.title + ' to enter yet. Write one for this challenge first.');
  busy(en, !open || !mine.length); $('enStory').disabled = !open || !mine.length;
  if (open && mine.length) {
    botOf(en);
    en.onsubmit = async (ev) => {
      ev.preventDefault();
      busy(en, true);
      try { await sendParts(en, { b: code, t: no, sub: '', parts: [F.entryBody(code, +$('enStory').value)], name: F.signedName(me.pen, me.secret), i: 0 }); loaded = null; say(enNote, 'Your story is entered.', 'good'); return viewStory(code, no); }
      catch (e) { fail(enNote, e); } finally { busy(en, false); }
    };
  }
  // name a winner: only on the device that set the challenge, once entries are closed (any time for a challenge with no last day), up to 3
  const left = entries.filter((t) => !winners.includes(t));
  wn.hidden = !(op.trip && me.mine[key] === op.trip && !op.locked && !op.archived && (!c.closes || !F.challengeOpen(c)) && winners.length < 3 && left.length);
  if (!wn.hidden) {
    $('wnStory').replaceChildren(...left.map((t) => { const o = el('option', '', t.title + ' by ' + t.author); o.value = t.no; o.translate = false; return o; }));
    const wnNote = wn.querySelector('[data-say]'); say(wnNote, ''); botOf(wn);
    wn.onsubmit = async (ev) => {
      ev.preventDefault();
      busy(wn, true);
      try { await sendParts(wn, { b: code, t: no, sub: '', parts: [F.winnerBody(code, +$('wnStory').value)], name: F.signedName(me.pen, me.secret), i: 0 }); loaded = null; say(wnNote, 'Winner named.', 'good'); return viewStory(code, no); }
      catch (e) { fail(wnNote, e); } finally { busy(wn, false); }
    };
  }
}

// Random story: one of the stories this device may see, picked at random; the address becomes that story's, so Back returns to where you were
async function viewRandom() {
  show('random', 'Random story');
  const s = $('randomSay'); say(s, 'Picking a story…');
  let a; try { a = await archive(); } catch (e) { fail(s, e); return; }
  const t = F.randomOf(shown(a.topics));
  if (t) return go(href({ f: t.board, s: t.no }), true);
  say(s, 'Random story picks one of the stories posted here. There are none yet, so there is nothing to pick.');
}

async function viewRecent() {
  show('recent', 'Most recent');
  const rows = $('recent').querySelector('[data-rows]');
  let a; try { a = await archive(); } catch (e) { rows.replaceChildren(quietRow(e.message)); return; }
  drawList('recent', shown(a.topics));
}

/** a chapter's text as paragraphs: a blank line starts a new one, a line opening with > is a quote. textContent only, so nothing is markup. */
function paras(text, host) {
  for (const block of String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const t = block.replace(/^\n+|\n+$/g, ''); if (!t.trim()) continue;
    const lines = t.split('\n'), quote = lines.every((l) => /^>/.test(l)), node = el(quote ? 'blockquote' : 'p');
    lines.forEach((l, i) => { if (i) node.append(el('br')); node.append(quote ? l.replace(/^>\s?/, '') : l); });
    host.append(node);
  }
}

async function viewStory(code, no, chap) {
  const r = await api('?b=' + encodeURIComponent(code) + '&t=' + no);
  if (r.status === 404 || r.status === 410 || !r.ok) { gone(r.status === 410 ? 'That story is hidden while it is looked at.' : r.say ? r.say.replace(/^./, (c) => c.toUpperCase()) + '.' : 'That story is not here.'); return; }
  const b = r.board, op = r.thread;
  if (!F.isFicBoard(b)) { location.replace(boardLink(code, no)); return; }
  if (b.nsfw && !adultOk()) { gate(); return; }
  if (F.readChallenge(op.body)) return viewChallenge(code, no, r);
  const s = F.storyOf(op, r.posts || []), key = code + '/' + no;
  me.read.seen[key] = Math.max(op.bumped || 0, ...(r.posts || []).map((p) => p.at || 0)); keep();
  show('story', s.title);
  const crumb = $('storyCrumb'); crumb.textContent = b.title; crumb.translate = false; crumb.href = href({ f: code });
  $('storyH').textContent = s.title;
  const by = $('storyBy'), pen = el('b', '', s.author); pen.translate = false; by.replaceChildren('by ', pen);
  if (b.nsfw) by.append(el('span', 'tag adult', '18+'));
  const det = F.detailsLine(s.details); $('storyDetails').textContent = det; $('storyDetails').hidden = !det;
  $('storySum').textContent = s.summary; $('storySum').hidden = !s.summary;
  const facts = [['Rated', s.details.rating ? s.details.rating + (b.nsfw ? ' · 18+' : '') : b.nsfw ? '18+' : 'All ages'], ...(s.details.status ? [['Status', s.details.status]] : []),
    ...(s.details.part ? [['Series', 'Part ' + s.details.part + ' of ' + s.details.series, href({ series: F.seriesKey({ ...s.details, author: s.author, trip: s.trip }) })]] : []), ['Fandom', b.title], ['Chapters', String(s.chapters.length)], ['Words', s.words.toLocaleString()],
    ['Reading time', F.readLabel(s.words)], ['Reviews', String(s.reviews.length)], ...(s.stars.n ? [['Stars', '★ ' + s.stars.avg + ' of 5 from ' + s.stars.n + (s.stars.n === 1 ? ' rating' : ' ratings')]] : []), ['Published', date(s.published)], ['Updated', date(s.updated)]];
  $('storyInfo').replaceChildren(...facts.map(([k, v, to]) => { const d = el('div'), dd = el('dd'); if (to) { const a = link(v, to); a.translate = false; dd.append(a); } else dd.textContent = v; d.append(el('dt', '', k), dd); return d; }));
  // hits: this read is counted (once a visitor a day, on the server) and the count shows when there is one; a story no one has read shows none
  const hitsD = el('div'), hitsV = el('dd'); hitsD.id = 'storyHits'; hitsD.hidden = true; hitsD.append(el('dt', '', 'Hits'), hitsV); $('storyInfo').append(hitsD);
  countHit(code, no).then((n) => { if (n > 0 && hitsD.isConnected) { hitsV.textContent = n.toLocaleString(); hitsD.hidden = false; } });
  // the chapter shown, and the chapter list
  const n = Math.max(1, Math.min(s.chapters.length, +chap || 1)), c = s.chapters[n - 1], sel = $('tocSel');
  handing = () => (c ? c.text : ''); drawRelated();
  $('toc').hidden = s.chapters.length < 2;
  sel.replaceChildren(...s.chapters.map((x) => { const o = el('option', '', 'Chapter ' + x.n + (x.title ? ': ' + x.title : '')); o.value = x.n; return o; }));
  sel.value = n; sel.onchange = () => go(href({ f: code, s: no, c: sel.value > 1 ? sel.value : '' }), true);
  $('tocSay').textContent = 'Chapter ' + n + ' of ' + s.chapters.length;
  const box = el('section', 'chapter'), prose = el('div', 'prose'), h3 = el('h3', '', s.chapters.length > 1 ? 'Chapter ' + c.n + (c.title ? ': ' + c.title : '') : s.title);
  prose.translate = false; if (s.chapters.length < 2) h3.translate = false; box.append(h3);
  paras(c.text, prose); box.append(prose);
  const acts = el('div', 'acts');
  if (n > 1) acts.append(link('Previous chapter', href({ f: code, s: no, c: n - 1 > 1 ? n - 1 : '' }), 'btn'));
  if (n < s.chapters.length) acts.append(link('Next chapter', href({ f: code, s: no, c: n + 1 }), 'btn go'));
  // the story's own link (this chapter), to send to a reader: the phone's share sheet when there is one, else the clipboard
  const share = el('button', 'btn', 'Share link'), shareSay = el('span', 'quiet', ''); share.type = 'button'; share.id = 'storyShare'; shareSay.setAttribute('role', 'status');
  share.onclick = async () => { const u = location.href;
    if (navigator.share) { try { await navigator.share({ title: s.title, url: u }); return; } catch (_) {} }
    try { await navigator.clipboard.writeText(u); say(shareSay, 'Link copied.', 'good'); } catch (_) { say(shareSay, 'The link could not be copied. Copy it from the address bar.', 'bad'); } };
  // Recommend: puts the story on this device's rec list (Rec lists), or takes it off again
  const rec = el('button', 'btn'), inRecs = () => F.cleanRecs(me.recs).items.some((x) => x.f === code && x.s === +no);
  rec.type = 'button'; rec.id = 'storyRec';
  const recDraw = () => { const on = inRecs(); rec.textContent = on ? 'In your rec list' : 'Recommend'; rec.setAttribute('aria-pressed', String(on)); };
  rec.onclick = () => { const on = inRecs(), next = F.recsWith(me.recs, code, +no, on);
    if (!on && next.items.length === F.cleanRecs(me.recs).items.length) { say(shareSay, 'Your rec list is full at ' + F.RECS_LIMITS.items + ' stories. Take one off in Rec lists first.', 'bad'); return; }
    me.recs = next; keep(); recDraw(); say(shareSay, on ? 'Taken off your rec list.' : 'On your rec list. Open Rec lists to add a line on why.', 'good'); };
  recDraw();
  const rep = el('a', 'btn', 'Report this'); rep.href = boardLink(code, no, c.nos[0]); acts.append(share, rec, rep, shareSay);
  box.append(acts); $('chapters').replaceChildren(box);
  // reviews
  $('reviewsH').textContent = s.reviews.length ? 'Reviews (' + s.reviews.length + ')' : 'Reviews';
  $('reviews').replaceChildren(...(s.reviews.length ? s.reviews.map((p) => {
    const d = el('div', 'review'), meta = el('p', 'meta'), who = el('b', '', p.name || 'Anonymous'); if (p.name) who.translate = false; meta.append(who, ' · ', timeEl(p.at)); d.append(meta);
    const rv = F.readReview(p.body); if (rv.stars) { const st = el('p', 'stars', '★'.repeat(rv.stars) + '☆'.repeat(5 - rv.stars)); st.setAttribute('aria-label', rv.stars + ' of 5 stars'); st.title = rv.stars + ' of 5 stars'; d.append(st); }
    const body = el('div'); body.translate = false; paras(rv.text, body); d.append(body); return d;
  }) : [el('p', 'quiet', 'No reviews yet. Be the first to say what you thought.')]));
  wireReview(code, no, op.locked || op.archived);
  // the next chapter: only for the device that posted the story, while the thread is open
  const own = !!me.mine[key] && !!s.trip && !op.locked && !op.archived;
  $('addChapter').hidden = !own;
  if (own) wireChapter(code, no, s.chapters.length + 1, s.details.status === 'Complete');
}

function gate() { show('gate', 'For adults'); }
function gone(text) { show('gone', 'Not here'); $('goneSay').textContent = text || 'It may have been removed, or the link is not complete.'; }

// ---- posting: one story, chapter or review, cut into the posts the boards take, sent one by one through the bot check ----
const bots = new Map();
const botOf = (form) => { if (!bots.has(form)) bots.set(form, botFor(form.querySelector('[data-bot]'))); const b = bots.get(form); b.start(); return b; };
/** sends job.parts from job.i on; job = { b, t, sub, parts, name, i }. Sets job.t to the new thread after the first post. Returns the reply of the
 *  last post. Stops at the first refusal and leaves job.i at the part that did not go up, so a second press sends the rest. */
async function sendParts(form, job) {
  const bot = botOf(form), note = form.querySelector('[data-say]');
  while (job.i < job.parts.length) {
    if (job.i > 0) for (let w = 16; w > 0; w--) { say(note, 'Posted part ' + job.i + ' of ' + job.parts.length + '. The next part goes up in ' + w + ' s, so the boards take it.'); await sleep(1000); }
    say(note, job.parts.length > 1 ? 'Posting part ' + (job.i + 1) + ' of ' + job.parts.length + '…' : 'Posting…');
    let r = null;
    for (let tries = 0; tries < 3; tries++) {
      const proof = await bot.proof();
      r = await api('', { do: 'post', b: job.b, t: job.t || undefined, sub: job.t ? '' : job.sub, body: job.parts[job.i], name: job.name, password: me.pw, proof });
      bot.reset();
      if (!(r.status === 429 && r.kind === 'limited' && job.i > 0)) break;
      for (let w = 16; w > 0; w--) { say(note, 'The boards asked for a short pause. Trying again in ' + w + ' s.'); await sleep(1000); }
    }
    if (!r.ok) throw new Error((r.say || 'that did not post') + (job.i > 0 ? '. Parts 1 to ' + job.i + ' are up; press the button again to send the rest' : ''));
    if (!job.t) { job.t = r.thread; job.trip = r.trip || ''; if (job.onThread) job.onThread(job.t, job.trip); }
    job.i++;
  }
  return job;
}
/** a form's text, word count and how many posts it will go up in. */
function counter(form, field, n = () => 1) {
  const out = form.querySelector('[data-count]'), area = form.elements[field];
  const draw = () => { const w = F.words(area.value), k = area.value.trim() ? n() : 0; out.textContent = w ? words(w) + ', ' + F.readLabel(w) + (k > 1 ? ', posted in ' + k + ' parts' : '') : ''; };
  area.oninput = draw; draw(); return draw;
}
function busy(form, on) { for (const b of form.querySelectorAll('button')) b.disabled = on; }
const sig = (...a) => JSON.stringify(a);

const NEW_FANDOM = '+new'; // the post form's "A new fandom…": no board code can start with +
function fandomOptions(sel, boards, pick, withNew) {
  sel.replaceChildren(el('option', '', 'Choose a fandom')); sel.firstChild.value = '';
  for (const b of boards) { const o = el('option', '', b.title + (b.nsfw ? ' (18+)' : '')); o.value = b.code; sel.append(o); }
  if (withNew) { const o = el('option', '', 'A new fandom…'); o.value = NEW_FANDOM; sel.append(o); }
  if (pick && (boards.some((b) => b.code === pick) || (withNew && pick === NEW_FANDOM))) sel.value = pick;
}
/** opens the fandom a typed name means (lib/fanfic.js fandomFor) through the form's own person check, or finds it when it is here already.
 *  { title, code, existing }; throws with the reason. One name never opens two fandoms, from either form. */
async function openFandom(form, name, adult, about) {
  const a = await archive(true), all = await api('');
  const want = F.fandomFor(name, a.boards, new Set((all.boards || []).map((b) => b.code)));
  if (!want) throw new Error('that name cannot make a fandom. Try another');
  if (want.existing) return want;
  const bot = botOf(form), proof = await bot.proof();
  const r = await api('', { do: 'board', code: want.code, title: want.title, about: about || 'Fan fiction: ' + want.title, nsfw: !!adult, textOnly: true, ids: false, proof });
  bot.reset();
  if (!r.ok) throw new Error(r.say || 'the fandom did not start');
  loaded = null; return want;
}

// the post form's story details (lib/fanfic.js RATINGS, GENRES, WARNINGS), drawn once: a rating with its one-line meaning, at most 3 genres
// (the rest turn off at 3), the characters as names split by commas, and each warning that applies
function detailFields(form) {
  const r = form.elements.rating, g = $('stGenres'), w = $('stWarnings');
  if (r.options.length > 1) return;
  for (const [n, line] of F.RATINGS) { const o = el('option', '', n + ': ' + line); o.value = n; r.append(o); }
  const chip = (box, name, v) => { const l = el('label'), c = el('input'); c.type = 'checkbox'; c.name = name; c.value = v; l.append(c, ' ' + v); box.append(l); };
  for (const x of F.GENRES) chip(g, 'genre', x);
  for (const x of F.WARNINGS) chip(w, 'warning', x);
  const cap = () => { const n = g.querySelectorAll('input:checked').length; for (const c of g.querySelectorAll('input')) c.disabled = !c.checked && n >= F.DETAIL_LIMITS.genres; };
  g.addEventListener('change', cap); form.addEventListener('reset', () => setTimeout(cap));
}
// a writer's chapter is in a document already: "Open a file" reads it on this device into the box (lib/fanfic.js fileText), and Preview shows
// it as readers will, drawn by the same paras() as a story page, before anything is sent
const inflate = async (bytes) => { // a .docx entry, capped as it unpacks, so a crafted file cannot grow into memory
  const r = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > F.XML_MAX) { try { await r.cancel(); } catch (_) {} throw new Error('too big'); } parts.push(value); }
  const out = new Uint8Array(n); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out;
};
function fileAndPreview(form, note) {
  if (form._files) return; form._files = true; // the form stays in the page between visits, so it is wired once
  const box = form.elements.text, file = $('stFile'), undo = $('stUndo'), prev = $('stPrev'), pane = $('stPreview');
  file.accept = F.FILE_TYPES;
  let before = null;
  const drawPreview = () => {
    if (pane.hidden) return;
    pane.querySelector('h3').textContent = form.elements.title.value.trim() || 'Untitled story';
    const sum = form.elements.summary.value.trim(), ps = pane.querySelector('.psum'); ps.textContent = sum; ps.hidden = !sum;
    const prose = pane.querySelector('.prose'); prose.replaceChildren(); paras(box.value, prose);
    if (!prose.childElementCount) prose.append(el('p', 'hint', 'Write or open chapter 1, and it shows here.'));
  };
  for (const h of [pane.querySelector('h3'), pane.querySelector('.psum'), pane.querySelector('.prose')]) h.translate = false;
  prev.onclick = () => { pane.hidden = !pane.hidden; prev.setAttribute('aria-expanded', String(!pane.hidden)); prev.textContent = pane.hidden ? 'Preview' : 'Hide preview'; drawPreview(); };
  form.addEventListener('input', drawPreview); form.addEventListener('reset', () => setTimeout(() => { before = null; undo.hidden = true; drawPreview(); }));
  $('stOpen').onclick = () => file.click();
  const put = (text) => { box.value = text; box.dispatchEvent(new Event('input', { bubbles: true })); };
  file.onchange = async () => {
    const f = file.files && file.files[0]; file.value = ''; if (!f) return;
    if (f.size > F.FILE_MAX) { say(note, 'That file is over 4 MB. Open a smaller one, or paste the chapter.', 'bad'); return; }
    let t = ''; try { t = await F.fileText(f.name, new Uint8Array(await f.arrayBuffer()), inflate); } catch (_) {}
    if (!F.words(t)) { say(note, 'No text found in that file. Open a .docx, .txt, .html or .md file, or paste the chapter.', 'bad'); return; }
    before = box.value; undo.hidden = !box.value.trim(); put(t);
    if (!form.elements.title.value.trim()) form.elements.title.value = F.titleOfFile(f.name);
    say(note, 'Opened: ' + words(F.words(t)) + '. Check it in Preview before you post.', 'good');
  };
  undo.onclick = () => { if (before == null) return; put(before); before = null; undo.hidden = true; say(note, 'The text you had is back.'); };
}
async function viewPost(pick, forKey) {
  show('post', 'Post a story');
  const form = $('stForm'), note = form.querySelector('[data-say]'), sel = $('stFandom');
  $('postFor').hidden = true; sel.disabled = false;
  botOf(form);
  if (sessionStorage.getItem('fanfic.fromRoom') === '1') {
    sessionStorage.removeItem('fanfic.fromRoom');
    const d = draft(); if (d) { form.elements.title.value = d.title; form.elements.text.value = d.text; }
  }
  if (!form.elements.pen.value) form.elements.pen.value = me.pen || '';
  detailFields(form);
  const details = () => ({ rating: form.elements.rating.value, characters: form.elements.characters.value, status: (form.querySelector('input[name=status]:checked') || {}).value || '',
    series: form.elements.series.value, part: form.elements.part.value,
    genres: [...form.querySelectorAll('input[name=genre]:checked')].map((c) => c.value), warnings: [...form.querySelectorAll('input[name=warning]:checked')].map((c) => c.value) });
  const parts = () => F.chapterPosts(1, '', form.elements.text.value, form.elements.summary.value, details()).length;
  counter(form, 'text', parts);
  fileAndPreview(form, note);
  // a first writer never leaves the form: "A new fandom…" names one here, and it opens with the story (no fandom yet: it is picked already)
  const nw = $('stNew'), newName = form.elements.newFandom, drawNew = () => { const on = sel.value === NEW_FANDOM; nw.hidden = !on; newName.required = on; };
  sel.onchange = () => { drawNew(); if (!nw.hidden) newName.focus(); };
  let a; try { a = await archive(); } catch (e) { fail(note, e); return; }
  fandomOptions(sel, a.boards, pick || sel.value, true);
  if (!a.boards.length) { sel.value = NEW_FANDOM; say(note, 'No fandom is here yet. Name the first one above: it opens when your story goes up.'); }
  drawNew();
  // written for a challenge (?for=fandom/no): the story goes up in the challenge's fandom, then enters the challenge with a reply signed the same way
  const ch = forKey ? a.challenges.find((x) => x.board + '/' + x.no === forKey && x.board === pick) : null, chOpen = !!ch && F.challengeOpen(ch) && !ch.locked;
  if (chOpen) { $('postForSay').textContent = 'This story enters the challenge "' + ch.title + '" once it is up.' + (ch.closes ? ' Entries close ' + dayLabel(ch.closes) + '.' : ''); $('postFor').hidden = false; sel.disabled = true; }
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    let b = sel.value; const title = form.elements.title.value.trim(), text = form.elements.text.value, summary = form.elements.summary.value, d = details();
    if (!b) { say(note, 'Choose a fandom first.', 'bad'); sel.focus(); return; }
    if (b === NEW_FANDOM && !F.penName(newName.value)) { say(note, 'Give the new fandom a name.', 'bad'); newName.focus(); return; }
    if (!title) { say(note, 'Give the story a title.', 'bad'); form.elements.title.focus(); return; }
    if (!d.rating) { say(note, 'Choose a rating, so readers know what to expect.', 'bad'); form.elements.rating.focus(); return; }
    if (d.series.trim() && !F.cleanDetails(d).part) { say(note, 'Give the part number this story is in its series, from 1 to 999.', 'bad'); form.elements.part.focus(); return; }
    if (!F.words(text)) { say(note, 'Write or paste chapter 1 first.', 'bad'); form.elements.text.focus(); return; }
    if (b === NEW_FANDOM) { // open it first; once it is open the picker holds it, so a second press never opens it again
      busy(form, true); say(note, 'Opening the fandom…');
      try { const f = await openFandom(form, newName.value, form.elements.newRate.value === 'adult'); a = await archive(); fandomOptions(sel, a.boards, f.code, true); sel.value = b = f.code; drawNew(); }
      catch (e) { fail(note, e); busy(form, false); return; }
    }
    me.pen = F.penName(form.elements.pen.value); keep();
    const s = sig(b, title, text, summary, me.pen, d);
    if (!form._job || form._job.sig !== s) form._job = { sig: s, b, t: 0, sub: title, parts: F.chapterPosts(1, '', text, summary, d), name: F.signedName(me.pen, me.secret), i: 0, onThread: (t, trip) => { me.mine[b + '/' + t] = trip || 1; keep(); } };
    busy(form, true);
    try {
      const job = await sendParts(form, form._job); // sends nothing again once every part is up, so a second press only retries the entry
      if (chOpen && job.b === ch.board) {
        // the boards take one post at a time from a writer, so the entry waits as the parts of a long story do
        if (!job.entry) { for (let w = 16; w > 0; w--) { say(note, 'Your story is up. It enters the challenge in ' + w + ' s, so the boards take it.'); await sleep(1000); } job.entry = { b: ch.board, t: ch.no, sub: '', parts: [F.entryBody(job.b, job.t)], name: job.name, i: 0 }; }
        if (job.entry.i < 1) await sendParts(form, job.entry);
      }
      form._job = null; form.reset(); loaded = null;
      say(note, 'Posted.', 'good'); go(href({ f: job.b, s: job.t }));
    } catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

function wireChapter(code, no, n, complete) {
  const form = $('chForm'), note = form.querySelector('[data-say]');
  $('chDoneBox').hidden = !!complete; if (complete) form.elements.done.checked = false;
  $('addChapter').querySelector('h2').textContent = 'Add chapter ' + n;
  botOf(form);
  counter(form, 'text', () => F.chapterPosts(n, form.elements.title.value, form.elements.text.value, '', null, form.elements.done.checked).length);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const title = form.elements.title.value, text = form.elements.text.value, done = form.elements.done.checked;
    if (!F.words(text)) { say(note, 'Write or paste the chapter first.', 'bad'); form.elements.text.focus(); return; }
    const s = sig(code, no, n, title, text, done);
    if (!form._job || form._job.sig !== s) form._job = { sig: s, b: code, t: no, sub: '', parts: F.chapterPosts(n, title, text, '', null, done), name: F.signedName(me.pen, me.secret), i: 0 };
    busy(form, true);
    try { await sendParts(form, form._job); form._job = null; form.reset(); loaded = null; say(note, 'Chapter ' + n + ' is up.', 'good'); go(href({ f: code, s: no, c: n }), true); }
    catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

function wireReview(code, no, closed) {
  const form = $('rvForm'), note = form.querySelector('[data-say]');
  say(note, closed ? 'This story is closed to new reviews.' : '');
  busy(form, !!closed); if (closed) return;
  if (!form.elements.pen.value) form.elements.pen.value = me.pen || '';
  botOf(form);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) { say(note, 'Write the review first.', 'bad'); form.elements.text.focus(); return; }
    me.pen = F.penName(form.elements.pen.value); keep();
    busy(form, true);
    try {
      // a review is never signed, so it can never be read as a chapter; its stars, when given, open the post
      await sendParts(form, { b: code, t: no, sub: '', parts: [F.reviewBody(text, form.elements.stars.value)], name: me.pen || 'Anonymous', i: 0 });
      form.elements.text.value = ''; form.elements.stars.value = '0'; loaded = null; say(note, 'Thank you. Your review is up.', 'good'); viewStory(code, no, new URLSearchParams(location.search).get('c'));
    } catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

async function viewFandom() {
  show('fandom', 'Start a fandom');
  const form = $('fdForm'), note = form.querySelector('[data-say]');
  botOf(form);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const title = F.penName(form.elements.title.value), about = form.elements.about.value.trim(), adult = form.elements.rate.value === 'adult';
    if (!title) { say(note, 'Give the fandom a name.', 'bad'); form.elements.title.focus(); return; }
    busy(form, true); say(note, 'Starting the fandom…');
    try {
      const f = await openFandom(form, title, adult, about);
      if (f.existing) { say(note, f.title + ' is here already.'); go(href({ f: f.code })); return; }
      form.reset(); say(note, f.title + ' is open.', 'good'); go(href({ f: f.code }));
    } catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

async function viewSearch(q) {
  show('search', 'Search');
  const list = $('sres'), note = $('sSay'); $('sq').value = q || '';
  list.replaceChildren();
  if (!q) { note.hidden = false; say(note, 'Type a word to search.'); return; }
  brain.tell(q);
  note.hidden = false; say(note, 'Searching…');
  let a; try { a = await archive(); } catch (e) { fail(note, e); return; }
  const fic = new Map(a.boards.map((b) => [b.code, b])), r = await api('?q=' + encodeURIComponent(q));
  if (!r.ok) { fail(note, new Error(r.say || 'the search did not run')); return; }
  const hits = (r.results || []).filter((x) => fic.has(x.board) && (!x.nsfw || adultOk()));
  list.replaceChildren(...hits.map((x) => {
    const li = el('li'), b = fic.get(x.board), to = href({ f: x.board, s: x.thread });
    li.append(link(x.sub || excerpt(x.body, 70) || 'Untitled', to, 't'));
    const sm = el('small'); sm.append(b.title + ' · ' + (x.name || 'Anonymous') + ' · ', timeEl(x.at)); li.append(sm);
    li.append(el('p', 'muted', excerpt(x.body, 200))); return li;
  }));
  note.hidden = !!hits.length; if (!hits.length) say(note, 'Nothing matches "' + q + '". Try another word.');
}
$('sf').onsubmit = (ev) => { ev.preventDefault(); const q = $('sq').value.trim(); go(href({ v: 'search', q })); };

// ---- the Writing Room: drafts on this device ----
const draft = () => me.drafts.find((d) => d.id === me.cur);
const total = () => me.drafts.reduce((n, d) => n + F.words(d.text), 0);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let counted = 0, saveT = 0, delArm = 0;
function newDraft(title = '', text = '') { const d = { id: rid(), title, text, at: Date.now() }; me.drafts.unshift(d); me.cur = d.id; counted = total(); keep(); return d; }
const label = (d) => (d.title || 'Untitled story') + ' · ' + words(F.words(d.text));
function drawDrafts() {
  const sel = $('drafts'); sel.replaceChildren(...me.drafts.map((d) => { const o = el('option', '', label(d)); o.value = d.id; return o; }));
  sel.value = me.cur; const d = draft();
  $('dTitle').value = d.title; $('dText').value = d.text;
  $('delDraft').disabled = me.drafts.length < 2 && !d.text && !d.title; $('delDraft').textContent = 'Delete draft'; delArm = 0;
  drawStats();
}
function drawStats() {
  const d = draft(), n = F.words(d.text);
  $('sWords').textContent = n.toLocaleString(); $('sRead').textContent = F.readLabel(n);
  $('sToday').textContent = (me.days[F.dayOf()] || 0).toLocaleString(); $('sStreak').textContent = String(F.streak(me.days));
}
const roomSay = (t, tone) => say($('roomSay'), t, tone);
function edited() {
  const d = draft(); d.title = $('dTitle').value; d.text = $('dText').value; d.at = Date.now();
  const now = total(); if (now > counted) { const k = F.dayOf(); me.days[k] = (me.days[k] || 0) + (now - counted); me.days = F.trimDays(me.days); } counted = now; // only words added count
  drawStats(); $('sSaved').textContent = 'Saving';
  clearTimeout(saveT); saveT = setTimeout(() => {
    if (keep()) $('sSaved').textContent = 'Saved'; else { $('sSaved').textContent = 'Not saved'; roomSay('This browser would not keep the draft (storage is full or blocked). Export it to keep it.', 'bad'); }
    const o = $('drafts').selectedOptions[0]; if (o) o.textContent = label(d);
  }, 400);
}
$('dTitle').addEventListener('input', edited); $('dText').addEventListener('input', edited);
$('drafts').onchange = () => { me.cur = $('drafts').value; keep(); drawDrafts(); };
$('newDraft').onclick = () => { newDraft(); drawDrafts(); $('dTitle').focus(); roomSay('A new draft.'); };
$('delDraft').onclick = () => {
  const d = draft();
  if ((d.text || d.title) && !delArm) { delArm = 1; $('delDraft').textContent = 'Press again to delete'; roomSay('Deleting "' + (d.title || 'Untitled story') + '" cannot be undone. Press again to delete it.', 'bad'); return; }
  me.drafts = me.drafts.filter((x) => x.id !== d.id); if (!me.drafts.length) newDraft(); me.cur = me.drafts[0].id; counted = total(); keep(); drawDrafts(); roomSay('Draft deleted.');
};
$('export').onclick = () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  const a = el('a'); a.href = URL.createObjectURL(new Blob([(d.title ? d.title + '\n\n' : '') + d.text + '\n'], { type: 'text/plain;charset=utf-8' })); a.download = F.fileName(d.title);
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); roomSay('Saved as ' + a.download + '.', 'good');
};
$('copy').onclick = async () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  try { await navigator.clipboard.writeText((d.title ? d.title + '\n\n' : '') + d.text); roomSay('Copied.', 'good'); } catch (_) { $('dText').focus(); $('dText').select(); roomSay('The text is selected: copy it with your keyboard or menu.'); }
};
let shareUrl = '';
$('share').onclick = async () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  shareUrl = location.origin + '/fanfic/?v=room#' + F.shareHash(d);
  if (shareUrl.length > F.SHARE_MAX) { roomSay('This draft is too long for a link. Export it as a file and send that instead.'); return; }
  if (navigator.share) { try { await navigator.share({ title: d.title || 'A story', url: shareUrl }); roomSay('Shared. The link holds the draft itself; nothing is uploaded.', 'good'); return; } catch (_) {} }
  try { await navigator.clipboard.writeText(shareUrl); roomSay('Link copied. It holds the draft itself; nothing is uploaded.', 'good'); }
  catch (_) { const n = $('roomSay'); n.replaceChildren('The link holds the draft itself; nothing is uploaded: '); const a = el('a', '', 'the link to this draft'); a.href = shareUrl; n.append(a, '.'); n.classList.remove('bad'); }
};
$('toPost').onclick = () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  sessionStorage.setItem('fanfic.fromRoom', '1'); go(href({ new: 'story' }));
};
function viewRoom() {
  show('room', 'Writing Room'); drawDrafts();
  const shared = F.readShare(location.hash);
  $('shared').hidden = !shared;
  if (!shared) return;
  const from = new URLSearchParams(location.search).get('from') === 'story' ? 'Your story from the story writer' : 'Someone shared a draft with you';
  $('sharedSay').textContent = from + ': "' + (shared.title || 'Untitled story') + '", ' + words(F.words(shared.text)) + '.';
  const clear = () => { $('shared').hidden = true; history.replaceState(null, '', location.pathname + location.search); };
  $('sharedKeep').onclick = () => { newDraft(shared.title, shared.text); counted = total(); keep(); drawDrafts(); clear(); roomSay('The shared draft is in your Writing Room.', 'good'); };
  $('sharedNo').onclick = clear;
}

function viewNotice(which) {
  const all = NOTICES.concat(SITE_PAGES), id = all.some(([k]) => k === which) ? which : 'rules', site = SITE_PAGES.some(([k]) => k === id);
  show('notice', all.find(([k]) => k === id)[1], site || id === 'news' ? '' : id === 'help' ? 'help' : 'notice'); // a site page and the news are no tab's: the footer opens them
  for (const [k] of all) $('n-' + k).hidden = k !== id;
  $('crumbNotice').hidden = site; $('crumbAbout').hidden = !site;
}

// ---- the router: one page, the address says which view ----
async function route() {
  const q = new URLSearchParams(location.search), f = (q.get('f') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10), s = +(q.get('s') || 0) || 0, v = q.get('v');
  if (q.has('notice')) return viewNotice(q.get('notice'));
  if (q.get('new') === 'story') return viewPost(f, (q.get('for') || '').slice(0, 30));
  if (q.get('new') === 'fandom') return viewFandom();
  if (f && s) return viewStory(f, s, q.get('c'));
  if (f) return viewForum(f);
  if (v === 'recent') return viewRecent();
  if (v === 'authors') return viewAuthors();
  if (v === 'series') return viewSeries();
  if (v === 'recs' || /^#recs=/.test(location.hash)) return viewRecs();
  if (v === 'challenges') return viewChallenges();
  if (v === 'random') return viewRandom();
  if (v === 'search') return viewSearch((q.get('q') || '').slice(0, 200));
  if (v === 'room' || /^#room=/.test(location.hash)) return viewRoom();
  if (v === 'glossary') { show('glossary', 'Writing Glossary'); return; }
  return viewIndex();
}
function go(url, replace) { history[replace ? 'replaceState' : 'pushState'](null, '', url); scrollTo(0, 0); route(); }
document.addEventListener('click', (ev) => {
  const a = ev.target.closest && ev.target.closest('a[data-go]');
  if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || a.target) return;
  ev.preventDefault(); go(a.getAttribute('href'));
});
addEventListener('popstate', route);
$('gateYes').onclick = () => { setAdult(); route(); };

// keyboard shortcuts, outside text fields (the footer lists them): / find, n new story, w Writing Room, i index, r most recent, ? the list
document.addEventListener('keydown', (ev) => {
  const t = ev.target, typing = t && (t.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if (typing || ev.metaKey || ev.ctrlKey || ev.altKey || ev.defaultPrevented) return;
  const k = ev.key, onIndex = $('index').classList.contains('on');
  if (k === '/') { ev.preventDefault(); if (onIndex) $('find').focus(); else { go(href({ v: 'search' })); $('sq').focus(); } }
  else if (k === 'n') go(href({ new: 'story' }));
  else if (k === 'w') go(href({ v: 'room' }));
  else if (k === 'i') go('/fanfic/');
  else if (k === 'r') go(href({ v: 'recent' }));
  else if (k === '?') { const d = document.querySelector('details.keys'); d.open = true; d.querySelector('summary').focus(); }
});

// the language: German swaps the archive's own words after every draw; the switch keeps the choice on this device
{
  const b = $('langBtn');
  if (german) { b.textContent = 'English'; b.lang = 'en'; b.setAttribute('aria-label', 'Read in English'); }
  b.onclick = () => {
    try { localStorage.setItem(LANG_KEY, german ? 'en' : 'de'); } catch (_) {}
    const u = new URLSearchParams(location.search); u.delete('lang'); location.replace(location.pathname + (u.toString() ? '?' + u : '') + location.hash);
  };
  if (german) {
    document.documentElement.lang = 'de'; DE.germanize(document.body);
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) DE.germanize(n); }).observe(document.body, { childList: true, subtree: true });
  }
}

if (!me.drafts.length) newDraft();
if (!draft()) me.cur = me.drafts[0].id;
counted = total();
route();
